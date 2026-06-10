<script setup lang="ts">
import type { Session } from '@supabase/supabase-js'

const supabase = useSupabaseClient()
const config = useRuntimeConfig()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const currentSession = ref<Session | null>(null)
const isAuthReady = ref(false)
const isSigningOut = ref(false)
const signOutError = ref('')
let authSubscription: { unsubscribe: () => void } | null = null

const currentUser = computed(() => currentSession.value?.user ?? null)
const displayName = computed(() => {
  const metadata = currentUser.value?.user_metadata
  const candidates = [
    metadata?.display_name,
    metadata?.full_name,
    metadata?.name,
    metadata?.username
  ]
  const name = candidates.find((value) => typeof value === 'string' && value.trim())

  return typeof name === 'string' ? name.trim() : 'name not provided'
})
const accountEmail = computed(() => currentUser.value?.email?.trim() || 'Email not available')
const profileInitial = computed(() => {
  const source = displayName.value === 'name not provided'
    ? accountEmail.value
    : displayName.value

  return source.charAt(0).toUpperCase() || '?'
})

const isConfigured = computed(() => {
  return Boolean(config.public.supabaseUrl && config.public.supabaseAnonKey)
})

async function handleSubmit() {
  errorMessage.value = ''

  if (!isConfigured.value) {
    errorMessage.value =
      'Authentication is not configured correctly. Please contact the application administrator.'
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
      error instanceof Error ? error.message : 'Sign-in failed. Please try again.'
  } finally {
    loading.value = false
  }
}

async function handleSignOut() {
  if (isSigningOut.value) {
    return
  }

  isSigningOut.value = true
  signOutError.value = ''

  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    currentSession.value = null
    email.value = ''
    password.value = ''

    if (import.meta.client) {
      window.localStorage.removeItem('campus-ai-assistant-session-id')
    }
  } catch (error) {
    signOutError.value =
      error instanceof Error ? error.message : 'Sign-out failed. Please try again.'
  } finally {
    isSigningOut.value = false
  }
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  currentSession.value = data.session ?? null
  isAuthReady.value = true

  const authListener = supabase.auth.onAuthStateChange((_event, session) => {
    currentSession.value = session
    isAuthReady.value = true
  })

  authSubscription = authListener.data.subscription
})

onBeforeUnmount(() => {
  authSubscription?.unsubscribe()
})
</script>

<template>
  <main class="login-shell">
    <div class="background-orb orb-left" aria-hidden="true"></div>
    <div class="background-orb orb-right" aria-hidden="true"></div>

    <NuxtLink class="back-link" to="/">
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span>Back home</span>
    </NuxtLink>

    <section class="login-card">
      <div class="login-intro">
        <div class="brand-mark" aria-hidden="true">
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4Z" />
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
          </svg>
        </div>
        <p class="eyebrow">PolinSight</p>
        <h1>{{ currentUser ? 'Your PolinSight account.' : 'Welcome to PolinSight.' }}</h1>
        <p class="intro-copy">
          {{ currentUser
            ? 'Here you can see your account details'
            : 'Sign in to continue exploring campus services, guided tours, and useful insights.'
          }}
        </p>
        <div class="feature-list" aria-label="PolinSight features">
          <span>Campus services</span>
          <span>AR building discovery</span>
          <span>Guided tours</span>
        </div>
      </div>

      <div class="login-form-panel">
        <div v-if="!isAuthReady" class="account-loading" aria-live="polite">
          <span class="account-loading-indicator" aria-hidden="true"></span>
          <p>Loading your account...</p>
        </div>

        <template v-else-if="currentUser">
          <div class="profile-heading">
            <div class="profile-avatar" aria-hidden="true">{{ profileInitial }}</div>
            <div class="login-copy">
              <p class="eyebrow">Account profile</p>
              <h2>Your profile</h2>
            </div>
          </div>

          <dl class="account-details">
            <div class="account-detail">
              <dt>Display name</dt>
              <dd :class="{ 'account-detail-placeholder': displayName === 'Display name not provided' }">
                {{ displayName }}
              </dd>
            </div>
            <div class="account-detail">
              <dt>Email address</dt>
              <dd :class="{ 'account-detail-placeholder': accountEmail === 'Email not available' }">
                {{ accountEmail }}
              </dd>
            </div>
          </dl>

          <p v-if="signOutError" class="message error">{{ signOutError }}</p>

          <button class="logout-button" type="button" :disabled="isSigningOut" @click="handleSignOut">
            <svg v-if="!isSigningOut" aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
            </svg>
            <span>{{ isSigningOut ? 'Signing out...' : 'Log out' }}</span>
          </button>
        </template>

        <template v-else>
          <div class="login-copy">
            <p class="eyebrow">Account access</p>
            <h2>Sign in</h2>
            <p>Enter your account details.</p>
          </div>

          <form class="login-form" @submit.prevent="handleSubmit">
            <label class="field">
              <span>Email address</span>
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
                placeholder="Enter your password"
                required
              />
            </label>

            <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
            <p v-else-if="!isConfigured" class="message warning">
              Authentication is currently unavailable.
            </p>

            <button class="submit-button" type="submit" :disabled="loading">
              <span>{{ loading ? 'Signing in...' : 'Sign in' }}</span>
              <svg v-if="!loading" aria-hidden="true" fill="none" viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </form>
        </template>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(16, 44, 83, 0.15), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #e0dcdc 100%);
  color: #0f172a;
}

.login-shell {
  --panel-bg: rgba(255, 255, 255, 0.78);
  --panel-border: rgba(148, 163, 184, 0.22);
  --primary: #102c53;
  --primary-light: #1a427a;
  min-height: 100dvh;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 88px 24px 32px;
}

.background-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(8px);
  pointer-events: none;
}

.orb-left {
  width: 280px;
  height: 280px;
  top: 4%;
  left: -100px;
  background: rgba(16, 44, 83, 0.16);
}

.orb-right {
  width: 380px;
  height: 380px;
  right: -120px;
  bottom: -150px;
  background: rgba(16, 44, 83, 0.1);
}

.login-card {
  position: relative;
  z-index: 1;
  width: min(900px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(360px, 1.05fr);
  overflow: hidden;
  border: 1px solid var(--panel-border);
  border-radius: 32px;
  background: var(--panel-bg);
  box-shadow: 0 28px 60px rgba(16, 44, 83, 0.16);
  backdrop-filter: blur(18px);
}

.back-link {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 2;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 0 12px;
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  color: var(--primary);
  background: var(--panel-bg);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  font-weight: 700;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.back-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
}

.back-link svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.login-intro {
  min-height: 500px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px;
  color: #fff;
  background:
    radial-gradient(circle at 15% 10%, rgba(255, 255, 255, 0.18), transparent 32%),
    linear-gradient(145deg, var(--primary), #071a32);
}

.brand-mark {
  width: 60px;
  height: 60px;
  display: grid;
  place-items: center;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.12);
}

.brand-mark svg {
  width: 30px;
  height: 30px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.login-intro h1 {
  max-width: 340px;
  margin: 0;
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  line-height: 1.02;
  letter-spacing: -0.04em;
}

.intro-copy {
  max-width: 360px;
  margin: 18px 0 0;
  color: rgba(226, 232, 240, 0.88);
  line-height: 1.65;
}

.feature-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 30px;
}

.feature-list span {
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  color: rgba(248, 250, 252, 0.92);
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.76rem;
  font-weight: 700;
}

.login-form-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px;
  background: rgba(255, 255, 255, 0.44);
}

.account-loading {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 14px;
  color: #64748b;
}

.account-loading p {
  margin: 0;
}

.account-loading-indicator {
  width: 34px;
  height: 34px;
  border: 3px solid rgba(16, 44, 83, 0.14);
  border-top-color: var(--primary);
  border-radius: 999px;
  animation: account-spin 0.8s linear infinite;
}

.profile-heading {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 20px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  box-shadow: 0 14px 26px rgba(16, 44, 83, 0.22);
  font-size: 1.55rem;
  font-weight: 800;
}

.account-details {
  display: grid;
  gap: 12px;
  margin: 30px 0 22px;
}

.account-detail {
  margin: 0;
  padding: 15px 16px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
}

.account-detail dt {
  margin-bottom: 5px;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.account-detail dd {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.account-detail-placeholder {
  color: #94a3b8 !important;
  font-style: italic;
  font-weight: 600 !important;
}

.login-copy h2 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(2rem, 4vw, 2.6rem);
  letter-spacing: -0.035em;
}

.login-copy p:last-child {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.55;
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--primary);
}

.login-intro .eyebrow {
  color: rgba(219, 234, 254, 0.82);
}

.login-form {
  display: grid;
  gap: 18px;
  margin-top: 28px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: #334155;
  font-size: 0.86rem;
  font-weight: 700;
}

.field input {
  min-height: 52px;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-radius: 16px;
  padding: 0 16px;
  color: #0f172a;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.field input:focus {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: 0 0 0 4px rgba(16, 44, 83, 0.1);
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
  background: rgba(16, 44, 83, 0.08);
  color: var(--primary);
}

.submit-button {
  min-height: 52px;
  border: 0;
  border-radius: 999px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  box-shadow: 0 16px 28px rgba(16, 44, 83, 0.28);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(16, 44, 83, 0.35);
}

.submit-button svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.submit-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.logout-button {
  min-height: 52px;
  border: 1px solid rgba(16, 44, 83, 0.22);
  border-radius: 999px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--primary);
  background: rgba(255, 255, 255, 0.84);
  font-size: 1rem;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(16, 44, 83, 0.1);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.logout-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(16, 44, 83, 0.16);
}

.logout-button svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.logout-button:disabled {
  cursor: wait;
  opacity: 0.66;
}

@keyframes account-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .login-shell {
    place-items: start center;
    overflow-y: auto;
    padding: 84px 14px 20px;
  }

  .back-link {
    top: 14px;
    left: 14px;
  }

  .login-card {
    grid-template-columns: 1fr;
    border-radius: 26px;
  }

  .login-intro {
    min-height: auto;
    padding: 30px 24px;
  }

  .brand-mark {
    width: 50px;
    height: 50px;
    margin-bottom: 18px;
    border-radius: 15px;
  }

  .login-intro h1 {
    font-size: clamp(2rem, 11vw, 2.8rem);
  }

  .intro-copy {
    margin-top: 12px;
  }

  .feature-list {
    margin-top: 20px;
  }

  .login-form-panel {
    padding: 30px 24px 34px;
  }
}
</style>
