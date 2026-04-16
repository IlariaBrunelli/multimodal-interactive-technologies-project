<script setup lang="ts">
const supabase = useSupabaseClient()
const config = useRuntimeConfig()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const isConfigured = computed(() => {
  return Boolean(config.public.supabaseUrl && config.public.supabaseAnonKey)
})

async function handleSubmit() {
  errorMessage.value = ''

  if (!isConfigured.value) {
    errorMessage.value =
      'Supabase non e configurato correttamente. Controlla NUXT_PUBLIC_SUPABASE_URL e NUXT_PUBLIC_SUPABASE_ANON_KEY.'
    return
  }

  loading.value = true

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (error) {
      throw error
    }

    await navigateTo('/')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Login fallito. Riprova.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-shell">
    <section class="login-card">
      <NuxtLink class="back-link" to="/">Back home</NuxtLink>

      <div class="login-copy">
        <p class="eyebrow">Login</p>
        <h1>Accedi con Supabase</h1>
        <p>
          Inserisci email e password del tuo utente Supabase Auth per entrare
          nell'applicazione.
        </p>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit">
        <label class="field">
          <span>Email</span>
          <input
            v-model.trim="email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="name@example.com"
            required
          />
        </label>

        <label class="field">
          <span>Password</span>
          <input
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Your password"
            required
          />
        </label>

        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
        <p v-else-if="!isConfigured" class="message warning">
          Configurazione Supabase mancante o incompleta.
        </p>

        <button class="submit-button" type="submit" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(255, 200, 87, 0.2), transparent 28%),
    linear-gradient(180deg, #fff8ef 0%, #f4efe8 100%);
  color: #1f2937;
}

.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-card {
  width: min(440px, 100%);
  padding: 30px;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 24px 60px rgba(120, 53, 15, 0.16);
  backdrop-filter: blur(16px);
}

.back-link {
  display: inline-flex;
  margin-bottom: 22px;
  color: #9a3412;
  text-decoration: none;
}

.login-copy h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 2.6rem);
}

.login-copy p:last-child {
  margin: 12px 0 0;
  line-height: 1.6;
  color: #475569;
}

.eyebrow {
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: #b45309;
}

.login-form {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-weight: 600;
  color: #7c2d12;
}

.field input {
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.92);
}

.field input:focus {
  outline: 2px solid rgba(217, 119, 6, 0.22);
  border-color: #d97706;
}

.message {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 0.95rem;
}

.error {
  background: rgba(239, 68, 68, 0.12);
  color: #991b1b;
}

.warning {
  background: rgba(245, 158, 11, 0.14);
  color: #92400e;
}

.submit-button {
  border: 0;
  border-radius: 999px;
  padding: 14px 20px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #d97706, #f97316);
  box-shadow: 0 16px 28px rgba(217, 119, 6, 0.25);
  cursor: pointer;
}

.submit-button:disabled {
  cursor: wait;
  opacity: 0.72;
}
</style>
