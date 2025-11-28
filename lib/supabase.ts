import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';

// =============================================================================
// Type Definitions
// =============================================================================

export interface UserProfile {
  id: string;
  user_id: string;
  phone: string | null;
  display_name: string | null;
  email: string | null;
  roles: string[];
  is_admin: boolean;
  is_active: boolean;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
}

// =============================================================================
// Server-Side Clients (No Auth - for cron jobs, admin operations)
// =============================================================================

// Cached clients by role to avoid recreating per import
let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Get server-side Supabase client with specified role
 * @param role - 'service' for admin/cron operations, 'anon' for public read endpoints
 * @description Use this for server operations that don't require user auth context
 */
export function getServerSupabaseClient(role: 'service' | 'anon' = 'service'): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (role === 'service') {
    if (serviceClient) return serviceClient;

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return serviceClient;
  }

  // Anon role
  if (anonClient) return anonClient;

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return anonClient;
}

/**
 * @deprecated Use getServerSupabaseClient('service') instead
 * Kept for backwards compatibility during migration
 */
export function getSupabaseClient(): SupabaseClient {
  return getServerSupabaseClient('service');
}

// =============================================================================
// Browser Client (For Client Components with Auth)
// =============================================================================

/**
 * Get browser-side Supabase client with auth support
 * Singleton pattern for client components
 * @description Use this in client components - supports auth session persistence
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabaseClient() {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserSupabaseClient should only be called in browser context');
  }

  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables for browser client');
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

// =============================================================================
// Server Component Client (For Server Components/Route Handlers with Auth)
// =============================================================================

/**
 * Get Supabase client for Server Components and Route Handlers
 * @description Use this in Server Components, API routes, and middleware when you need auth context
 * @note Must be called within a request context (not at module level)
 * @note Uses dynamic import to avoid 'next/headers' being imported in client components
 */
export async function getAuthSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Dynamic import to avoid bundling next/headers in client components
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  });
}

// =============================================================================
// Auth Helper Functions
// =============================================================================

/**
 * Get current authenticated user from browser client
 * @returns User object or null if not authenticated
 */
export async function getCurrentUser() {
  const supabase = getBrowserSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get current user's profile
 * @returns UserProfile or null if not authenticated
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = getBrowserSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return profile as UserProfile;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = getBrowserSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
