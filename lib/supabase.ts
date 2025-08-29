import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role client for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Anon client for public operations (if needed)
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
