/**
 * Biometric device command helpers.
 *
 * The gate is opened by the scanner itself the moment a fingerprint matches —
 * the server only hears about it afterwards. So access is controlled by
 * changing what's stored on the device.
 *
 * Only one command is honoured by every eSSL/ZKTeco firmware:
 *
 *     DATA DELETE USERINFO PIN=<uid>
 *
 * Deleting also wipes the enrolled finger, which on its own would mean
 * re-enrolling every member who renews. To avoid that, the ADMS server backs
 * up each fingerprint template the device uploads (`biometric_templates`).
 * Restoring access re-creates the user and pushes the saved template back, so
 * nobody has to put their finger on the scanner again.
 *
 * If a device turns out not to upload templates, the restore falls back to
 * "needs re-enrollment" and says so instead of silently failing.
 */

export function buildDeleteUserCommand(uid) {
  return `DATA DELETE USERINFO PIN=${uid}`;
}

export function buildCreateUserCommand(uid, name = "") {
  // Field names below are the ones confirmed against real ZKTeco firmware.
  return [
    `DATA UPDATE USERINFO PIN=${uid}`,
    `Name=${name}`,
    `Privilege=0`,
    `Passwd=`,
    `Card=`,
  ].join("\t");
}

export function buildTemplateCommand({ uid, fingerId, size, valid, template }) {
  return [
    `DATA UPDATE FINGERTMP PIN=${uid}`,
    `FID=${fingerId}`,
    `Size=${size}`,
    `Valid=${valid}`,
    `TMP=${template}`,
  ].join("\t");
}

/** Queue one command on every registered device of a gym. */
export async function queueCommandForGym(supabase, gymId, commandString) {
  const { data: devices, error } = await supabase
    .from("biometric_devices")
    .select("device_sn")
    .eq("gym_id", gymId);

  if (error || !devices || devices.length === 0) return 0;

  const rows = devices.map((d) => ({
    gym_id: gymId,
    device_sn: d.device_sn,
    command_string: commandString,
    status: "PENDING",
  }));

  const { error: insErr } = await supabase
    .from("biometric_device_commands")
    .insert(rows);

  if (insErr) throw new Error(insErr.message);
  return rows.length;
}

/** Do we hold a usable backup of this member's finger? */
export async function hasStoredTemplates(supabase, gymId, uid) {
  if (!uid) return false;
  const { count } = await supabase
    .from("biometric_templates")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .eq("biometric_uid", String(uid));
  return (count || 0) > 0;
}

/**
 * Stop a member opening the gate by removing their user record from every
 * scanner. Their finger stays backed up on the server.
 */
export async function blockMemberOnDevices(supabase, gymId, member, { force = false } = {}) {
  const uid = member?.biometric_uid;
  if (!uid) return { queued: 0, reason: "no_uid" };
  if (member.biometric_blocked && !force) return { queued: 0, reason: "already_blocked" };

  const backedUp = await hasStoredTemplates(supabase, gymId, uid);
  const queued = await queueCommandForGym(supabase, gymId, buildDeleteUserCommand(uid));

  if (member.id) {
    await supabase
      .from("members")
      .update({ biometric_blocked: true, biometric_blocked_at: new Date().toISOString() })
      .eq("id", member.id);
  }

  return { queued, reason: "blocked", backedUp };
}

/**
 * Restore access on renewal: re-create the user, then push back every saved
 * finger. Returns needsReEnroll when the finger has to be put on the machine
 * again, so the UI can say so instead of leaving the member locked out without
 * explanation.
 *
 * Two ways that happens:
 *   - the gym is set to 'delete' mode, i.e. it wants a fresh enrollment
 *   - no template was ever captured from this device to restore from
 */
export async function unblockMemberOnDevices(supabase, gymId, member) {
  const uid = member?.biometric_uid;

  if (member?.id) {
    await supabase
      .from("members")
      .update({ biometric_blocked: false, biometric_blocked_at: null })
      .eq("id", member.id);
  }

  if (!uid) return { queued: 0, needsReEnroll: false, reason: "no_uid" };

  const { data: gym } = await supabase
    .from("gyms")
    .select("biometric_block_mode")
    .eq("id", gymId)
    .maybeSingle();

  if (gym?.biometric_block_mode === "delete") {
    return { queued: 0, needsReEnroll: true, reason: "reenroll_mode" };
  }

  const { data: templates } = await supabase
    .from("biometric_templates")
    .select("finger_id, template_size, is_valid, template_data")
    .eq("gym_id", gymId)
    .eq("biometric_uid", String(uid));

  if (!templates || templates.length === 0) {
    return { queued: 0, needsReEnroll: true, reason: "no_template_backup" };
  }

  // Re-create the user first, then attach each finger.
  let queued = await queueCommandForGym(
    supabase,
    gymId,
    buildCreateUserCommand(uid, member.full_name || ""),
  );

  for (const t of templates) {
    queued += await queueCommandForGym(
      supabase,
      gymId,
      buildTemplateCommand({
        uid,
        fingerId: t.finger_id,
        size: t.template_size,
        valid: t.is_valid,
        template: t.template_data,
      }),
    );
  }

  return { queued, needsReEnroll: false, fingers: templates.length };
}
