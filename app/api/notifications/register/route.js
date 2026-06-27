import { NextResponse } from 'next/server';
import { registerFCMToken } from '@/lib/notifications';

/**
 * POST /api/notifications/register
 * Register FCM token for a user
 * Body: { userId: string, token: string, deviceInfo?: object }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, token, deviceInfo, userType } = body;

    if (!userId || !token) {
      return NextResponse.json(
        { error: 'userId and token are required' },
        { status: 400 }
      );
    }

    const result = await registerFCMToken(userId, token, deviceInfo, userType || 'profile');

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to register token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'FCM token registered successfully',
      tokenRegistered: !!result?.data,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
