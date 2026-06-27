/**
 * Robust session storage for PWA
 * Uses IndexedDB as primary storage with localStorage fallback
 * Ensures session persists across PWA close/reopen
 */

const DB_NAME = 'GymAppDB';
const STORE_NAME = 'session';
const DB_VERSION = 1;

// Keys
export const SESSION_KEYS = {
  USER: 'gymUser',
  EXPIRY: 'gymUserExpiry'
};

/**
 * Open IndexedDB connection
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save session data to both IndexedDB and localStorage
 */
export async function saveSession(key, value) {
  // Check browser environment first
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem('logoutInProgress');
    // Save to localStorage (fallback) - always do this first
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    console.log('✅ Session saved to localStorage:', key);

    // Save to IndexedDB (primary) if available
    if (typeof indexedDB !== 'undefined') {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      await new Promise((resolve, reject) => {
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
      console.log('✅ Session saved to IndexedDB:', key);
    }
  } catch (error) {
    console.error('Error saving session to IndexedDB, localStorage still saved:', error);
    // localStorage save already succeeded above
  }
}

/**
 * Get session data from IndexedDB or localStorage
 */
export async function getSession(key) {
  // Check browser environment first
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Try IndexedDB first if available
    if (typeof indexedDB !== 'undefined') {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const value = await new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();

      if (value !== undefined) {
        console.log('✅ Session restored from IndexedDB:', key);
        // Sync to localStorage
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        return value;
      }
    }

    // Fallback to localStorage
    const localValue = localStorage.getItem(key);
    if (localValue) {
      console.log('✅ Session restored from localStorage:', key);
      try {
        return JSON.parse(localValue);
      } catch {
        return localValue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting session from IndexedDB, using localStorage:', error);
    // Fallback to localStorage
    const localValue = localStorage.getItem(key);
    if (localValue) {
      try {
        return JSON.parse(localValue);
      } catch {
        return localValue;
      }
    }
    return null;
  }
}

/**
 * Remove session data
 */
export async function removeSession(key) {
  try {
    // Remove from localStorage
    localStorage.removeItem(key);

    // Remove from IndexedDB
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    console.log('🗑️ Session removed:', key);
  } catch (error) {
    console.error('Error removing session:', error);
    localStorage.removeItem(key);
  }
}

/**
 * Clear all session data
 */
export async function clearSession() {
  if (typeof window === 'undefined') return;

  // Block focus/visibility restoration while logout clears IndexedDB.
  sessionStorage.setItem('logoutInProgress', 'true');

  // Remove browser-visible auth state immediately.
  Object.values(SESSION_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  localStorage.removeItem('selectedGym');
  localStorage.removeItem('member');

  try {
    // Clear IndexedDB
    if (typeof indexedDB !== 'undefined') {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
    }
    console.log('🗑️ All sessions cleared');
  } catch (error) {
    console.error('Error clearing session:', error);
  } finally {
    // Never leave a local session behind if IndexedDB cleanup fails.
    Object.values(SESSION_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem('selectedGym');
    localStorage.removeItem('member');
  }
}

/**
 * Check if session is valid (not expired)
 */
export async function isSessionValid() {
  const expiry = await getSession(SESSION_KEYS.EXPIRY);
  if (!expiry) return false;

  const expiryTime = parseInt(expiry, 10);
  const isValid = Date.now() < expiryTime;

  if (!isValid) {
    console.log('⚠️ Session expired');
    await clearSession();
  }

  return isValid;
}
