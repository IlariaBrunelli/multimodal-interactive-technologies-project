import type { SupabaseClient } from '@supabase/supabase-js'

export function useSupabaseClient() {
  return useNuxtApp().$supabase as SupabaseClient
}
