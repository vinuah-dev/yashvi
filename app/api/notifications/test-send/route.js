import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";
import { blockViewOnlyWrites } from "@/lib/server/viewOnlyGuard";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (serviceAccount.project_id) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
}

export async function POST(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const writeBlocked = await blockViewOnlyWrites(request, supabaseAdmin);
    if (writeBlocked) return writeBlocked;

    const body = await request.json();
    const { token, title, body: msgBody } = body;

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const messageId = await admin.messaging().send({
      token,
      notification: {
        title: title || 'Test Alert',
        body: msgBody || 'If you see this, FCM works',
      },
      webpush: {
        fcmOptions: { link: '/' }
      }
    });

    return NextResponse.json({ success: true, messageId });
  } catch (err) {
    console.error('Test send error:', err.code, err.message);
    return NextResponse.json({ error: 'Send failed', details: err?.message, code: err?.code }, { status: 500 });
  }
}
