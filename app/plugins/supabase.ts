import { createClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const { supabaseUrl, supabaseAnonKey } = config.public

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: import.meta.client,
      detectSessionInUrl: import.meta.client,
      persistSession: import.meta.client
    }
  })

  return {
    provide: {
      supabase
    }
  }
})
