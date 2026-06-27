import { supabaseServer } from '@/lib/supabaseServer';
import admin from 'firebase-admin';

// Safe lazy helper to initialize Firebase Admin SDK
function ensureFirebaseInitialized() {
  if (admin.apps.length > 0) {
    return true;
  }
  
  const firebaseCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!firebaseCreds) {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT is not set in environment variables');
    return false;
  }

  try {
    const serviceAccount = JSON.parse(firebaseCreds);
    if (!serviceAccount.project_id) {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT does not contain project_id');
      return false;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'sfit-ai-notifications'
    });
    return true;
  } catch (err) {
    console.error('❌ Failed to parse or initialize Firebase Admin SDK:', err);
    return false;
  }
}


/**
 * Send FCM notification to specific users
 */
export async function sendNotificationToUsers(userIds, notification) {
  try {
    console.log('🔔 sendNotificationToUsers called with userIds:', userIds);
    const supabase = supabaseServer();
    
    // Get FCM tokens for the users
    const { data: tokens, error } = await supabase
      .from('fcm_tokens')
      .select('token, user_id, account_type')
      .in('user_id', userIds);

    console.log('📊 Query result - tokens found:', tokens?.length || 0, 'error:', error?.message);
    if (tokens && tokens.length > 0) {
      console.log('✅ Token details:', tokens.map(t => ({ user_id: t.user_id, account_type: t.account_type })));
    }

    if (error) throw error;

    if (!tokens || tokens.length === 0) {
      console.warn('⚠️ No FCM tokens found for users. Requested userIds:', userIds);
      return { success: false, message: 'No FCM tokens found for users', userIds, queried: true };
    }

    // Send notifications to all tokens
    console.log('📤 Sending to', tokens.length, 'tokens...');
    const results = await Promise.allSettled(
      tokens.map(({ token, user_id }) => 
        sendFCMNotification(token, notification, user_id)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log('✉️ Send results - successful:', successful, 'failed:', failed, 'total:', results.length);
    if (failed > 0) {
      const failedResults = results.filter(r => r.status === 'rejected');
      failedResults.forEach((r, i) => console.error(`Failed send ${i}:`, r.reason));
    }

    return {
      success: true,
      sent: successful,
      failed: failed,
      total: results.length
    };
  } catch (error) {
    console.error('❌ Error sending notifications:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send FCM notification to all users of a gym
 */
export async function sendNotificationToGym(gymId, notification, excludeRoles = []) {
  try {
    const supabase = supabaseServer();
    // Get all user IDs for the gym
    let query = supabase
      .from('profiles')
      .select('id')
      .eq('gym_id', gymId);

    if (excludeRoles.length > 0) {
      query = query.not('role', 'in', `(${excludeRoles.join(',')})`);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    const userIds = users.map(u => u.id);
    return await sendNotificationToUsers(userIds, notification);
  } catch (error) {
    console.error('Error sending gym notifications:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send single FCM notification via Firebase Admin SDK
 */
async function sendFCMNotification(fcmToken, notification, userId) {
  try {
    console.log('📨 Sending FCM to token:', fcmToken.substring(0, 20) + '...', 'for user:', userId);
    
    if (!ensureFirebaseInitialized()) {
      throw new Error('Firebase Admin SDK is not initialized. Please configure FIREBASE_SERVICE_ACCOUNT in your environment.');
    }
    
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: {
        url: notification.url || '/',
        type: notification.type || 'general',
        ...notification.data
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          requireInteraction: true
        },
        fcmOptions: {
          link: notification.url || '/'
        }
      }
    };

    console.log('🔥 Firebase Admin SDK sending message...');
    console.log('🔐 Firebase app:', admin.app()?.name || 'unknown');
    
    const response = await admin.messaging().send(message);
    console.log('✅ Firebase response (messageId):', response);
    
    // Log the notification
    const supabase = supabaseServer();
    await supabase.from('notification_logs').insert({
      user_id: userId,
      notification_type: notification.type || 'general',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      success: true,
      error_message: null
    });

    console.log('📝 Logged successful notification');
    return { 
      success: true,
      messageId: response 
    };
  } catch (error) {
    console.error('❌ FCM send error:', error.code, error.message);
    console.error('🐛 Full error:', error);
    
    // Log failed notification
    const supabase = supabaseServer();
    await supabase.from('notification_logs').insert({
      user_id: userId,
      notification_type: notification.type || 'general',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      success: false,
      error_message: error.message
    });

    return { success: false, error: error.message };
  }
}

/**
 * Register or update FCM token for a user
 */
export async function registerFCMToken(userId, token, deviceInfo = {}, userType = 'profile') {
  try {
    const supabase = supabaseServer();
    
    // First, delete any old tokens for this user to avoid duplicates
    await supabase
      .from('fcm_tokens')
      .delete()
      .eq('user_id', userId)
      .neq('token', token); // Keep the new token if it already exists
    
    // Then insert/update the new token
    const { data, error } = await supabase
      .from('fcm_tokens')
      .upsert(
        {
          user_id: userId,
          token: token,
          account_type: userType,
          device_info: deviceInfo,
          last_used_at: new Date().toISOString()
        },
        { 
          onConflict: 'token',
          ignoreDuplicates: false 
        }
      );

    if (error) throw error;
    console.log('✅ FCM token registered/updated for user:', userId, 'account_type:', userType);
    return { success: true, data };
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove FCM token (on logout)
 */
export async function removeFCMToken(token) {
  try {
    const supabase = supabaseServer();
    const { error } = await supabase
      .from('fcm_tokens')
      .delete()
      .eq('token', token);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error removing FCM token:', error);
    return { success: false, error: error.message };
  }
}
