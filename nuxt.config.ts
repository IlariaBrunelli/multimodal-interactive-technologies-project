// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  runtimeConfig: {
    n8nCampusChatWebhook: process.env.N8N_CAMPUS_CHAT_WEBHOOK || '',
    n8nCampusDataWebhook:
      process.env.N8N_CAMPUS_DATA_WEBHOOK ||
      'http://localhost:5678/webhook/get-campus-data',
    n8nGuidedTourStepsWebhook:
      process.env.N8N_GUIDED_TOUR_STEPS_WEBHOOK ||
      'http://localhost:5678/webhook/get-guided-tour-steps',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey:
        process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NUXT_PUBLIC_SUPABASE_KEY ||
        '',
    },
  },

  vite: {
    server: {
      allowedHosts: true
    }
  },

  sourcemap: {
    server: false,
    client: false
  }
})
