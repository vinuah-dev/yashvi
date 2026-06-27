import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendNotificationToUsers } from '@/lib/notifications';

/**
 * GET /api/notifications/check-expiring
 * Check for memberships expiring in 2 days and send notifications
 * This should be called once daily via a cron job
 */
export async function GET(request) {
  try {
    // Verify cron secret (optional security measure)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Calculate date 2 days from now
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(0, 0, 0, 0);

    const threeDaysFromNow = new Date(twoDaysFromNow);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 1);

    // Find memberships expiring in exactly 2 days
    const supabase = supabaseServer();
    const { data: expiringMemberships, error } = await supabase
      .from('memberships')
      .select(`
        id,
        end_date,
        member_id,
        members (
          id,
          user_id,
          profiles (
            id,
            first_name,
            last_name
          )
        ),
        membership_plans (
          name
        )
      `)
      .eq('status', 'active')
      .gte('end_date', twoDaysFromNow.toISOString())
      .lt('end_date', threeDaysFromNow.toISOString());

    if (error) throw error;

    if (!expiringMemberships || expiringMemberships.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No memberships expiring in 2 days',
        count: 0
      });
    }

    // Send notifications to each user
    const notifications = await Promise.all(
      expiringMemberships.map(async (membership) => {
        const userId = membership.members?.user_id;
        const userName = `${membership.members?.profiles?.first_name} ${membership.members?.profiles?.last_name}`;
        const planName = membership.membership_plans?.name || 'Your membership';

        if (!userId) return { success: false, reason: 'No user_id' };

        const notification = {
          title: '⚠️ Membership Expiring Soon',
          body: `Hi ${membership.members?.profiles?.first_name}! Your ${planName} will expire in 2 days. Please renew to continue enjoying our services.`,
          type: 'membership_expiry',
          url: '/profile',
          data: {
            membership_id: membership.id,
            end_date: membership.end_date
          }
        };

        return await sendNotificationToUsers([userId], notification);
      })
    );

    const successful = notifications.filter(n => n.success).length;

    return NextResponse.json({
      success: true,
      message: `Processed ${expiringMemberships.length} expiring memberships`,
      total: expiringMemberships.length,
      notificationsSent: successful
    });

  } catch (error) {
    console.error('Error checking expiring memberships:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
