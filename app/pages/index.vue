<script setup lang="ts">
// In Nuxt/Vue, <script setup> rende disponibili variabili e funzioni direttamente nel template.
// lang="ts" significa che questo blocco usa TypeScript, quindi possiamo dichiarare tipi.

// type crea una "forma" per gli oggetti del menu: ogni bottone deve avere queste proprieta.
type MenuButton = {
  // id e un numero usato come chiave unica nel v-for.
  id: number
  // text e la scritta mostrata all'utente dentro il bottone.
  text: string
  // link e la destinazione teorica del bottone.
  link: string
  // iconPath contiene il path SVG dell'icona: viene passato all'attributo d del tag <path>.
  iconPath: string
  // colorExpanded contiene classi Tailwind usate quando il menu e aperto.
  colorExpanded: string
  // colorCollapsed contiene classi Tailwind usate quando il menu e chiuso.
  colorCollapsed: string
}

// Questo tipo descrive un messaggio della chat.
type ChatMessage = {
  // role puo essere solo "assistant" oppure "user": TypeScript blocca altri valori.
  role: 'assistant' | 'user'
  // text contiene il testo visualizzato nella bolla del messaggio.
  text: string
}

type CampusChatResponse = {
  reply: string
  sessionId: string
}

// Tipo minimo per usare la Web Speech API senza importare librerie esterne.
type BrowserSpeechRecognitionResult = {
  readonly [index: number]: { transcript: string } | undefined
}

// Evento ricevuto quando il browser trascrive la voce.
type BrowserSpeechRecognitionResultEvent = {
  results: ArrayLike<BrowserSpeechRecognitionResult>
}

// Evento ricevuto quando il browser segnala un errore del microfono.
type BrowserSpeechRecognitionErrorEvent = {
  error?: string
}

// Oggetto recognition creato dal browser per ascoltare il microfono.
type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: BrowserSpeechRecognitionResultEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

// Costruttore del riconoscimento vocale.
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

// Estende window con SpeechRecognition e webkitSpeechRecognition, perche TypeScript non sempre li conosce.
type BrowserWindowWithSpeech = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
}

// ref crea una variabile reattiva: quando cambia .value, Vue aggiorna automaticamente il template.
// Qui parte da false, quindi il menu inizialmente non e espanso.
const isExpanded = ref(false)

// buttons e una lista reattiva di oggetti MenuButton.
// La sintassi ref<MenuButton[]>(...) dice a TypeScript: "questa ref contiene un array di MenuButton".
const buttons = ref<MenuButton[]>([
  {
    // Primo bottone del menu.
    id: 1,
    text: 'Classroom navigation',
    link: '/classroom navigation',
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    colorExpanded: 'bg-blue-50 text-blue-600 border-blue-500 hover:bg-blue-100',
    colorCollapsed: 'bg-white text-blue-500 border-blue-400 hover:bg-blue-50'
  },
  {
    // Secondo bottone del menu.
    id: 2,
    text: 'TODO',
    link: '/TODO',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    colorExpanded: 'bg-emerald-50 text-emerald-600 border-emerald-500 hover:bg-emerald-100',
    colorCollapsed: 'bg-white text-emerald-500 border-emerald-400 hover:bg-emerald-50'
  },
  {
    // Terzo bottone del menu.
    id: 3,
    text: 'TODO',
    link: '/TODO',
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    colorExpanded: 'bg-purple-50 text-purple-600 border-purple-500 hover:bg-purple-100',
    colorCollapsed: 'bg-white text-purple-500 border-purple-400 hover:bg-purple-50'
  }
])

// Array costante con i suggerimenti iniziali della chat.
const starterPrompts = [
  'Where is the admissions office?',
  'What are the library opening hours?'
] as const

// Lista reattiva dei messaggi della chat.
// Parte con un messaggio iniziale dell'assistente.
const chatMessages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    text: 'A first chatbot concept for asking questions about the campus, services, offices, directions, and student support.'
  }
])

// Testo scritto dall'utente nell'input della chat.
const userPrompt = ref('')

// Stato di caricamento della chat mentre aspettiamo la risposta dell'agente n8n.
const isChatLoading = ref(false)

// Chiave usata per mantenere la stessa sessione n8n nello stesso browser.
const campusChatSessionStorageKey = 'campus-ai-assistant-session-id'

// Controlla se il pannello classroom navigation e visibile nella stessa pagina.
const showClassroomNavigation = ref(false)

// Testo scritto o dettato dall'utente nella barra della classroom navigation.
const classroomPrompt = ref('')

// Ultima richiesta inviata nella classroom navigation.
const classroomLastQuestion = ref('')

// Risposta del sistema: per ora rimane TODO, come placeholder per la risposta futura.
const classroomSystemResponse = ref('TODO')

// Stato testuale del microfono, utile per spiegare cosa sta succedendo all'utente.
const classroomVoiceStatus = ref('Microphone ready')

// True quando il browser sta ascoltando dal microfono.
const isClassroomListening = ref(false)

// Riferimento all'oggetto SpeechRecognition, cosi possiamo fermarlo quando serve.
let classroomRecognition: BrowserSpeechRecognition | null = null

// Questa funzione apre/chiude il menu dei servizi.
function toggleExpand() {
  // Con una ref bisogna leggere e scrivere il valore tramite .value.
  // Il punto esclamativo logico ! inverte il booleano: true diventa false, false diventa true.
  isExpanded.value = !isExpanded.value

  // import.meta.client e true solo nel browser.
  // Serve per evitare errori lato server, dove document non esiste.
  if (import.meta.client) {
    // Se il menu e aperto blocchiamo lo scroll della pagina; se e chiuso lo riattiviamo.
    document.body.style.overflow = isExpanded.value ? 'hidden' : 'hidden'
  }
}

// Questa funzione riceve il bottone cliccato.
// button: MenuButton significa che il parametro deve avere la forma definita sopra.
function goToPage(button: MenuButton) {
  // Se il bottone cliccato e quello con id 1, apriamo la schermata nella stessa pagina.
  if (button.id === 1) {
    openClassroomNavigation()
    return
  }

  // Anche qui controlliamo di essere nel browser, perche window esiste solo lato client.
  if (import.meta.client) {
    // Per ora mostra un alert invece di fare una vera navigazione.
    // Template literal: con `...${button.link}...` inseriamo il valore della variabile nella stringa.
    window.alert(`Navigo a: ${button.link}`)
  }
}

// Mostra il pannello classroom navigation e chiude il menu espanso.
function openClassroomNavigation() {
  showClassroomNavigation.value = true
  isExpanded.value = false

  if (import.meta.client) {
    document.body.style.overflow = 'hidden'
  }

  // nextTick aspetta che Vue aggiorni il DOM prima di cercare l'elemento da scrollare.
  nextTick(() => {
    if (import.meta.client) {
      document.getElementById('classroom-navigation-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }
  })
}

// Nasconde il pannello classroom navigation e ferma il microfono se era attivo.
function closeClassroomNavigation() {
  showClassroomNavigation.value = false
  stopClassroomMicrophone()
}

// Restituisce il costruttore SpeechRecognition disponibile nel browser, se esiste.
function getSpeechRecognitionConstructor() {
  if (!import.meta.client) {
    return null
  }

  const browserWindow = window as BrowserWindowWithSpeech

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null
}

// Accende o spegne il microfono in base allo stato attuale.
function toggleClassroomMicrophone() {
  if (isClassroomListening.value) {
    stopClassroomMicrophone()
    return
  }

  startClassroomMicrophone()
}

// Avvia l'ascolto vocale e copia la trascrizione dentro la textbar.
function startClassroomMicrophone() {
  const SpeechRecognitionConstructor = getSpeechRecognitionConstructor()

  if (!SpeechRecognitionConstructor) {
    classroomVoiceStatus.value = 'Speech recognition is not supported by this browser.'
    return
  }

  classroomRecognition = new SpeechRecognitionConstructor()
  classroomRecognition.lang = import.meta.client ? navigator.language : 'en-US'
  classroomRecognition.interimResults = false
  classroomRecognition.continuous = false

  classroomRecognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? '')
      .join(' ')
      .trim()

    if (transcript) {
      classroomPrompt.value = transcript
      classroomVoiceStatus.value = 'Voice input captured. Press Ask to send it.'
    }
  }

  classroomRecognition.onerror = (event) => {
    isClassroomListening.value = false
    classroomVoiceStatus.value = `Microphone error: ${event.error ?? 'unknown error'}`
  }

  classroomRecognition.onend = () => {
    isClassroomListening.value = false
  }

  try {
    classroomRecognition.start()
    isClassroomListening.value = true
    classroomVoiceStatus.value = 'Listening... say the classroom name or your navigation question.'
  } catch {
    isClassroomListening.value = false
    classroomVoiceStatus.value = 'The microphone could not be started.'
  }
}

// Ferma il riconoscimento vocale se e attivo.
function stopClassroomMicrophone() {
  if (!classroomRecognition) {
    isClassroomListening.value = false
    return
  }

  try {
    classroomRecognition.stop()
  } catch {
    // Se il browser ha gia fermato il microfono, non serve fare altro.
  }

  classroomRecognition = null
  isClassroomListening.value = false
  classroomVoiceStatus.value = 'Microphone stopped'
}

// Invia la domanda della classroom navigation e prepara l'area risposta.
function submitClassroomQuestion() {
  const question = classroomPrompt.value.trim()

  if (!question) {
    return
  }

  classroomLastQuestion.value = question
  classroomSystemResponse.value = 'TODO'
  classroomPrompt.value = ''
}

function createCampusChatSessionId() {
  const browserCrypto = import.meta.client
    ? window.crypto as (Crypto & { randomUUID?: () => string }) | undefined
    : undefined

  return browserCrypto?.randomUUID?.() ?? `campus-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Restituisce una sessione stabile per permettere a n8n di usare la memoria della conversazione.
function getCampusChatSessionId() {
  if (!import.meta.client) {
    return createCampusChatSessionId()
  }

  const existingSessionId = window.localStorage.getItem(campusChatSessionStorageKey)

  if (existingSessionId) {
    return existingSessionId
  }

  const sessionId = createCampusChatSessionId()
  window.localStorage.setItem(campusChatSessionStorageKey, sessionId)

  return sessionId
}

// Questa funzione viene usata quando l'utente clicca un suggerimento.
function useStarterPrompt(prompt: string) {
  // Copia il suggerimento dentro l'input.
  userPrompt.value = prompt
  // Invia subito la domanda come se l'utente avesse premuto Send.
  submitChat()
}

// Questa funzione gestisce l'invio del form della chat.
async function submitChat() {
  // trim rimuove spazi vuoti all'inizio e alla fine.
  const question = userPrompt.value.trim()

  // Se dopo trim non rimane testo, usciamo dalla funzione.
  if (!question || isChatLoading.value) {
    return
  }

  isChatLoading.value = true

  // push aggiunge un nuovo messaggio dell'utente alla lista reattiva.
  chatMessages.value.push({
    role: 'user',
    text: question
  })

  // Aggiunge un messaggio temporaneo mentre la route server interroga n8n.
  const assistantMessageIndex = chatMessages.value.push({
    role: 'assistant',
    text: 'Sto elaborando la tua richiesta...'
  }) - 1

  // Svuota l'input dopo l'invio.
  userPrompt.value = ''

  try {
    // Recupera il token di sessione di Supabase (JWT)
    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const response = await $fetch<CampusChatResponse>('/api/campus-chat', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 600000, // 10 minutes timeout for slow local LLM responses
      body: {
        message: question,
        sessionId: getCampusChatSessionId()
      }
    })

    chatMessages.value[assistantMessageIndex] = {
      role: 'assistant',
      text: response.reply
    }
  } catch (error: any) {
    const errorMsg = error.data?.statusMessage || error.message || 'Errore sconosciuto'
    chatMessages.value[assistantMessageIndex] = {
      role: 'assistant',
      text: `Non riesco a contattare l'agente in questo momento. (${errorMsg})`
    }
  } finally {
    isChatLoading.value = false
  }
}

// onBeforeUnmount viene eseguito quando il componente sta per essere rimosso dalla pagina.
onBeforeUnmount(() => {
  // Ferma anche il microfono se l'utente cambia pagina mentre sta ascoltando.
  stopClassroomMicrophone()

  // Ripristina lo scroll nel caso il componente venga chiuso mentre il menu e aperto.
  if (import.meta.client) {
    document.body.style.overflow = 'auto'
  }
})
</script>

<template>
  <main class="home-shell">
    <div class="background-orb orb-left" />
    <div class="background-orb orb-right" />

    <NuxtLink class="login-link" to="/login" aria-label="Open login page">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
      </svg>
    </NuxtLink>

    <section class="home-panel">
      <!-- Card principale della pagina. -->
      <div class="hero-card">
        <p class="eyebrow">Home</p>
        <h1>Start Guided Tour.</h1>
        <p class="hero-copy">
          You can use AR mode for an immersive experience
        </p>
        <div class="hero-actions">
          <button type="button" class="hero-button">AR Mode</button>
          <button type="button" class="hero-button">Text Mode</button>
        </div>
      </div>

      <!-- Sezione del menu animato dei servizi. -->
      <section class="services-menu-section">
        <div class="app-container">
          <div
            class="w-full flex items-center justify-center transition-colors duration-[800ms]"
            :class="isExpanded ? 'fixed inset-0 z-40 bg-white' : 'rounded-[2.5rem] bg-gray-50/90 p-4'"
          >
            <div
              class="bg-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.1,0.64,1)] flex flex-col overflow-hidden"
              :class="isExpanded
                ? 'w-[100vw] h-[100vh] p-8 sm:p-12 rounded-none z-50'
                : 'w-full max-w-xs h-60 p-6 rounded-[2rem] shadow-xl border border-gray-100 cursor-pointer hover:shadow-2xl relative'"
              @click="!isExpanded && toggleExpand()"
            >
              <div
                class="flex items-center justify-between transition-all duration-[800ms]"
                :class="isExpanded ? 'mb-16 sm:mb-20' : 'mb-6'"
              >
                <span
                  class="font-black tracking-tight text-gray-900 transition-all duration-[800ms]"
                  :class="isExpanded ? 'text-5xl sm:text-6xl' : 'text-xl'"
                >
                  Main Services
                </span>

                <button
                  type="button"
                  :aria-expanded="isExpanded"
                  :aria-label="isExpanded ? 'Close services menu' : 'Open services menu'"
                  class="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-all duration-[800ms] focus:outline-none z-20 relative"
                  :class="isExpanded ? 'text-gray-400' : 'text-blue-500'"
                  @click.stop="toggleExpand"
                >
                  <div class="relative w-7 h-7">
                    <svg
                      :class="isExpanded ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'"
                      class="absolute inset-0 w-7 h-7 transition-all duration-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                    <svg
                      :class="isExpanded ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'"
                      class="absolute inset-0 w-7 h-7 transition-all duration-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </button>
              </div>

              <div
                class="transition-all duration-[800ms] flex flex-col w-full"
                :class="isExpanded ? 'flex-1 justify-start max-w-3xl mx-auto' : 'justify-start'"
              >
                <div class="relative w-full" :style="{ height: isExpanded ? '190px' : '56px' }">
                  <button
                    v-for="(button, index) in buttons"
                    :key="button.id"
                    type="button"
                    class="absolute transition-all duration-[800ms] flex items-center justify-center overflow-hidden group focus:outline-none border-2"
                    :style="{
                      transitionDelay: isExpanded ? `${index * 120}ms` : `${(2 - index) * 40}ms`,
                      transitionTimingFunction: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
                      top: isExpanded ? (index === 2 ? '104px' : '0px') : '0px',
                      left: isExpanded ? (index === 1 ? 'calc(50% + 10px)' : '0px') : `${index * 68}px`,
                      width: isExpanded ? (index === 2 ? '100%' : 'calc(50% - 10px)') : '56px',
                      height: isExpanded ? '80px' : '56px',
                      borderRadius: isExpanded ? '1.5rem' : '50%'
                    }"
                    :class="isExpanded
                      ? `shadow-lg ${button.colorExpanded}`
                      : `${button.colorCollapsed} shadow-sm`"
                    @click.stop="goToPage(button)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="absolute transition-all duration-[500ms] w-7 h-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2.5"
                      :style="{ transitionDelay: isExpanded ? '0ms' : `${(2 - index) * 40 + 350}ms` }"
                      :class="isExpanded ? 'opacity-0 scale-50' : 'opacity-100 scale-100'"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" :d="button.iconPath" />
                    </svg>

                    <div
                      class="flex items-center space-x-4 transition-all duration-[500ms]"
                      :style="{ transitionDelay: isExpanded ? `${index * 120 + 400}ms` : '0ms' }"
                      :class="isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75'"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-7 h-7 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2.5"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" :d="button.iconPath" />
                      </svg>
                      <span class="font-bold text-xl sm:text-2xl tracking-tight">{{ button.text }}</span>
                    </div>
                  </button>
                </div>
              </div>

              <p
                class="transition-all duration-300 text-sm font-medium text-gray-400 absolute bottom-6 left-6"
                :class="isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-500'"
              >
                Tocca per esplorare
              </p>

              <div
                class="transition-all duration-[800ms] text-center text-gray-300 pb-8"
                :class="isExpanded ? 'opacity-100 delay-[800ms]' : 'opacity-0 absolute bottom-0 pointer-events-none w-full left-0'"
              >
                <p class="uppercase tracking-widest text-xs font-bold">Menu Navigazione</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="showClassroomNavigation"
        id="classroom-navigation-panel"
        class="classroom-navigation"
        aria-labelledby="classroom-navigation-title"
      >
        <div class="classroom-navigation-header">
          <div>
            <p class="eyebrow">Classroom navigation</p>
            <h2 id="classroom-navigation-title">Reach the target classroom</h2>
          </div>

          <button
            type="button"
            class="classroom-close"
            aria-label="Close classroom navigation"
            @click="closeClassroomNavigation"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div class="classroom-console">
          <div class="classroom-response">
            <div class="classroom-response-header">
              <span>System response</span>
              <strong>TODO</strong>
            </div>
            <p v-if="classroomLastQuestion" class="classroom-last-question">
              Asked: {{ classroomLastQuestion }}
            </p>
            <p>{{ classroomSystemResponse }}</p>
          </div>

          <div class="classroom-input-area">
            <p class="classroom-console-copy">
              Enable the microphone, say the classroom name, or type the destination manually.
            </p>
            <form class="classroom-command-bar" @submit.prevent="submitClassroomQuestion">
              <button
                type="button"
                class="classroom-mic-button"
                :class="{ 'classroom-mic-button--active': isClassroomListening }"
                :aria-pressed="isClassroomListening"
                :aria-label="isClassroomListening ? 'Stop microphone' : 'Enable microphone'"
                @click="toggleClassroomMicrophone"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z" />
                </svg>
              </button>
              <input
                v-model="classroomPrompt"
                type="text"
                class="classroom-command-input"
                placeholder="Tell classroom name or ask for a route..."
              >
              <button type="submit" class="classroom-ask-button">Ask</button>
            </form>
            <p class="classroom-voice-status" aria-live="polite">
              {{ classroomVoiceStatus }}
            </p>
          </div>
        </div>
      </section>

      <!-- Sezione chatbot. aria-labelledby collega la section al titolo h2 con id campus-ai-title. -->
      <section class="chatbot-section" aria-labelledby="campus-ai-title">
        <div class="chatbot-copy">
          <p class="eyebrow">New</p>
          <div class="chatbot-heading">
            <h2 id="campus-ai-title">Campus AI Assistant</h2>
            <span class="chatbot-badge">Calendario lezioni</span>
          </div>
          <p class="chatbot-description">
            Chiedi informazioni sulle lezioni, sugli orari e sui prossimi impegni
            salvati nel calendario.
          </p>

          <!-- Lista dei suggerimenti: ogni prompt genera un bottone. -->
          <!-- Quando clicchi il suggerimento, passa la stringa prompt alla funzione. -->
          <div class="prompt-list" aria-label="Suggested prompts">
            <button
              v-for="prompt in starterPrompts"
              :key="prompt"
              type="button"
              class="prompt-chip"
              @click="useStarterPrompt(prompt)"
            >
              {{ prompt }}
            </button>
          </div>
        </div>

        <div class="chatbot-card">
          <div class="chatbot-window" aria-live="polite">
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

          <div class="ai-assistant-block">
            <div class="chatbot-heading">
              <h2 id="campus-ai-title">Campus AI Assistant</h2>
            </div>

            <div class="prompt-list" aria-label="Suggested prompts">
              <button
                v-for="prompt in starterPrompts"
                :key="prompt"
                type="button"
                class="prompt-chip"
                @click="useStarterPrompt(prompt)"
              >
                {{ prompt }}
              </button>
            </div>
          </div>

          <form class="chatbot-form" @submit.prevent="submitChat">
            <label class="sr-only" for="campus-ai-input">Ask the campus assistant</label>
            <input
              id="campus-ai-input"
              v-model="userPrompt"
              type="text"
              class="chatbot-input"
              :placeholder="isChatLoading ? 'Attendo la risposta...' : 'Chiedi qualcosa sulle lezioni...'"
              :disabled="isChatLoading"
            >
            <!-- type="submit" invia il form e quindi attiva @submit.prevent sopra. -->
            <button type="submit" class="chatbot-send" :disabled="isChatLoading">
              {{ isChatLoading ? 'Invio...' : 'Invia' }}
            </button>
          </form>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(255, 200, 87, 0.24), transparent 30%),
    linear-gradient(180deg, #fff8ef 0%, #f4efe8 100%);
  color: #1f2937;
  overflow: hidden; /* prevents body scroll */
}

:global(a) {
  color: inherit;
  text-decoration: none;
}

.home-shell {
  --panel-bg: rgba(255, 255, 255, 0.78);
  --panel-border: rgba(148, 163, 184, 0.22);
  --primary: #d97706;
  --primary-dark: #9a3412;
  --shadow: 0 28px 60px rgba(120, 53, 15, 0.16);
  height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.background-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(8px);
  opacity: 0.8;
}

.orb-left {
  width: 240px;
  height: 240px;
  background: rgba(251, 191, 36, 0.22);
  top: 5%;
  left: -80px;
}

.orb-right {
  width: 320px;
  height: 320px;
  background: rgba(249, 115, 22, 0.14);
  bottom: -120px;
  right: -80px;
}

.home-panel {
  width: min(760px, 100%);
  height: 100%;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  z-index: 1;
  gap: 12px; /* reduced gap to fit elements tightly */
}

.login-link {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 2;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.login-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
}

.login-link svg {
  width: 24px;
  height: 24px;
  fill: var(--primary-dark);
}

.hero-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 28px;
  padding: 16px; /* reduced padding */
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  text-align: center;
  flex-shrink: 0;
}

.eyebrow {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  color: #b45309;
}

.hero-card h1 {
  margin: 0;
  font-size: clamp(1.4rem, 2.5vw, 2.2rem); /* reduced size */
  line-height: 1.05;
}

.hero-copy {
  max-width: 520px;
  margin: 10px auto 14px;
  font-size: 0.9rem; /* reduced size */
  line-height: 1.5;
  color: #475569;
}

.hero-button {
  border: 0;
  border-radius: 999px;
  padding: 10px 20px; /* reduced padding */
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), #f97316);
  box-shadow: 0 16px 28px rgba(217, 119, 6, 0.28);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hero-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(217, 119, 6, 0.35);
}

.hero-actions {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.services-menu-section {
  flex-shrink: 0;
}

.classroom-navigation {
  padding: 16px;
  border: 1px solid rgba(59, 130, 246, 0.18);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.88));
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.classroom-navigation-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.classroom-navigation h2 {
  margin: 0;
  font-size: clamp(1.4rem, 2.5vw, 2rem);
  line-height: 1.1;
  color: #1e3a8a;
}

.classroom-close {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(59, 130, 246, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  color: #1e40af;
  cursor: pointer;
}

.classroom-close svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 2.5;
}

.classroom-console {
  min-width: 0;
  flex: 1;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  display: grid;
  grid-template-rows: minmax(100px, 1fr) auto;
  gap: 12px;
  min-height: 0;
}

.classroom-input-area {
  align-self: end;
}

.classroom-console-copy {
  margin: 0 0 10px;
  color: #475569;
  line-height: 1.4;
  font-size: 0.85rem;
}

.classroom-command-bar {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: stretch;
}

.classroom-mic-button {
  width: 42px;
  min-height: 42px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: #1e40af;
  color: #fff;
  cursor: pointer;
}

.classroom-mic-button--active {
  background: #dc2626;
}

.classroom-mic-button svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.classroom-command-input {
  min-width: 0;
  width: 100%;
  border: 1px solid rgba(59, 130, 246, 0.24);
  border-radius: 8px;
  padding: 0 12px;
  font: inherit;
  font-size: 0.9rem;
  color: #1f2937;
  background: rgba(255, 255, 255, 0.96);
}

.classroom-command-input:focus {
  outline: 2px solid rgba(37, 99, 235, 0.18);
  border-color: rgba(37, 99, 235, 0.55);
}

.classroom-ask-button {
  min-height: 42px;
  border: 0;
  border-radius: 8px;
  padding: 0 14px;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  color: #fff;
  background: #0f766e;
  cursor: pointer;
}

.classroom-voice-status {
  min-height: 18px;
  margin: 8px 0 0;
  color: #475569;
  font-size: 0.85rem;
}

.classroom-response {
  padding: 12px;
  border: 1px solid rgba(15, 118, 110, 0.18);
  border-radius: 8px;
  background: rgba(240, 253, 250, 0.72);
  color: #134e4a;
  line-height: 1.5;
  overflow: auto;
  font-size: 0.85rem;
}

.classroom-response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #0f766e;
  font-weight: 800;
}

.classroom-response-header strong {
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(15, 118, 110, 0.12);
  font-size: 0.75rem;
}

.classroom-last-question {
  margin: 0 0 8px;
  color: #0f766e;
  font-weight: 700;
}

.classroom-response p {
  margin: 0;
}

.chatbot-section {
  display: flex;
  flex-direction: column;
  flex: 1; /* take remaining vertical space */
  min-height: 0; /* needed for flex children to shrink */
}

.chatbot-card {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  gap: 10px;
  background:
    linear-gradient(180deg, rgba(255, 251, 235, 0.95) 0%, rgba(255, 255, 255, 0.82) 100%);
}

.ai-assistant-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chatbot-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chatbot-heading h2 {
  margin: 0;
  font-size: clamp(1.1rem, 2vw, 1.4rem); /* reduced size */
  color: #7c2d12;
}

.prompt-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px; /* reduced */
}

.prompt-chip {
  border: 0;
  border-radius: 999px;
  padding: 8px 12px; /* reduced */
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.95), rgba(254, 215, 170, 0.9));
  color: #9a3412;
  font-size: 0.8rem; /* reduced */
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.prompt-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 22px rgba(217, 119, 6, 0.18);
}

.chatbot-window {
  min-height: 0; /* allows shrinking */
  flex: 1; /* takes all space possible */
  overflow-y: auto;
  padding: 10px; /* reduced */
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(251, 191, 36, 0.22);
  display: grid;
  align-content: start; /* align messages to top */
  gap: 10px; /* reduced */
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
  padding: 10px 14px; /* reduced */
  border-radius: 18px;
  line-height: 1.4;
  font-size: 0.85rem; /* reduced */
}

.message-bubble--assistant {
  background: #fff7ed;
  color: #7c2d12;
  border-top-left-radius: 6px;
}

.message-bubble--user {
  background: linear-gradient(135deg, var(--primary), #f97316);
  color: #fff;
  border-top-right-radius: 6px;
}

.chatbot-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px; /* reduced */
  flex-shrink: 0;
}

.chatbot-input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 18px;
  padding: 12px 14px; /* reduced */
  font: inherit;
  font-size: 0.85rem;
  color: #1f2937;
  background: rgba(255, 255, 255, 0.92);
}

.chatbot-input:focus {
  outline: 2px solid rgba(217, 119, 6, 0.2);
  border-color: rgba(217, 119, 6, 0.45);
}

.chatbot-input:disabled {
  cursor: wait;
  opacity: 0.72;
}

/* Pulsante invio della chat. */
.chatbot-send {
  border: 0;
  border-radius: 18px;
  padding: 0 16px; /* reduced */
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #c2410c, #f97316);
  cursor: pointer;
}

.chatbot-send:disabled {
  cursor: wait;
  opacity: 0.72;
}

/* Classe standard per testo visibile agli screen reader ma nascosto graficamente. */
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

@media (max-width: 640px) {
  .home-shell {
    padding: 76px 12px 12px; /* keep top space for login, reduce lateral */
  }

  .home-panel {
    gap: 10px;
  }

  .hero-card {
    padding: 14px 16px;
  }

  .hero-actions {
    gap: 10px;
  }

  .classroom-navigation {
    padding: 14px;
  }

  .classroom-navigation-header {
    align-items: flex-start;
  }

  .classroom-command-bar {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .classroom-ask-button {
    grid-column: 1 / -1;
  }

  .chatbot-card {
    padding-left: 14px;
    padding-right: 14px;
  }

  .chatbot-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .chatbot-form {
    grid-template-columns: 1fr;
  }

  .chatbot-send {
    min-height: 42px;
  }
}
</style>