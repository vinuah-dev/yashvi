import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL_P;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_P;

// Create Supabase client for database operations
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Auth state management
let currentUser = null;
let authChangeCallbacks = [];
let isInitialized = false;

// Session storage key for persistence
const SESSION_KEY = "gymUser";
const SESSION_EXPIRY_KEY = "gymUserExpiry";
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Helper to get storage (works in both browser and SSR)
const getStorage = () => {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }
  return null;
};

// Helper to notify all auth state change listeners
const notifyAuthChange = (event, user) => {
  authChangeCallbacks.forEach((callback) => callback(event, { user }));
};

// Persist session with expiry
const persistSession = (user) => {
  const storage = getStorage();
  if (!storage) return;
  
  try {
    const expiryTime = Date.now() + SESSION_DURATION;
    storage.setItem(SESSION_KEY, JSON.stringify(user));
    storage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
  } catch (error) {
    console.error("Error persisting session:", error);
  }
};

// Clear persisted session
const clearSession = () => {
  const storage = getStorage();
  if (!storage) return;
  
  try {
    storage.removeItem(SESSION_KEY);
    storage.removeItem(SESSION_EXPIRY_KEY);
    storage.removeItem("selectedGym");
  } catch (error) {
    console.error("Error clearing session:", error);
  }
};

// Restore session from storage
const restoreSession = () => {
  const storage = getStorage();
  if (!storage) return null;
  
  try {
    const storedUser = storage.getItem(SESSION_KEY);
    const expiryTime = storage.getItem(SESSION_EXPIRY_KEY);
    
    if (!storedUser || !expiryTime) return null;
    
    // Check if session has expired
    const expiry = parseInt(expiryTime, 10);
    if (Date.now() > expiry) {
      console.log("Session expired, clearing...");
      clearSession();
      return null;
    }
    
    // Session is valid, parse and return user
    const user = JSON.parse(storedUser);
    
    // Extend session on restore (sliding expiry)
    persistSession(user);
    
    return user;
  } catch (error) {
    console.error("Error restoring session:", error);
    clearSession();
    return null;
  }
};

// Initialize session on module load
const initializeSession = () => {
  if (isInitialized) return currentUser;
  
  const restoredUser = restoreSession();
  if (restoredUser) {
    currentUser = restoredUser;
    console.log("Session restored for:", restoredUser.name || restoredUser.email);
  }
  
  isInitialized = true;
  return currentUser;
};

// Custom auth implementation using member_credentials table
export const supabase = {
  // Expose the raw client for direct database queries
  client: supabaseClient,

  // Expose storage for file uploads
  storage: supabaseClient.storage,

  auth: {
    signInWithPassword: async ({ email, password }) => {
      try {
        // First, check if it's an admin/owner/trainer login (profiles table)
        // Try matching by email first
        let { data: profiles, error: profileError } = await supabaseClient
          .from("profiles")
          .select("id, first_name, last_name, phone, email, password, role")
          .eq("email", email);

        // If not found by email, try by phone
        if (!profiles || profiles.length === 0) {
          const phoneResult = await supabaseClient
            .from("profiles")
            .select("id, first_name, last_name, phone, email, password, role")
            .eq("phone", email);
          profiles = phoneResult.data;
          profileError = phoneResult.error;
        }

        const profile = profiles?.[0];

        if (profile && !profileError) {
          // Check password from database
          if (profile.password && password === profile.password) {
            currentUser = {
              id: profile.id,
              email: profile.email || profile.phone,
              name: `${profile.first_name} ${profile.last_name}`,
              phone: profile.phone,
              role: profile.role,
              userType: "admin",
              loginTime: Date.now(),
            };
            persistSession(currentUser);
            notifyAuthChange("SIGNED_IN", currentUser);
            return { data: { user: currentUser }, error: null };
          } else if (profile) {
            // Profile found but wrong password
            return { 
              data: null, 
              error: { message: "Invalid password" } 
            };
          }
        }

        // Check member_credentials table for member login
        const { data: credentials, error: credError } = await supabaseClient
          .from("member_credentials")
          .select(`
            id,
            member_id,
            login_type,
            login_value,
            password,
            members (
              id,
              full_name,
              phone,
              email,
              profile_image,
              gym_id
            )
          `)
          .eq("login_value", email);

        const credential = credentials?.[0];

        if (credError || !credential) {
          return { 
            data: null, 
            error: { message: "Invalid email or phone number" } 
          };
        }

        // Verify password
        if (credential.password !== password) {
          return { 
            data: null, 
            error: { message: "Invalid password" } 
          };
        }

        // Build user object from member data
        currentUser = {
          id: credential.member_id,
          email: credential.login_value,
          name: credential.members?.full_name,
          phone: credential.members?.phone,
          profileImage: credential.members?.profile_image,
          gymId: credential.members?.gym_id,
          role: "member",
          userType: "member",
          loginTime: Date.now(),
        };

        persistSession(currentUser);
        notifyAuthChange("SIGNED_IN", currentUser);
        return { data: { user: currentUser }, error: null };
      } catch (err) {
        console.error("Login error:", err);
        return { 
          data: null, 
          error: { message: "An error occurred during login" } 
        };
      }
    },

    getUser: async () => {
      // Initialize session if not already done
      if (!isInitialized) {
        initializeSession();
      }
      
      // If no current user, try to restore from storage
      if (!currentUser) {
        currentUser = restoreSession();
      }
      
      return { data: { user: currentUser } };
    },

    // Sync method to get user without async (for immediate access)
    getSession: () => {
      if (!isInitialized) {
        initializeSession();
      }
      return { data: { session: currentUser ? { user: currentUser } : null } };
    },

    signOut: async () => {
      currentUser = null;
      clearSession();
      notifyAuthChange("SIGNED_OUT", null);
      return { error: null };
    },

    onAuthStateChange: (callback) => {
      authChangeCallbacks.push(callback);
      
      // Initialize and notify current state immediately
      if (!isInitialized) {
        initializeSession();
      }
      
      // Notify callback of current auth state
      if (currentUser) {
        setTimeout(() => {
          callback("INITIAL_SESSION", { user: currentUser });
        }, 0);
      }
      
      // Return subscription object with unsubscribe method
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authChangeCallbacks = authChangeCallbacks.filter(
                (cb) => cb !== callback
              );
            },
          },
        },
      };
    },

    // Refresh session (extend expiry without re-login)
    refreshSession: () => {
      if (currentUser) {
        persistSession(currentUser);
        return { data: { user: currentUser }, error: null };
      }
      return { data: null, error: { message: "No active session" } };
    },
  },

  // Expose commonly used database methods
  from: (table) => supabaseClient.from(table),
  rpc: (fn, params) => supabaseClient.rpc(fn, params),
};

// Initialize session when module loads (browser only)
if (typeof window !== 'undefined') {
  initializeSession();
}
