import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
const storageBucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET?.trim() || 'menu-icons'

export const hasSupabaseConfig = supabaseUrl.length > 0 && supabaseAnonKey.length > 0

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

export function getStorageBucket() {
  return storageBucket
}
