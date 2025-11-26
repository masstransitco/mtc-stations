import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cached clients by role to avoid recreating per import
let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Get server-side Supabase client with specified role
 * @param role - 'service' for admin/cron operations, 'anon' for public read endpoints
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

/**
 * Get browser-side Supabase client (anon key only)
 * Singleton pattern for client components
 */
let browserClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserSupabaseClient should only be called in browser context');
  }

  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables for browser client');
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
