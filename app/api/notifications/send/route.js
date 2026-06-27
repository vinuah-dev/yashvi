import { NextResponse } from 'next/server';
import { sendNotificationToUsers } from '@/lib/notifications';
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

export async function POST(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const writeBlocked = await blockViewOnlyWrites(request, supabaseAdmin);
    if (writeBlocked) return writeBlocked;

    const body = await request.json();
    const { userIds, notification } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds array is required' },
        { status: 400 }
      );
    }

    if (!notification || !notification.title || !notification.body) {
      return NextResponse.json(
        { error: 'notification with title and body is required' },
        { status: 400 }
      );
    }

    const result = await sendNotificationToUsers(userIds, notification);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${result.sent} notifications successfully`,
      sent: result.sent,
      failed: result.failed,
      total: result.total
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
