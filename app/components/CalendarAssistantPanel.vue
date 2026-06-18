<script setup lang="ts">
import type { Session, User } from '@supabase/supabase-js'

import { getChatLocationCoordinates } from '../composables/useChatLocation'
import type { UserCalendarPreviewEvent, UserCalendarResponse } from '../utils/user-calendar'

type ChatMessage = {
  role: 'assistant' | 'user'
  text: string
}

type CampusChatResponse = {
  reply: string
  sessionId: string
}

const supabase = useSupabaseClient()
const defaultAssistantMessage =
  'Ciao, sono il Campus AI Assistant. Posso controllare il tuo calendario e aiutarti con le lezioni.'

const starterPrompts = [
  'Che lezione ho lunedi prossimo?',
  'Quali lezioni ho oggi?',
  'A che ora inizia la prossima lezione?',
  'Dove si tiene la prossima lezione?'
] as const

const chatMessages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    text: defaultAssistantMessage
  }
])
const userPrompt = ref('')
const currentSession = ref<Session | null>(null)
const currentUser = ref<User | null>(null)
const linkedCalendar = ref<UserCalendarResponse['calendar']>(null)
const calendarFormUrl = ref('')
const calendarFormError = ref('')
const calendarFormSuccess = ref('')
const isAuthReady = ref(false)
const isCalendarLoading = ref(false)
const isSavingCalendar = ref(false)
const isEditingCalendarLink = ref(false)
const isChatLoading = ref(false)
const isSigningOut = ref(false)

let authSubscription: { unsubscribe: () => void } | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractErrorMessage(error: unknown, fallbackMessage: string) {
  if (isRecord(error)) {
    if (isRecord(error.data) && typeof error.data.statusMessage === 'string' && error.data.statusMessage.trim()) {
      return error.data.statusMessage.trim()
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim()
    }
  }

  return fallbackMessage
}

function resetChatMessages() {
  chatMessages.value = [
    {
      role: 'assistant',
      text: defaultAssistantMessage
    }
  ]
  userPrompt.value = ''
}

function buildCampusChatStorageKey() {
  return `campus-ai-assistant-session-id:${currentUser.value?.id ?? 'guest'}`
}

function createCampusChatSessionId() {
  const browserCrypto = import.meta.client
    ? window.crypto as (Crypto & { randomUUID?: () => string }) | undefined
    : undefined

  return browserCrypto?.randomUUID?.() ?? `campus-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getCampusChatSessionId() {
  if (!import.meta.client) {
    return createCampusChatSessionId()
  }

  const storageKey = buildCampusChatStorageKey()
  const existingSessionId = window.localStorage.getItem(storageKey)

  if (existingSessionId) {
    return existingSessionId
  }

  const sessionId = createCampusChatSessionId()
  window.localStorage.setItem(storageKey, sessionId)

  return sessionId
}

async function getAuthorizedHeaders() {
  const activeSession = currentSession.value ?? (await supabase.auth.getSession()).data.session ?? null

  if (activeSession && !currentSession.value) {
    currentSession.value = activeSession
  }

  return activeSession?.access_token
    ? { Authorization: `Bearer ${activeSession.access_token}` }
    : {}
}

async function loadLinkedCalendar() {
  if (!currentUser.value) {
    linkedCalendar.value = null
    calendarFormUrl.value = ''
    return
  }

  const headers = await getAuthorizedHeaders()

  if (!headers.Authorization) {
    linkedCalendar.value = null
    return
  }

  isCalendarLoading.value = true
  calendarFormError.value = ''

  try {
    const response = await $fetch<UserCalendarResponse>('/api/user-calendar', {
      headers
    })

    linkedCalendar.value = response.calendar
    calendarFormUrl.value = response.calendar?.icalUrl ?? ''
  } catch (error) {
    linkedCalendar.value = null
    calendarFormError.value = extractErrorMessage(
      error,
      'Non riesco a leggere il calendario collegato in questo momento.'
    )
  } finally {
    isCalendarLoading.value = false
  }
}

async function refreshAuthState(session: Session | null) {
  const previousUserId = currentUser.value?.id ?? null

  currentSession.value = session
  currentUser.value = session?.user ?? null
  calendarFormError.value = ''
  calendarFormSuccess.value = ''
  isEditingCalendarLink.value = false

  if (previousUserId !== currentUser.value?.id) {
    resetChatMessages()
  }

  if (!currentUser.value) {
    linkedCalendar.value = null
    calendarFormUrl.value = ''
    return
  }

  calendarFormUrl.value = ''
  await loadLinkedCalendar()
}

function getChatBlockerMessage() {
  if (!currentUser.value) {
    return 'Accedi e collega il tuo iCal per fare domande sulle prossime lezioni.'
  }

  if (!linkedCalendar.value?.icalUrl) {
    return 'Prima incolla il link iCal nel riquadro Calendar setup, poi potro rispondere sulle lezioni.'
  }

  return ''
}

async function handleSaveCalendar() {
  if (!currentUser.value) {
    calendarFormError.value = 'Accedi prima di collegare il calendario.'
    return
  }

  const icalUrl = calendarFormUrl.value.trim()

  if (!icalUrl) {
    calendarFormError.value = 'Inserisci il link iCal del calendario.'
    return
  }

  const headers = await getAuthorizedHeaders()

  if (!headers.Authorization) {
    calendarFormError.value = 'La sessione non e valida. Fai di nuovo login.'
    return
  }

  isSavingCalendar.value = true
  calendarFormError.value = ''
  calendarFormSuccess.value = ''

  try {
    const response = await $fetch<UserCalendarResponse>('/api/user-calendar', {
      method: 'POST',
      headers,
      body: {
        icalUrl
      }
    })

    if (!response.calendar) {
      throw new Error('Il calendario non ha restituito una preview valida.')
    }

    linkedCalendar.value = response.calendar
    calendarFormUrl.value = response.calendar.icalUrl
    calendarFormSuccess.value =
      'Calendario collegato. Dalla prossima domanda usero questo iCal per rispondere sulle lezioni.'
    isEditingCalendarLink.value = false
  } catch (error) {
    calendarFormError.value = extractErrorMessage(
      error,
      'Non riesco a collegare il calendario. Controlla il link iCal e riprova.'
    )
  } finally {
    isSavingCalendar.value = false
  }
}

function openCalendarEditor() {
  calendarFormError.value = ''
  calendarFormSuccess.value = ''
  calendarFormUrl.value = linkedCalendar.value?.icalUrl ?? ''
  isEditingCalendarLink.value = true
}

function cancelCalendarEditor() {
  isEditingCalendarLink.value = false
  calendarFormError.value = ''
  calendarFormSuccess.value = ''
  calendarFormUrl.value = linkedCalendar.value?.icalUrl ?? ''
}

async function handleSignOut() {
  if (isSigningOut.value) {
    return
  }

  isSigningOut.value = true
  const storageKey = buildCampusChatStorageKey()

  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    if (import.meta.client) {
      window.localStorage.removeItem(storageKey)
    }

    await refreshAuthState(null)
    await navigateTo('/')
  } catch (error) {
    calendarFormError.value = extractErrorMessage(error, 'Non riesco a eseguire il logout.')
  } finally {
    isSigningOut.value = false
  }
}

function formatCalendarEvent(event: UserCalendarPreviewEvent) {
  const formatter = new Intl.DateTimeFormat('it-IT', event.allDay
    ? {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }
    : {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })

  return formatter.format(new Date(event.start))
}

function useStarterPrompt(prompt: string) {
  const blockerMessage = getChatBlockerMessage()

  if (blockerMessage) {
    chatMessages.value.push({
      role: 'assistant',
      text: blockerMessage
    })
    return
  }

  userPrompt.value = prompt
  submitChat()
}

async function submitChat() {
  const blockerMessage = getChatBlockerMessage()

  if (blockerMessage) {
    chatMessages.value.push({
      role: 'assistant',
      text: blockerMessage
    })
    return
  }

  const question = userPrompt.value.trim()

  if (!question || isChatLoading.value) {
    return
  }

  const headers = await getAuthorizedHeaders()

  if (!headers.Authorization) {
    chatMessages.value.push({
      role: 'assistant',
      text: 'La sessione e scaduta. Fai di nuovo login per usare il calendario.'
    })
    return
  }

  isChatLoading.value = true
  chatMessages.value.push({
    role: 'user',
    text: question
  })

  const assistantMessageIndex = chatMessages.value.push({
    role: 'assistant',
    text: 'Sto controllando il calendario...'
  }) - 1

  userPrompt.value = ''

  try {
    const chatLocation = await getChatLocationCoordinates()

    const response = await $fetch<CampusChatResponse>('/api/campus-chat', {
      method: 'POST',
      headers,
      body: {
        message: question,
        sessionId: getCampusChatSessionId(),
        latitude: chatLocation.latitude,
        longitude: chatLocation.longitude
      }
    })

    chatMessages.value[assistantMessageIndex] = {
      role: 'assistant',
      text: response.reply
    }
  } catch (error) {
    chatMessages.value[assistantMessageIndex] = {
      role: 'assistant',
      text: extractErrorMessage(
        error,
        'Non riesco a contattare l agente del calendario in questo momento. Riprova tra poco.'
      )
    }
  } finally {
    isChatLoading.value = false
  }
}

const nextUpcomingEvent = computed(() => linkedCalendar.value?.upcomingEvents[0] ?? null)
const visibleUpcomingEvents = computed(() => linkedCalendar.value?.upcomingEvents.slice(0, 3) ?? [])
const savedCalendarName = computed(() => {
  return linkedCalendar.value?.calendarName ?? null
})
const canUseCalendarAssistant = computed(() => Boolean(currentUser.value && linkedCalendar.value?.icalUrl))
const chatStatusMessage = computed(() => {
  if (!isAuthReady.value) {
    return 'Controllo il tuo account...'
  }

  if (!currentUser.value) {
    return 'Accedi e collega il tuo calendario iCal per fare domande sulle prossime lezioni.'
  }

  if (isCalendarLoading.value) {
    return 'Sto verificando il calendario collegato...'
  }

  if (!linkedCalendar.value?.icalUrl) {
    return 'Inserisci il link iCal qui sopra per attivare l assistente del calendario.'
  }

  return 'Calendario pronto. Puoi chiedere quali lezioni hai oggi o quando inizia la prossima.'
})
const chatInputPlaceholder = computed(() => {
  if (isChatLoading.value) {
    return 'Attendo la risposta...'
  }

  if (!currentUser.value) {
    return 'Accedi per collegare il calendario'
  }

  if (!linkedCalendar.value?.icalUrl) {
    return 'Aggiungi prima il link iCal'
  }

  return 'Chiedi qualcosa sulle lezioni...'
})

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  await refreshAuthState(data.session ?? null)
  isAuthReady.value = true

  const authListener = supabase.auth.onAuthStateChange(async (_event, session) => {
    await refreshAuthState(session)
    isAuthReady.value = true
  })

  authSubscription = authListener.data.subscription
})

onBeforeUnmount(() => {
  authSubscription?.unsubscribe()
})
</script>

<template>
  <section id="calendar-setup" class="calendar-assistant" aria-labelledby="calendar-assistant-title">
    <header class="calendar-assistant__header">
      <div>
        <p class="eyebrow">Calendar setup</p>
        <h2 id="calendar-assistant-title">Connect the iCal once, then ask about classes</h2>
        <p class="calendar-assistant__copy">
          Il link iCal viene salvato nel campo <code>calendar_url</code> della tabella
          <code>user_info</code> e riutilizzato per ogni domanda sulle prossime lezioni.
        </p>
      </div>

      <div v-if="currentUser" class="calendar-assistant__account">
        <span>{{ currentUser.email }}</span>
        <button type="button" class="ghost-button" :disabled="isSigningOut" @click="handleSignOut">
          {{ isSigningOut ? 'Esco...' : 'Logout' }}
        </button>
      </div>
      <NuxtLink v-else class="ghost-link" to="/login">Login required</NuxtLink>
    </header>

    <div class="calendar-assistant__grid">
      <section class="calendar-card">
        <template v-if="!currentUser">
          <p class="status-line status-line--info">
            Fai login prima di associare il calendario a uno specifico account.
          </p>
        </template>

        <template v-else-if="linkedCalendar && !isEditingCalendarLink">
          <p class="status-line status-line--success">
            Calendario collegato{{ savedCalendarName ? `: ${savedCalendarName}` : '' }}.
          </p>
          <p class="calendar-url">{{ linkedCalendar.icalUrl }}</p>

          <p v-if="nextUpcomingEvent" class="next-event">
            Prossima lezione:
            <strong>{{ nextUpcomingEvent.title }}</strong>
            <span>{{ formatCalendarEvent(nextUpcomingEvent) }}</span>
          </p>

          <ul v-if="visibleUpcomingEvents.length" class="preview-list">
            <li v-for="event in visibleUpcomingEvents" :key="event.id">
              <strong>{{ event.title }}</strong>
              <span>{{ formatCalendarEvent(event) }}</span>
              <small v-if="event.location">{{ event.location }}</small>
            </li>
          </ul>

          <button type="button" class="ghost-button" @click="openCalendarEditor">
            Change iCal link
          </button>
        </template>

        <form v-else class="calendar-form" @submit.prevent="handleSaveCalendar">
          <label class="field">
            <span>iCal link</span>
            <input
              v-model.trim="calendarFormUrl"
              type="text"
              placeholder="webcal://... oppure https://.../calendar.ics"
              required
            />
          </label>

          <p class="helper-text">
            Il server valida il feed, lo converte in eventi JSON e poi l agente usa quei dati
            per rispondere alle domande sulle lezioni.
          </p>

          <p v-if="calendarFormError" class="status-line status-line--error">{{ calendarFormError }}</p>
          <p v-else-if="calendarFormSuccess" class="status-line status-line--success">
            {{ calendarFormSuccess }}
          </p>
          <p v-else-if="isCalendarLoading" class="status-line status-line--info">
            Sto caricando il calendario salvato...
          </p>

          <div class="form-actions">
            <button class="primary-button" type="submit" :disabled="isSavingCalendar">
              {{ isSavingCalendar ? 'Collego...' : 'Save iCal link' }}
            </button>
            <button
              v-if="linkedCalendar && isEditingCalendarLink"
              type="button"
              class="ghost-button"
              @click="cancelCalendarEditor"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section class="calendar-card">
        <p class="eyebrow">Campus AI Assistant</p>
        <h3 class="chat-title">Ask about your upcoming classes</h3>
        <p class="calendar-assistant__copy">
          Una volta collegato l iCal, l assistente legge le prossime lezioni e risponde in base
          agli eventi trovati.
        </p>

        <p class="status-line status-line--info">{{ chatStatusMessage }}</p>

        <div class="prompt-list" aria-label="Suggested prompts">
          <button
            v-for="prompt in starterPrompts"
            :key="prompt"
            type="button"
            class="prompt-chip"
            :disabled="!canUseCalendarAssistant || isChatLoading"
            @click="useStarterPrompt(prompt)"
          >
            {{ prompt }}
          </button>
        </div>

        <div class="chat-window" aria-live="polite">
          <div
            v-for="(message, index) in chatMessages"
            :key="`${message.role}-${index}`"
            class="message-row"
            :class="`message-row--${message.role}`"
          >
            <div class="message-bubble" :class="`message-bubble--${message.role}`">
              {{ message.text }}
            </div>
          </div>
        </div>

        <form class="chat-form" @submit.prevent="submitChat">
          <label class="sr-only" for="calendar-assistant-input">Ask about your classes</label>
          <input
            id="calendar-assistant-input"
            v-model="userPrompt"
            type="text"
            class="chat-input"
            :placeholder="chatInputPlaceholder"
            :disabled="!canUseCalendarAssistant || isChatLoading"
          />
          <button class="primary-button" type="submit" :disabled="!canUseCalendarAssistant || isChatLoading">
            {{ isChatLoading ? 'Invio...' : 'Invia' }}
          </button>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.calendar-assistant {
  margin-top: 30px;
  padding: 28px;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
}

.calendar-assistant__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.calendar-assistant__header h2,
.chat-title {
  margin: 0;
  color: #7c2d12;
}

.calendar-assistant__copy {
  margin: 12px 0 0;
  color: #475569;
  line-height: 1.6;
}

.calendar-assistant__account {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 247, 237, 0.96);
  color: #9a3412;
  font-weight: 600;
}

.calendar-assistant__grid {
  margin-top: 24px;
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  gap: 20px;
}

.calendar-card {
  padding: 24px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, rgba(255, 251, 235, 0.94) 0%, rgba(255, 255, 255, 0.9) 100%);
}

.calendar-form,
.field {
  display: grid;
  gap: 12px;
}

.field span {
  font-weight: 700;
  color: #7c2d12;
}

.field input,
.chat-input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 16px;
  padding: 14px 16px;
  font: inherit;
  background: rgba(255, 255, 255, 0.95);
  color: #1f2937;
}

.field input:focus,
.chat-input:focus {
  outline: 2px solid rgba(217, 119, 6, 0.2);
  border-color: rgba(217, 119, 6, 0.45);
}

.helper-text,
.calendar-url,
.next-event span,
.preview-list span,
.preview-list small {
  color: #475569;
}

.calendar-url {
  margin: 10px 0 0;
  word-break: break-word;
}

.status-line {
  margin: 14px 0 0;
  padding: 12px 14px;
  border-radius: 14px;
  line-height: 1.5;
}

.status-line--info {
  background: rgba(255, 247, 237, 0.95);
  color: #9a3412;
}

.status-line--success {
  background: rgba(220, 252, 231, 0.7);
  color: #166534;
}

.status-line--error {
  background: rgba(254, 226, 226, 0.8);
  color: #991b1b;
}

.form-actions,
.chat-form {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}

.chat-form {
  align-items: stretch;
}

.chat-input {
  flex: 1;
}

.primary-button,
.ghost-button,
.ghost-link,
.prompt-chip {
  border: 0;
  border-radius: 999px;
  font: inherit;
  text-decoration: none;
}

.primary-button,
.ghost-button,
.ghost-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  font-weight: 700;
}

.primary-button {
  color: #fff;
  background: linear-gradient(135deg, #c2410c, #f97316);
  box-shadow: 0 14px 26px rgba(217, 119, 6, 0.22);
}

.ghost-button,
.ghost-link {
  color: #9a3412;
  background: rgba(255, 237, 213, 0.92);
}

.primary-button:disabled,
.ghost-button:disabled,
.prompt-chip:disabled {
  opacity: 0.7;
  cursor: wait;
}

.next-event {
  margin: 16px 0 0;
  display: grid;
  gap: 4px;
}

.preview-list {
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.preview-list li {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.prompt-list {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.prompt-chip {
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.95), rgba(254, 215, 170, 0.9));
  color: #9a3412;
  font-weight: 600;
}

.chat-window {
  min-height: 300px;
  max-height: 360px;
  margin-top: 18px;
  overflow: auto;
  padding: 12px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(251, 191, 36, 0.22);
  display: grid;
  gap: 12px;
}

.message-row {
  display: flex;
}

.message-row--assistant {
  justify-content: flex-start;
}

.message-row--user {
  justify-content: flex-end;
}

.message-bubble {
  max-width: min(90%, 380px);
  padding: 14px 16px;
  border-radius: 18px;
  line-height: 1.55;
  font-size: 0.96rem;
}

.message-bubble--assistant {
  background: #fff7ed;
  color: #7c2d12;
  border-top-left-radius: 6px;
}

.message-bubble--user {
  background: linear-gradient(135deg, #d97706, #f97316);
  color: #fff;
  border-top-right-radius: 6px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .calendar-assistant {
    padding: 22px 18px;
  }

  .calendar-assistant__header,
  .calendar-assistant__grid,
  .chat-form,
  .form-actions {
    display: grid;
  }

  .calendar-assistant__grid {
    grid-template-columns: 1fr;
  }

  .chat-form,
  .form-actions {
    gap: 12px;
  }
}
</style>
