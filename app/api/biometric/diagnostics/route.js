import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/apiMiddleware";

// Diagnostics for the biometric setup.
//
// The one thing that decides whether renewals can skip re-enrollment is
// whether this firmware uploads fingerprint templates to the server. This
// endpoint answers that from real captured data rather than assumptions, and
// shows whether queued commands were actually accepted by the device.
export const POST = withAuth(async (request, { gymId, supabase }) => {
  const [templates, logs, commands, members] = await Promise.all([
    supabase
      .from("biometric_templates")
      .select("biometric_uid, finger_id, template_size, device_sn, updated_at")
      .eq("gym_id", gymId)
      .order("updated_at", { ascending: false })
      .limit(20),

    supabase
      .from("biometric_device_logs")
      .select("device_sn, endpoint, table_name, raw_body, created_at")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("biometric_device_commands")
      .select("device_sn, command_string, status, return_code, created_at, confirmed_at")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .not("biometric_uid", "is", null),
  ]);

  const templateRows = templates.data || [];
  const uniqueUids = new Set(templateRows.map((t) => t.biometric_uid));

  return NextResponse.json({
    data: {
      // The headline answer: has any template ever arrived from a device?
      templatesSupported: templateRows.length > 0,
      templateCount: templateRows.length,
      membersWithTemplates: uniqueUids.size,
      membersWithUid: members.count || 0,

      recentTemplates: templateRows.map((t) => ({
        uid: t.biometric_uid,
        finger: t.finger_id,
        size: t.template_size,
        device: t.device_sn,
        at: t.updated_at,
      })),

      // Raw pushes are trimmed — enough to see the shape, not the whole payload.
      recentPushes: (logs.data || []).map((l) => ({
        device: l.device_sn,
        endpoint: l.endpoint,
        table: l.table_name,
        preview: (l.raw_body || "").slice(0, 300),
        at: l.created_at,
      })),

      recentCommands: (commands.data || []).map((cmd) => ({
        device: cmd.device_sn,
        command: (cmd.command_string || "").slice(0, 120),
        status: cmd.status,
        returnCode: cmd.return_code,
        at: cmd.created_at,
        confirmedAt: cmd.confirmed_at,
      })),
    },
  });
});
