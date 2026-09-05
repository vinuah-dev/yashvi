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

// Access groups on the device decide whether a matched finger actually opens
// the gate. Group 1 is the default group that has access; group 2 must be
// configured on the scanner with no valid time zone, so anyone moved into it is
// recognised but refused.
//
// This is the only way to withhold access WITHOUT wiping the enrolled finger,
// which is why it is preferred over deleting: renewal is one command, and no
// template backup is needed.
export const ACTIVE_GROUP = 1;
export const BLOCKED_GROUP = 2;

/**
 * Move a user between access groups.
 *
 * Passwd and Card are deliberately not sent: this gym identifies by finger, and
 * including them empty risks clearing a card on firmwares that treat a present
 * field as an overwrite.
 */
export function buildSetGroupCommand(uid, name = "", group = ACTIVE_GROUP) {
  return [
    `DATA UPDATE USERINFO PIN=${uid}`,
    `Name=${name}`,
    `Pri=0`,
    `Grp=${group}`,
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
 * How this gym withholds access:
 *   'group'  move the user into the no-access group, finger left untouched
 *   others   remove the user record from the scanner
 *
 * Defaults to 'group' because it is the only option that survives a renewal
 * without re-enrollment on devices that never upload their templates.
 */
export async function getBlockMode(supabase, gymId) {
  const { data } = await supabase
    .from("gyms")
    .select("biometric_block_mode")
    .eq("id", gymId)
    .maybeSingle();

  return data?.biometric_block_mode || "group";
}

/**
 * Stop someone opening the gate. Shared by members and trainers — it only
 * touches the device, the caller does its own bookkeeping.
 */
export async function blockUidOnDevices(supabase, gymId, uid, name = "", mode) {
  if (!uid) return { queued: 0, reason: "no_uid" };

  const blockMode = mode || (await getBlockMode(supabase, gymId));

  const command =
    blockMode === "group"
      ? buildSetGroupCommand(uid, name, BLOCKED_GROUP)
      : buildDeleteUserCommand(uid);

  const queued = await queueCommandForGym(supabase, gymId, command);

  // Only meaningful when the finger is being wiped; group mode leaves it alone.
  const backedUp =
    blockMode === "group" ? true : await hasStoredTemplates(supabase, gymId, uid);

  return { queued, reason: "blocked", backedUp, mode: blockMode };
}

/**
 * Stop a member opening the gate, and record that we did.
 */
export async function blockMemberOnDevices(supabase, gymId, member, { force = false } = {}) {
  const uid = member?.biometric_uid;
  if (!uid) return { queued: 0, reason: "no_uid" };
  if (member.biometric_blocked && !force) return { queued: 0, reason: "already_blocked" };

  const result = await blockUidOnDevices(supabase, gymId, uid, member.full_name || "");

  if (member.id) {
    await supabase
      .from("members")
      .update({ biometric_blocked: true, biometric_blocked_at: new Date().toISOString() })
      .eq("id", member.id);
  }

  return result;
}

/**
 * Push a UID back onto every scanner: re-create the user record, then attach
 * each backed-up finger.
 *
 * Works off the UID alone so members and trainers share it — the difference
 * between them is only the bookkeeping in their own table.
 *
 * Returns needsReEnroll when nothing was ever captured to restore from, so the
 * caller can say "put the finger on the machine again" instead of leaving
 * someone locked out with no explanation.
 */
export async function restoreUidOnDevices(supabase, gymId, uid, name = "", mode) {
  if (!uid) return { queued: 0, needsReEnroll: false, reason: "no_uid" };

  const blockMode = mode || (await getBlockMode(supabase, gymId));

  // Group mode never wiped the finger, so giving access back is a single
  // command and there is nothing to re-enroll.
  if (blockMode === "group") {
    const queued = await queueCommandForGym(
      supabase,
      gymId,
      buildSetGroupCommand(uid, name, ACTIVE_GROUP),
    );
    return { queued, needsReEnroll: false, reason: "group_restored" };
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
    buildCreateUserCommand(uid, name),
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

/**
 * Restore a member on renewal.
 *
 * needsReEnroll comes back when the finger has to be put on the machine again,
 * which happens two ways:
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

  const blockMode = await getBlockMode(supabase, gymId);

  // 'delete' is the deliberate "take the finger again on the machine" setting.
  if (blockMode === "delete") {
    return { queued: 0, needsReEnroll: true, reason: "reenroll_mode" };
  }

  return restoreUidOnDevices(supabase, gymId, uid, member.full_name || "", blockMode);
}
