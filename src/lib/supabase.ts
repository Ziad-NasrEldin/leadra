import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const isTestMode = import.meta.env.MODE === 'test'
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const isSupabaseConfigured = !isTestMode && hasSupabaseConfig
export const canUseDemoMode = isTestMode || (!import.meta.env.PROD && !hasSupabaseConfig)
export const isProductionMissingSupabaseConfig = import.meta.env.PROD && !hasSupabaseConfig

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
