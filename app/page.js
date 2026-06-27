'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, isSessionValid, SESSION_KEYS } from '@/lib/sessionStorage';

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Only run in browser
        if (typeof window === 'undefined') return;
        
        // Wait for SessionRestoration to complete
        let attempts = 0;
        while (!sessionStorage.getItem('sessionRestorationComplete') && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        console.log('🏠 Homepage checking session after restoration...');

        // Check if session is valid
        const valid = await isSessionValid();
        
        if (valid) {
          const userStr = await getSession(SESSION_KEYS.USER);
          if (userStr) {
            const user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr;
            console.log('✅ Session found on homepage, redirecting to dashboard for:', user.role);
            
            // Redirect based on role
            if (user.role === 'member') {
              router.replace('/user/dashboard');
            } else if (user.role === 'trainer') {
              // Trainers now use the same admin dashboard
              router.replace('/admin/dashboard');
            } else {
              router.replace('/admin/dashboard');
            }
            return;
          }
        }
        
        // No valid session, go to welcome
        console.log('ℹ️ No session found, redirecting to welcome');
        router.replace('/welcome');
      } catch (error) {
        console.error('Error checking session:', error);
        router.replace('/welcome');
      } finally {
        setChecking(false);
      }
    };

    checkSession();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading until redirect happens
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}

