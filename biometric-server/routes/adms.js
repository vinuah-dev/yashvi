/**
 * ADMS Protocol Routes
 * Handles communication with eSSL F22 Biometric Device
 * 
 * MULTI-GYM SYSTEM:
 * - Device SN → gym_id mapping
 * - Member lookup with membership status
 * - All attendance is tagged with gym_id
 */

import { supabase } from '../utils/supabaseClient.js';

// ============================================
// MULTI-GYM SUPPORT: Device Cache
// Caches device SN → gym_id mapping to reduce DB lookups
// ============================================
const deviceCache = new Map();
const DEVICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * CRITICAL FUNCTION: Get gym_id from device serial number
 * This is the ONLY source of truth for gym_id mapping
 * gym_id is NEVER sent by the device or frontend
 * 
 * @param {string} deviceSN - Device serial number from ADMS protocol
 * @param {object} logger - Fastify logger instance
 * @returns {Promise<{gym_id: string|null, device_id: string|null, error: string|null}>}
 */
async function getGymFromDeviceSN(deviceSN, logger) {
  // Check cache first for performance
  const cached = deviceCache.get(deviceSN);
  if (cached && (Date.now() - cached.timestamp < DEVICE_CACHE_TTL)) {
    return { gym_id: cached.gym_id, device_id: cached.device_id, error: null };
  }
  
  try {
    // Query device from database (no is_active column in your schema)
    const { data, error } = await supabase
      .from('biometric_devices')
      .select('id, gym_id, device_sn')
      .eq('device_sn', deviceSN)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows - device not registered
        logger.warn({
          msg: '⚠️ UNKNOWN DEVICE - Not registered in system',
          deviceSN,
          action: 'Register this device in Supabase: INSERT INTO biometric_devices (gym_id, device_sn, location) VALUES (...)'
        });
        return { gym_id: null, device_id: null, error: 'DEVICE_NOT_REGISTERED' };
      }
      logger.error({ msg: 'Database error looking up device', error });
      return { gym_id: null, device_id: null, error: 'DATABASE_ERROR' };
    }
    
    // Update last_seen_at (async, don't wait)
    supabase
      .from('biometric_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', data.id)
      .then(() => {});
    
    // Cache the result
    deviceCache.set(deviceSN, {
      gym_id: data.gym_id,
      device_id: data.id,
      timestamp: Date.now()
    });
    
    return { gym_id: data.gym_id, device_id: data.id, error: null };
    
  } catch (err) {
    logger.error({ msg: 'Exception in getGymFromDeviceSN', error: err.message });
    return { gym_id: null, device_id: null, error: 'EXCEPTION' };
  }
}

/**
 * Get member info and check membership status
 * Uses your existing schema: members table + memberships table
 * 
 * @param {string} gymId - Gym UUID
 * @param {string} fingerprintId - PIN from biometric device
 * @param {object} logger - Fastify logger
 * @returns {Promise<{member_id: string|null, membership_status: string, member_name: string|null}>}
 */
async function getMemberInfo(gymId, fingerprintId, logger) {
  try {
    // Simplified flow: the F22 User ID (fingerprintId) is stored directly on the
    // member as members.biometric_uid. Look the member up by that UID + gym.
    // (No biometric_member_map indirection.)
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, full_name')
      .eq('gym_id', gymId)
      .eq('biometric_uid', String(fingerprintId))
      .single();

    if (memberError || !member) {
      logger.info({
        msg: 'No member found with this biometric_uid',
        gymId,
        biometric_uid: fingerprintId
      });
      return { member_id: null, membership_status: 'UNKNOWN_MEMBER', member_name: null };
    }
    
    // Step 2: Check membership status from memberships table
    const today = new Date().toISOString().split('T')[0];
    
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id, status, end_date')
      .eq('member_id', member.id)
      .order('end_date', { ascending: false })
      .limit(1)
      .single();
    
    let membership_status = 'NO_MEMBERSHIP';
    
    if (membership) {
      // Check if membership is expired by date
      if (membership.end_date < today) {
        membership_status = 'EXPIRED';
        logger.warn({
          msg: '⚠️ EXPIRED MEMBERSHIP CHECK-IN',
          member_name: member.full_name,
          member_id: member.id,
          membership_end: membership.end_date,
          fingerprintId
        });
      } else if (membership.status === 'active') {
        membership_status = 'ACTIVE';
      } else if (membership.status === 'expired') {
        membership_status = 'EXPIRED';
      } else if (membership.status === 'cancelled') {
        membership_status = 'CANCELLED';
      }
    }
    
    return {
      member_id: member.id,
      membership_status,
      member_name: member.full_name,
      membership_end: membership?.end_date || null,
    };
    
  } catch (err) {
    logger.error({ msg: 'Exception in getMemberInfo', error: err.message });
    return { member_id: null, membership_status: 'ERROR' };
  }
}

/**
 * Get trainer info by biometric UID.
 * Trainers punch on the same device as members. Their F22 User ID lives on
 * profiles.biometric_uid, and gym_trainers links that profile to this gym.
 *
 * Only called when a punch did NOT match any member, so member behaviour
 * is completely unchanged.
 *
 * @param {string} gymId - Gym UUID (from device SN)
 * @param {string} fingerprintId - PIN / User ID from the device
 * @param {object} logger - Fastify logger
 * @returns {Promise<{trainer_id: string|null, trainer_name: string|null}>}
 */
async function getTrainerInfo(gymId, fingerprintId, logger) {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('biometric_uid', String(fingerprintId))
      .maybeSingle();

    if (profileError || !profile) {
      return { trainer_id: null, trainer_name: null };
    }

    // Confirm this profile is actually a trainer at THIS gym.
    // Without this check a trainer from gym A could punch on gym B's device.
    const { data: link, error: linkError } = await supabase
      .from('gym_trainers')
      .select('id')
      .eq('gym_id', gymId)
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (linkError || !link) {
      logger.warn({
        msg: 'Biometric UID belongs to a profile that is not a trainer of this gym',
        gymId,
        biometric_uid: fingerprintId
      });
      return { trainer_id: null, trainer_name: null };
    }

    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    return { trainer_id: profile.id, trainer_name: name || 'Trainer' };

  } catch (err) {
    logger.error({ msg: 'Exception in getTrainerInfo', error: err.message });
    return { trainer_id: null, trainer_name: null };
  }
}

/**
 * An expired member can still open the gate, because the F22 matches the
 * fingerprint locally and only tells the server afterwards. So when an expired
 * punch arrives we queue a delete of that user record on every device of the
 * gym — the next attempt then finds no match and the gate stays shut.
 *
 * The member row is flagged so we queue this only once per expiry.
 */
async function blockExpiredMemberOnDevices(gymId, memberId, expiryDate, logger) {
  try {
    const { data: member } = await supabase
      .from('members')
      .select('id, full_name, biometric_uid, biometric_blocked')
      .eq('id', memberId)
      .maybeSingle();

    if (!member || !member.biometric_uid) return;
    if (member.biometric_blocked) return; // already queued

    // Gyms give members a buffer after expiry to come and pay. Access is only
    // withdrawn once that buffer has run out.
    const { data: gym } = await supabase
      .from('gyms')
      .select('biometric_grace_days, biometric_block_mode')
      .eq('id', gymId)
      .maybeSingle();

    const graceDaysRaw = Number(gym?.biometric_grace_days);
    const graceDays = Number.isFinite(graceDaysRaw) && graceDaysRaw >= 0 ? graceDaysRaw : 7;
    const blockMode = gym?.biometric_block_mode === 'delete' ? 'delete' : 'disable';

    if (expiryDate) {
      const cutoff = new Date(expiryDate);
      cutoff.setDate(cutoff.getDate() + graceDays);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      cutoff.setHours(0, 0, 0, 0);

      if (today <= cutoff) {
        logger.info({
          msg: '⏳ Expired member still inside buffer period — access left open',
          memberId,
          expiryDate,
          graceDays,
        });
        return;
      }
    }

    const { data: devices } = await supabase
      .from('biometric_devices')
      .select('device_sn')
      .eq('gym_id', gymId);

    if (!devices || devices.length === 0) return;

    // Removing the user record is the only command every eSSL firmware
    // honours. There is no Enabled/Disabled field in the ADMS USERINFO set —
    // that bit only exists in the binary SDK on port 4370 — so an "update the
    // user and hope the device refuses them" command is accepted with
    // Return=0 and changes nothing, leaving the gate open for an expired
    // member who shows as blocked in the dashboard.
    //
    // blockMode therefore decides what happens on RENEWAL, not now:
    //   'disable' -> the saved fingerprint is pushed back, no re-enrollment
    //   'delete'  -> staff enrolls the finger again on the machine
    const commandString = `DATA DELETE USERINFO PIN=${member.biometric_uid}`;

    // Only meaningful for 'disable'. Recorded so staff can be warned at
    // renewal time instead of discovering it at the gate.
    const { count: templateCount } = await supabase
      .from('biometric_templates')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('biometric_uid', String(member.biometric_uid));

    const hasBackup = (templateCount || 0) > 0;

    if (blockMode === 'disable' && !hasBackup) {
      logger.warn({
        msg: '⚠️ No fingerprint backup for this member — renewal will need re-enrollment',
        memberId,
        biometric_uid: member.biometric_uid,
        hint: 'Check /settings/biometric-diagnostics to see whether this device uploads templates',
      });
    }

    const rows = devices.map((d) => ({
      gym_id: gymId,
      device_sn: d.device_sn,
      command_string: commandString,
      status: 'PENDING',
    }));

    const { error: insErr } = await supabase
      .from('biometric_device_commands')
      .insert(rows);

    if (insErr) {
      logger.error({ msg: 'Failed to queue expiry block command', error: insErr.message });
      return;
    }

    await supabase
      .from('members')
      .update({ biometric_blocked: true, biometric_blocked_at: new Date().toISOString() })
      .eq('id', member.id);

    logger.warn({
      msg: '🚫 Buffer period over — member access withdrawn on devices',
      memberId,
      biometric_uid: member.biometric_uid,
      mode: blockMode,
      devices: rows.length,
      restoreOnRenewal: blockMode === 'disable' && hasBackup,
    });
  } catch (e) {
    logger.error({ msg: 'Exception in blockExpiredMemberOnDevices', error: e.message });
  }
}

/**
 * Devices push more than attendance to /iclock/cdata and /iclock/fdata:
 * user records (USERINFO) and, on firmwares that support it, the enrolled
 * fingerprint templates (FINGERTMP / "FP" lines).
 *
 * Templates are the important part. Blocking a member means deleting their
 * user record from the scanner (the only command every firmware honours), so
 * without a stored copy of the finger they'd have to be re-enrolled on
 * renewal. With a copy, we just push it back.
 *
 * Everything is also written to `biometric_device_logs` so the diagnostic
 * screen can show whether this particular device uploads templates at all.
 */
async function captureNonAttendancePush({ gymId, deviceSN, endpoint, tableType, body, logger }) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body || '');

  // Keep a bounded copy for diagnostics — templates can be a few KB each.
  try {
    await supabase.from('biometric_device_logs').insert({
      gym_id: gymId || null,
      device_sn: deviceSN,
      endpoint,
      table_name: tableType || null,
      raw_body: raw.slice(0, 8000),
    });
  } catch (e) {
    logger.error({ msg: 'Failed to record device push', error: e.message });
  }

  const templates = parseFingerprintTemplates(raw);
  if (templates.length === 0) {
    logger.info({ msg: 'Device push stored (no templates in it)', deviceSN, table: tableType });
    return;
  }

  if (!gymId) {
    logger.warn({ msg: 'Templates received from unregistered device', deviceSN });
    return;
  }

  let saved = 0;
  for (const t of templates) {
    try {
      const { error } = await supabase
        .from('biometric_templates')
        .upsert(
          {
            gym_id: gymId,
            biometric_uid: String(t.pin),
            finger_id: t.fid,
            template_size: t.size,
            is_valid: t.valid,
            template_data: t.template,
            device_sn: deviceSN,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'gym_id,biometric_uid,finger_id' },
        );
      if (!error) saved += 1;
      else logger.error({ msg: 'Template save failed', error: error.message, pin: t.pin });
    } catch (e) {
      logger.error({ msg: 'Template save exception', error: e.message });
    }
  }

  logger.info({ msg: '🔒 Fingerprint templates backed up', deviceSN, count: saved });
}

/**
 * Pull fingerprint templates out of a device push.
 *
 * Firmwares differ in how they label these lines, so both the "FP " prefix and
 * the bare tab-separated form are accepted:
 *   FP PIN=9\tFID=0\tSize=1024\tValid=1\tTMP=<base64>
 */
function parseFingerprintTemplates(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const out = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!/TMP=/i.test(trimmed)) continue; // templates always carry TMP=

    const fields = {};
    // TMP is base64 and may contain '=' padding, so it's read to end of line.
    const tmpMatch = trimmed.match(/TMP=(.*)$/i);
    const head = tmpMatch ? trimmed.slice(0, tmpMatch.index) : trimmed;

    for (const part of head.split(/[\t\s]+/)) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      fields[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }

    const pin = fields.PIN;
    const template = tmpMatch ? tmpMatch[1].trim() : '';
    if (!pin || !template) continue;

    out.push({
      pin,
      fid: Number.isFinite(Number(fields.FID)) ? Number(fields.FID) : 0,
      size: Number.isFinite(Number(fields.SIZE)) ? Number(fields.SIZE) : template.length,
      valid: Number.isFinite(Number(fields.VALID)) ? Number(fields.VALID) : 1,
      template,
    });
  }

  return out;
}

/**
 * Write a trainer punch into the `trainer_attendance` table.
 *
 * Rule (as requested):
 *   - FIRST punch of the day  -> that is the trainer's LOGIN  (check_in_time)
 *   - EVERY later punch       -> overwrites the LOGOUT        (check_out_time)
 *
 * So the last punch of the day always ends up as the logout time, and the
 * value keeps moving forward as the trainer punches again. Session 1 is used
 * for the whole day so a single row holds first-in / last-out.
 */
async function updateTrainerAttendance({ gym_id, trainer_id, timestamp }, logger) {
  if (!trainer_id) return;

  try {
    const dt = new Date(timestamp);
    const dateStr = dt.toISOString().split('T')[0];
    const timeStr = dt.toTimeString().split(' ')[0]; // HH:MM:SS local

    const { data: existing, error: fetchErr } = await supabase
      .from('trainer_attendance')
      .select('id, check_in_time, check_out_time')
      .eq('gym_id', gym_id)
      .eq('trainer_id', trainer_id)
      .eq('attendance_date', dateStr)
      .eq('session_number', 1)
      .maybeSingle();

    if (fetchErr) {
      logger.error({ msg: 'Trainer attendance fetch error', error: fetchErr });
      return;
    }

    if (!existing) {
      // First punch today = login. No logout yet.
      const { error: insertErr } = await supabase
        .from('trainer_attendance')
        .insert({
          gym_id,
          trainer_id,
          attendance_date: dateStr,
          session_number: 1,
          check_in_time: timeStr,
          notes: 'Biometric punch',
        });

      if (insertErr) {
        logger.error({ msg: 'Trainer attendance insert error', error: insertErr });
      } else {
        logger.info({ msg: '✅ Trainer LOGIN recorded', trainer_id, time: timeStr });
      }
      return;
    }

    // Already checked in today — this punch becomes the (new) logout time.
    // Guard against a clock/ordering glitch pushing logout before login.
    if (existing.check_in_time && timeStr < existing.check_in_time) {
      const { error: earlyErr } = await supabase
        .from('trainer_attendance')
        .update({ check_in_time: timeStr })
        .eq('id', existing.id);

      if (earlyErr) logger.error({ msg: 'Trainer earlier check-in update error', error: earlyErr });
      return;
    }

    const { error: updErr } = await supabase
      .from('trainer_attendance')
      .update({ check_out_time: timeStr })
      .eq('id', existing.id);

    if (updErr) {
      logger.error({ msg: 'Trainer attendance checkout update error', error: updErr });
    } else {
      logger.info({ msg: '🔁 Trainer LOGOUT moved forward', trainer_id, time: timeStr });
    }

  } catch (e) {
    logger.error({ msg: 'Exception in updateTrainerAttendance', error: e.message });
  }
}

/**
 * Parse ADMS attendance data from various formats
 * eSSL devices can send data in multiple formats
 */
function parseAttendanceData(body, query) {
  const records = [];
  
  // Format 1: Body contains attendance lines (most common)
  // Example: "1\t2026-01-10 09:30:00\t0\t1\t\t\t"
  if (body && typeof body === 'string') {
    const lines = body.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        records.push({
          user_id: parts[0]?.trim() || 'UNKNOWN',
          timestamp: parts[1]?.trim() || new Date().toISOString(),
          status: parseStatus(parts[2]?.trim()),
          verify_type: parts[3]?.trim() || '0',
          work_code: parts[4]?.trim() || '',
        });
      }
    }
  }
  
  // Format 2: Query parameters contain single record
  // Example: ?SN=ABC123&PIN=1&Time=2026-01-10 09:30:00&Status=0
  if (query.PIN || query.pin) {
    records.push({
      user_id: query.PIN || query.pin || 'UNKNOWN',
      timestamp: query.Time || query.time || new Date().toISOString(),
      status: parseStatus(query.Status || query.status),
      verify_type: query.Verify || query.verify || '0',
      work_code: query.WorkCode || query.workcode || '',
    });
  }
  
  // Format 3: ATTLOG format in body
  // Example: ATTLOG PIN=1\tTime=2026-01-10 09:30:00\tStatus=0
  if (body && typeof body === 'string' && body.includes('ATTLOG')) {
    const attlogMatch = body.match(/PIN=(\d+)\s+Time=([^\s]+\s+[^\s]+)\s+Status=(\d+)/gi);
    if (attlogMatch) {
      for (const match of attlogMatch) {
        const pinMatch = match.match(/PIN=(\d+)/i);
        const timeMatch = match.match(/Time=([^\s]+\s+[^\s]+)/i);
        const statusMatch = match.match(/Status=(\d+)/i);
        
        if (pinMatch && timeMatch) {
          records.push({
            user_id: pinMatch[1],
            timestamp: timeMatch[1],
            status: parseStatus(statusMatch?.[1]),
            verify_type: '0',
            work_code: '',
          });
        }
      }
    }
  }
  
  return records;
}

/**
 * Parse attendance status code
 * 0 = Check-In, 1 = Check-Out, 2 = Break-Out, 3 = Break-In, etc.
 */
function parseStatus(statusCode) {
  const statusMap = {
    '0': 'CHECK_IN',
    '1': 'CHECK_OUT',
    '2': 'BREAK_OUT',
    '3': 'BREAK_IN',
    '4': 'OVERTIME_IN',
    '5': 'OVERTIME_OUT',
  };
  return statusMap[statusCode] || 'CHECK_IN';
}

/**
 * Pull command results out of a /iclock/devicecmd confirmation.
 *
 * The device replies with  ID=<n>&Return=<code>&CMD=<cmd>  and is allowed to
 * batch several of them, one per line. ID is the numeric cmd_no we handed out
 * in the C:<ID>:<COMMAND> reply.
 *
 * Some firmwares put the fields in the query string instead of the body, so
 * both are checked.
 */
function parseCommandResults(body, query) {
  const results = [];
  const seen = new Set();

  const push = (idRaw, retRaw) => {
    const cmdNo = Number(idRaw);
    if (!Number.isFinite(cmdNo) || seen.has(cmdNo)) return;
    seen.add(cmdNo);
    const returnCode = retRaw === undefined || retRaw === null || retRaw === ''
      ? null
      : Number(retRaw);
    results.push({
      cmdNo,
      returnCode: Number.isFinite(returnCode) ? returnCode : null,
    });
  };

  if (body && typeof body === 'string') {
    for (const line of body.split(/[\r\n]+/)) {
      if (!line.trim()) continue;
      const idMatch = line.match(/\bID=(\d+)/i);
      if (!idMatch) continue;
      const retMatch = line.match(/\bReturn=(-?\d+)/i);
      push(idMatch[1], retMatch ? retMatch[1] : null);
    }
  }

  // Fallback: fields carried as query parameters.
  if (results.length === 0 && query) {
    const id = query.ID ?? query.id;
    if (id !== undefined) push(id, query.Return ?? query.return ?? null);
  }

  return results;
}

/**
 * Get device serial number from request
 */
function getDeviceSN(query) {
  return query.SN || query.sn || query.SerialNumber || 'UNKNOWN';
}

/**
 * Update daily attendance summary table used by the web app
 * Writes to your existing `attendance` table:
 * - CHECK_IN: create or increment today's record
 * - CHECK_OUT: set check_out_time for today's record
 * - ALWAYS: Store membership_status (ACTIVE, EXPIRED, etc.)
 */
async function updateDailyAttendance({ gym_id, member_id, status, timestamp, membership_status }, logger) {
  if (!member_id) return; // skip unknown members

  try {
    const dt = new Date(timestamp);
    const dateStr = dt.toISOString().split('T')[0];
    const timeStr = dt.toTimeString().split(' ')[0]; // HH:MM:SS local

    // Fetch today's attendance row
    const { data: existing, error: fetchErr } = await supabase
      .from('attendance')
      .select('id, count, check_in_time, check_out_time')
      .eq('gym_id', gym_id)
      .eq('member_id', member_id)
      .eq('check_in_date', dateStr)
      .maybeSingle();

    if (fetchErr) {
      logger.error({ msg: 'Attendance fetch error', error: fetchErr });
      return;
    }

    if (status === 'CHECK_IN') {
      if (!existing) {
        // First check-in of the day
        const insertData = {
          gym_id,
          member_id,
          check_in_date: dateStr,
          check_in_time: timeStr,
          count: 1,
          membership_status: membership_status || 'ACTIVE',
        };
        let { error: insertErr } = await supabase.from('attendance').insert(insertData);
        if (isMissingMembershipStatusColumn(insertErr)) {
          delete insertData.membership_status;
          ({ error: insertErr } = await supabase.from('attendance').insert(insertData));
        }
        if (insertErr) logger.error({ msg: 'Attendance insert error', error: insertErr });
      } else {
        // Subsequent check-in: increment count, keep earliest check_in_time, update membership_status
        const updateData = {
          count: (existing.count || 1) + 1,
          membership_status: membership_status || 'ACTIVE',
        };
        let { error: updErr } = await supabase.from('attendance').update(updateData).eq('id', existing.id);
        if (isMissingMembershipStatusColumn(updErr)) {
          delete updateData.membership_status;
          ({ error: updErr } = await supabase.from('attendance').update(updateData).eq('id', existing.id));
        }
        if (updErr) logger.error({ msg: 'Attendance update error', error: updErr });
      }
    } else if (status === 'CHECK_OUT') {
      if (!existing) {
        // No prior check-in; create a row and set check_out_time
        const insertData = {
          gym_id,
          member_id,
          check_in_date: dateStr,
          check_in_time: timeStr,
          check_out_time: timeStr,
          count: 1,
          membership_status: membership_status || 'ACTIVE',
        };
        let { error: insertErr } = await supabase.from('attendance').insert(insertData);
        if (isMissingMembershipStatusColumn(insertErr)) {
          delete insertData.membership_status;
          ({ error: insertErr } = await supabase.from('attendance').insert(insertData));
        }
        if (insertErr) logger.error({ msg: 'Attendance insert (checkout) error', error: insertErr });
      } else {
        // Update today's record with checkout time and membership status
        const updateData = {
          check_out_time: timeStr,
          membership_status: membership_status || 'ACTIVE',
        };
        let { error: updErr } = await supabase.from('attendance').update(updateData).eq('id', existing.id);
        if (isMissingMembershipStatusColumn(updErr)) {
          delete updateData.membership_status;
          ({ error: updErr } = await supabase.from('attendance').update(updateData).eq('id', existing.id));
        }
        if (updErr) logger.error({ msg: 'Attendance checkout update error', error: updErr });
      }
    }
  } catch (e) {
    logger.error({ msg: 'Exception in updateDailyAttendance', error: e.message });
  }
}

function isMissingMembershipStatusColumn(error) {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return message.includes('membership_status') && message.includes('column');
}

export default async function admsRoutes(fastify, options) {
  
  /**
   * POST /iclock/cdata
   * Receive attendance punches from the biometric device
   * 
   * MULTI-GYM FLOW:
   * 1. Extract device SN from query params
   * 2. Lookup gym_id from devices table
   * 3. Lookup member info and membership status
   * 4. Save attendance with gym_id attached
   * 5. ALWAYS return 200 OK (never block device)
   */
  const handleCdataPost = async (request, reply) => {
    const startTime = Date.now();
    
    try {
      const { query, body } = request;
      const deviceSN = getDeviceSN(query);
      
      fastify.log.info({
        msg: '📥 Attendance data received',
        deviceSN,
        query,
        bodyType: typeof body,
        bodyLength: typeof body === 'string' ? body.length : 0
      });
      
      // ============================================
      // STEP 1: Get gym_id from device serial number
      // This is the ONLY way we determine gym_id
      // ============================================
      const { gym_id, device_id, error: deviceError } = await getGymFromDeviceSN(deviceSN, fastify.log);
      
      if (!gym_id) {
        fastify.log.warn({
          msg: '❌ Device not registered - attendance NOT saved',
          deviceSN,
          error: deviceError,
          action: 'Register this device in the devices table'
        });
        // IMPORTANT: Return OK so device doesn't block/retry
        // Attendance data is lost but device continues working
        return reply.code(200).send('OK');
      }
      
      // ============================================
      // STEP 2: Parse attendance records
      // ============================================
      // The device posts several log types to this same endpoint
      // (ATTLOG = punches, OPERLOG = device operations, etc).
      // Only ATTLOG rows are attendance; ignore the rest.
      const tableType = String(query?.table || query?.TABLE || '').toUpperCase();
      if (tableType && tableType !== 'ATTLOG') {
        // Not attendance — but it may be fingerprint templates or user records,
        // which we want to keep so a blocked member can be restored later
        // without re-enrolling. Everything else is recorded for diagnostics.
        await captureNonAttendancePush({
          gymId: gym_id,
          deviceSN,
          endpoint: 'cdata',
          tableType,
          body,
          logger: fastify.log,
        });
        return reply.code(200).send('OK');
      }

      const records = parseAttendanceData(body, query);
      
      if (records.length === 0) {
        fastify.log.warn('No attendance records parsed from request');
        return reply.code(200).send('OK');
      }
      
      // ============================================
      // STEP 3: Process each record with member lookup
      // ============================================
      const dbRecords = [];
      
      for (const record of records) {
        // Lookup member and check membership status
        const { member_id, membership_status, member_name, membership_end } = await getMemberInfo(
          gym_id, 
          record.user_id, 
          fastify.log
        );
        
        const recordTimestamp = new Date(record.timestamp).toISOString();

        // An expired member just opened the gate locally. Queue removal of
        // their user record so the next attempt is refused by the device.
        if (member_id && (membership_status === 'EXPIRED' || membership_status === 'CANCELLED')) {
          await blockExpiredMemberOnDevices(gym_id, member_id, membership_end, fastify.log);
        }

        // If the UID did not match a member, it may belong to a trainer.
        // Members are always checked first, so member behaviour is unchanged.
        let trainer_id = null;
        let trainer_name = null;
        if (!member_id) {
          ({ trainer_id, trainer_name } = await getTrainerInfo(
            gym_id,
            record.user_id,
            fastify.log
          ));
        }

        dbRecords.push({
          gym_id: gym_id,                    // From device lookup
          user_id: record.user_id,           // Fingerprint PIN
          device_sn: deviceSN,
          member_id: member_id,              // Linked member UUID (nullable)
          timestamp: recordTimestamp,        // Full timestamp (date is derived from this)
          status: record.status,
          membership_status: trainer_id ? 'TRAINER' : membership_status,
          raw_data: {
            verify_type: record.verify_type,
            work_code: record.work_code,
            original_query: query,
            received_at: new Date().toISOString(),
            device_id: device_id,
            member_name: member_name || null,
            trainer_id: trainer_id || null,
            trainer_name: trainer_name || null,
            punch_type: member_id ? 'MEMBER' : (trainer_id ? 'TRAINER' : 'UNKNOWN')
          }
        });
      }
      
      // ============================================
      // STEP 4: Insert into Supabase
      // ============================================
      const { data, error } = await supabase
        .from('biometric_attendance_logs')
        .insert(dbRecords)
        .select();
      
      if (error) {
        fastify.log.error({
          msg: 'Supabase insert error',
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
          attemptedColumns: Object.keys(dbRecords[0] || {}).join(', ')
        });
        return reply.code(200).send('OK');
      }
      
      // Log success with membership warnings
      const expiredCount = dbRecords.filter(r => r.membership_status === 'EXPIRED').length;
      fastify.log.info({
        msg: '✅ Attendance saved',
        gym_id,
        deviceSN,
        count: dbRecords.length,
        expiredMemberships: expiredCount,
        duration: `${Date.now() - startTime}ms`
      });

      // ============================================
      // STEP 5: Update daily attendance summary table
      // So the Next.js /attendance view reflects real-time entries
      // ============================================
      for (const r of dbRecords) {
        // The `attendance` summary table requires a member_id, so unmatched
        // punches (biometric_uid not linked to any member) are kept in the raw
        // log only. Skipping them here avoids a NOT NULL violation.
        if (!r.member_id) {
          const trainerId = r.raw_data?.trainer_id;

          if (trainerId) {
            // Trainer punch — first punch = login, every later punch = logout
            await updateTrainerAttendance({
              gym_id: r.gym_id,
              trainer_id: trainerId,
              timestamp: r.timestamp,
            }, fastify.log);
            continue;
          }

          fastify.log.warn({
            msg: 'Punch not linked to any member or trainer — raw log only',
            user_id: r.user_id,
            device_sn: r.device_sn,
            hint: 'Set this User ID as the member\'s Biometric User ID, or the trainer\'s Biometric User ID in the app'
          });
          continue;
        }

        await updateDailyAttendance({
          gym_id: r.gym_id,
          member_id: r.member_id,
          status: r.status,
          timestamp: r.timestamp,
          membership_status: r.membership_status, // Now pass membership status
        }, fastify.log);
      }
      
      return reply.code(200).send('OK');
      
    } catch (error) {
      fastify.log.error({ msg: 'Error processing attendance', error: error.message });
      return reply.code(200).send('OK');
    }
  };
  
  /**
   * GET /iclock/cdata
   * Some devices use GET for handshake/initialization
   */
  const handleCdataGet = async (request, reply) => {
    const { query } = request;
    const deviceSN = getDeviceSN(query);
    
    fastify.log.info({
      msg: 'Device handshake/init',
      deviceSN,
      query
    });
    
    // Return device initialization parameters
    // These tell the device how to communicate
    const response = [
      `GET OPTION FROM: ${deviceSN}`,
      'Stamp=9999',
      'OpStamp=9999',
      'PhotoStamp=9999',
      'ErrorDelay=60',
      'Delay=30',
      'TransTimes=00:00;23:59',
      'TransInterval=1',
      'TransFlag=1111000000',
      'Realtime=1',
      'TimeZone=5.5', // IST timezone
      'ATTLOGStamp=0',
      'OPERLOGStamp=0',
      'ATTPHOTOStamp=0',
    ].join('\n');
    
    return reply.code(200).send(response);
  };
  
  /**
   * GET /iclock/getrequest
   * Device polls this URL to check for pending commands
   * MULTI-GYM: Filters commands by gym_id to prevent cross-gym leakage
   */
  const handleGetrequest = async (request, reply) => {
    try {
      const { query } = request;
      const deviceSN = getDeviceSN(query);
      
      fastify.log.debug({
        msg: 'Device polling for commands',
        deviceSN
      });
      
      // Get gym_id for this device
      const { gym_id, error: deviceError } = await getGymFromDeviceSN(deviceSN, fastify.log);
      
      if (!gym_id) {
        return reply.code(200).send('OK');
      }
      
      // Restoring a member queues one create plus one command per finger, and
      // the device only polls every Delay seconds — handing them out one at a
      // time would stretch a single restore over minutes. The protocol allows
      // several commands in one reply, separated by newlines.
      const { data: commands, error } = await supabase
        .from('biometric_device_commands')
        .select('id, cmd_no, command_string')
        .eq('gym_id', gym_id)
        .eq('device_sn', deviceSN)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(10);
      
      if (error) {
        fastify.log.error({ msg: 'Supabase query error', error });
        return reply.code(200).send('OK');
      }
      
      // No pending commands
      if (!commands || commands.length === 0) {
        return reply.code(200).send('OK');
      }
      
      const { error: updateError } = await supabase
        .from('biometric_device_commands')
        .update({
          status: 'SENT',
          updated_at: new Date().toISOString()
        })
        .in('id', commands.map((c) => c.id));

      if (updateError) {
        fastify.log.error({ msg: 'Failed to update command status', error: updateError });
      }

      // ADMS format: C:{ID}:{COMMAND}. The device parses {ID} as a 64-bit
      // integer and hands it back as ID=<n> on /iclock/devicecmd, so this must
      // be cmd_no — the row's UUID is unparseable to the device, which silently
      // drops the command instead of running it.
      const response = commands
        .map((c) => `C:${c.cmd_no}:${c.command_string}`)
        .join('\n');

      fastify.log.info({
        msg: 'Commands sent to device',
        count: commands.length,
        cmdNos: commands.map((c) => c.cmd_no),
        commands: commands.map((c) => c.command_string.slice(0, 80)),
      });

      return reply.code(200).send(response);
      
    } catch (error) {
      fastify.log.error({ msg: 'Error in getrequest', error: error.message });
      return reply.code(200).send('OK');
    }
  };
  
  /**
   * POST /iclock/devicecmd
   * Device confirms it finished executing a command
   */
  const handleDevicecmd = async (request, reply) => {
    try {
      const { query, body } = request;
      const deviceSN = getDeviceSN(query);
      
      fastify.log.info({
        msg: 'Device command confirmation',
        deviceSN,
        query,
        body
      });
      
      // The device reports results as  ID=<n>&Return=<code>&CMD=<cmd>  and may
      // batch several of them, one per line. ID is the cmd_no we put on the
      // wire, not the row's UUID.
      const results = parseCommandResults(body, query);

      if (results.length === 0) {
        fastify.log.warn({ msg: 'Command confirmation carried no ID', deviceSN, body });
        return reply.code(200).send('OK');
      }

      for (const { cmdNo, returnCode } of results) {
        // Return=0 means it actually ran. Anything else (e.g. -1002 bad
        // syntax, -1004 unsupported on this model) means it was rejected and
        // must not be recorded as success — otherwise a member looks blocked
        // while the gate still opens for them.
        const succeeded = returnCode === null || returnCode === 0;

        const { data: updated, error } = await supabase
          .from('biometric_device_commands')
          .update({
            status: succeeded ? 'SUCCESS' : 'FAILED',
            return_code: returnCode,
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('cmd_no', cmdNo)
          .select('id, command_string');

        if (error) {
          fastify.log.error({ msg: 'Failed to update command status', error, cmdNo });
        } else if (!updated || updated.length === 0) {
          fastify.log.warn({ msg: 'Confirmation for an unknown command', cmdNo, deviceSN });
        } else if (succeeded) {
          fastify.log.info({
            msg: '✅ Command executed on device',
            cmdNo,
            returnCode,
            command: updated[0].command_string.slice(0, 80),
          });
        } else {
          fastify.log.warn({
            msg: '❌ Device rejected command',
            cmdNo,
            returnCode,
            command: updated[0].command_string.slice(0, 80),
            hint: returnCode === -1004
              ? 'Not supported on this device model'
              : returnCode === -1002
                ? 'Invalid command syntax'
                : 'See ZKTeco return codes',
          });
        }
      }

      return reply.code(200).send('OK');
      
    } catch (error) {
      fastify.log.error({ msg: 'Error in devicecmd', error: error.message });
      return reply.code(200).send('OK');
    }
  };
  
  /**
   * GET /iclock/ping
   * Device heartbeat/keep-alive
   */
  // Some eSSL firmwares (e.g. Ver 8.0.4.3) append .aspx to every iclock URL,
  // so each endpoint is registered on both the plain and .aspx path.
  // Some firmwares upload biometric templates to /iclock/fdata rather than
  // /iclock/cdata, so the same capture runs for both.
  const handleFdata = async (request, reply) => {
    try {
      const { query, body } = request;
      const deviceSN = getDeviceSN(query);
      const { gym_id: gymId } = deviceSN
        ? await getGymFromDeviceSN(deviceSN, fastify.log)
        : { gym_id: null };

      await captureNonAttendancePush({
        gymId,
        deviceSN,
        endpoint: 'fdata',
        tableType: String(query?.table || query?.TABLE || 'FDATA').toUpperCase(),
        body,
        logger: fastify.log,
      });
    } catch (e) {
      fastify.log.error({ msg: 'Error handling fdata', error: e.message });
    }
    return reply.code(200).send('OK');
  };

  fastify.post('/fdata', handleFdata);
  fastify.post('/fdata.aspx', handleFdata);
  fastify.get('/fdata', handleFdata);
  fastify.get('/fdata.aspx', handleFdata);

  fastify.post('/cdata', handleCdataPost);
  fastify.post('/cdata.aspx', handleCdataPost);
  fastify.get('/cdata', handleCdataGet);
  fastify.get('/cdata.aspx', handleCdataGet);
  fastify.get('/getrequest', handleGetrequest);
  fastify.get('/getrequest.aspx', handleGetrequest);
  fastify.post('/devicecmd', handleDevicecmd);
  fastify.post('/devicecmd.aspx', handleDevicecmd);

  fastify.get('/ping', async (request, reply) => {
    const deviceSN = getDeviceSN(request.query);
    fastify.log.debug({ msg: 'Device ping', deviceSN });
    return reply.code(200).send('OK');
  });
  
  /**
   * Catch-all for other iclock endpoints
   * Some devices may hit different URLs
   */
  fastify.all('/*', async (request, reply) => {
    fastify.log.info({
      msg: 'Unhandled iclock request',
      method: request.method,
      url: request.url,
      query: request.query,
      body: request.body
    });
    return reply.code(200).send('OK');
  });
}
