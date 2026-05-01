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
  'Che lezione ho lunedi prossimo?',
  'Quali lezioni ho oggi?',
  'A che ora inizia la prossima lezione?',
  'Dove si tiene la prossima lezione?'
// as const rende i valori "letterali" e non semplici stringhe generiche.
] as const

// Lista reattiva dei messaggi della chat.
// Parte con un messaggio iniziale dell'assistente.
const chatMessages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    text: 'Ciao, sono il Campus AI Assistant. Posso controllare il calendario e aiutarti con le lezioni.'
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
    document.body.style.overflow = isExpanded.value ? 'hidden' : 'auto'
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
    document.body.style.overflow = 'auto'
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
  <!-- <template> contiene l'HTML del componente. Qui possiamo usare anche sintassi speciale di Vue. -->
  <!-- class="..." assegna classi CSS statiche: alcune sono classi locali, altre sono classi Tailwind. -->
  <main class="home-shell">
    <!-- Div decorativi vuoti -->
    <div class="background-orb orb-left" />
    <div class="background-orb orb-right" />

    <!-- NuxtLink e il componente Nuxt per creare link interni senza ricaricare tutta la pagina. -->
    <!-- to="/login" indica la rotta di destinazione. aria-label aiuta screen reader e accessibilita. -->
    <NuxtLink class="login-link" to="/login" aria-label="Open login page">
      <!-- svg disegna un'icona vettoriale; aria-hidden evita che venga letta come contenuto testuale. -->
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <!-- d contiene le coordinate del disegno SVG. -->
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
        />
      </svg>
    </NuxtLink>

    <!-- section raggruppa una parte della pagina. -->
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
      <section class="mt-8">
        <div class="app-container">
          <!-- :class e abbreviazione di v-bind:class: la classe cambia in base a una variabile JS. -->
          <!-- Operatore ternario: condizione ? valore_se_true : valore_se_false. -->
          <div
            class="w-full flex items-center justify-center transition-colors duration-[800ms]"
            :class="isExpanded ? 'fixed inset-0 z-40 bg-white' : 'rounded-[2.5rem] bg-gray-50/90 p-4'"
          >
            <!-- @click e abbreviazione di v-on:click. Se il menu non e aperto, chiama toggleExpand(). -->
            <!-- && significa: esegue la seconda parte solo se la prima e vera. -->
            <div
              class="bg-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.1,0.64,1)] flex flex-col overflow-hidden"
              :class="isExpanded
                ? 'w-[100vw] h-[100vh] p-8 sm:p-12 rounded-none z-50'
                : 'w-full max-w-xs h-60 p-6 rounded-[2rem] shadow-xl border border-gray-100 cursor-pointer hover:shadow-2xl relative'"
              @click="!isExpanded && toggleExpand()"
            >
              <!-- Margin-bottom diverso a seconda che il menu sia aperto o chiuso. -->
              <div
                class="flex items-center justify-between transition-all duration-[800ms]"
                :class="isExpanded ? 'mb-16 sm:mb-20' : 'mb-6'"
              >
                <!-- Testo piu grande quando il menu e espanso. -->
                <span
                  class="font-black tracking-tight text-gray-900 transition-all duration-[800ms]"
                  :class="isExpanded ? 'text-5xl sm:text-6xl' : 'text-xl'"
                >
                  Main Services
                </span>

                <!-- :aria-expanded e :aria-label passano valori dinamici per l'accessibilita. -->
                <!-- .stop ferma la propagazione del click, cosi non scatta anche il click del contenitore padre. -->
                <button
                  type="button"
                  :aria-expanded="isExpanded"
                  :aria-label="isExpanded ? 'Close services menu' : 'Open services menu'"
                  class="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-all duration-[800ms] focus:outline-none z-20 relative"
                  :class="isExpanded ? 'text-gray-400' : 'text-blue-500'"
                  @click.stop="toggleExpand"
                >

                  <div class="relative w-7 h-7">
                    <!-- Prima icona: freccia visibile quando il menu e chiuso. -->
                    <svg
                      :class="isExpanded ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'"
                      class="absolute inset-0 w-7 h-7 transition-all duration-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                    <!-- Seconda icona: X visibile quando il menu e aperto. -->
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

              <!-- Quando e espanso occupa lo spazio disponibile; quando e chiuso resta semplice. -->
              <div
                class="transition-all duration-[800ms] flex flex-col w-full"
                :class="isExpanded ? 'flex-1 justify-start max-w-3xl mx-auto' : 'justify-start'"
              >
                <!-- :style permette di scrivere stili inline dinamici come oggetto JavaScript. -->
                <div class="relative w-full" :style="{ height: isExpanded ? '190px' : '56px' }">
                  <!-- v-for ripete questo bottone per ogni elemento dentro buttons. -->
                  <!-- button e l'oggetto corrente, index e la posizione nell'array: 0, 1, 2... -->
                  <!-- :key aiuta Vue a riconoscere ogni elemento quando la lista cambia. -->
                  <!-- :style calcola posizione, dimensioni e ritardi dell'animazione. -->
                  <!-- :class usa template literal per aggiungere classi salvate nell'oggetto button. -->
                  <!-- @click.stop passa alla funzione l'intero oggetto button. -->
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
                    <!-- Icona piccola, visibile soprattutto quando il menu e chiuso. -->
                    <!-- :d collega il path SVG al valore button.iconPath. -->
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

                    <!-- Contenuto testuale del bottone, visibile quando il menu e espanso. -->
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
                      <!-- Le doppie graffe {{ }} stampano nel template un valore JavaScript. -->
                      <span class="font-bold text-xl sm:text-2xl tracking-tight">{{ button.text }}</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Testo visibile solo quando il menu e chiuso. pointer-events-none evita click su elemento nascosto. -->
              <p
                class="transition-all duration-300 text-sm font-medium text-gray-400 absolute bottom-6 left-6"
                :class="isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-500'"
              >
                Tocca per esplorare
              </p>

              <!-- Footer del menu: appare solo nello stato espanso. -->
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

      <!-- Schermata interna che appare quando l'utente clicca il bottone con id 1. -->
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

            <!-- @submit.prevent evita il refresh pagina quando premi Enter o il bottone Ask. -->
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
                  <path
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z"
                  />
                </svg>
              </button>

              <!-- v-model collega la textbar a classroomPrompt. -->
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
          <!-- aria-live="polite" fa annunciare i nuovi messaggi agli screen reader senza interrompere bruscamente. -->
          <div class="chatbot-window" aria-live="polite">
            <!-- v-for scorre tutti i messaggi della chat. -->
            <!-- :key usa una chiave composta con role e index usando template literal. -->
            <!-- :class diventa message-row--assistant oppure message-row--user. -->
            <div
              v-for="(message, index) in chatMessages"
              :key="`${message.role}-${index}`"
              class="message-row"
              :class="`message-row--${message.role}`"
            >
              <!-- Anche la bolla cambia classe in base al role del messaggio. -->
              <div class="message-bubble" :class="`message-bubble--${message.role}`">
                {{ message.text }}
              </div>
            </div>
          </div>

          <!-- @submit.prevent intercetta il submit del form e impedisce il refresh della pagina. -->
          <form class="chatbot-form" @submit.prevent="submitChat">
            <!-- Label visivamente nascosta ma utile per accessibilita. -->
            <label class="sr-only" for="campus-ai-input">Ask the campus assistant</label>
            <!-- v-model collega input e variabile: quando scrivi cambia userPrompt, e viceversa. -->
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
/* <style scoped> applica questi CSS solo a questo componente, aggiungendo attributi interni generati da Vue. */
/* :global(...) serve quando vogliamo comunque modificare elementi globali come body o a. */
:global(body) {
  /* Toglie il margine predefinito del browser. */
  margin: 0;
  /* Imposta il font di base della pagina. */
  font-family: "Segoe UI", sans-serif;
  /* background puo contenere piu livelli: qui un radial-gradient sopra un linear-gradient. */
  background:
    radial-gradient(circle at top left, rgba(255, 200, 87, 0.24), transparent 30%),
    linear-gradient(180deg, #fff8ef 0%, #f4efe8 100%);
  /* Colore testo predefinito. */
  color: #1f2937;
}

/* Stile globale dei link: ereditano il colore del testo e non hanno sottolineatura. */
:global(a) {
  color: inherit;
  text-decoration: none;
}

/* Contenitore principale della pagina. */
.home-shell {
  /* Variabili CSS: si usano con var(--nome-variabile). */
  --panel-bg: rgba(255, 255, 255, 0.78);
  --panel-border: rgba(148, 163, 184, 0.22);
  --primary: #d97706;
  --primary-dark: #9a3412;
  --shadow: 0 28px 60px rgba(120, 53, 15, 0.16);
  /* min-height: 100vh rende il contenitore alto almeno quanto tutta la finestra. */
  min-height: 100vh;
  /* position: relative permette ai figli position:absolute di posizionarsi rispetto a questo box. */
  position: relative;
  /* Nasconde cio che esce dai bordi del contenitore. */
  overflow: hidden;
  /* Grid usata qui solo per centrare il contenuto. */
  display: grid;
  /* Scorciatoia per align-items + justify-items al centro. */
  place-items: center;
  padding: 32px 20px;
}

/* Forma decorativa sfocata usata come sfondo. */
.background-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(8px);
  opacity: 0.8;
}

/* Posizione e dimensione della forma decorativa sinistra. */
.orb-left {
  width: 240px;
  height: 240px;
  background: rgba(251, 191, 36, 0.22);
  top: 5%;
  left: -80px;
}

/* Posizione e dimensione della forma decorativa destra. */
.orb-right {
  width: 320px;
  height: 320px;
  background: rgba(249, 115, 22, 0.14);
  bottom: -120px;
  right: -80px;
}

/* Pannello che limita la larghezza del contenuto centrale. */
.home-panel {
  /* min(760px, 100%) sceglie il valore piu piccolo: massimo 760px, ma mai piu largo dello schermo. */
  width: min(760px, 100%);
  position: relative;
  /* z-index lo mette sopra le forme decorative. */
  z-index: 1;
}

/* Link/icona login in alto a destra. */
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

/* :hover si applica quando il mouse e sopra l'elemento. */
.login-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
}

/* Stile dell'SVG dentro il link login. */
.login-link svg {
  width: 24px;
  height: 24px;
  fill: var(--primary-dark);
}

/* Card superiore con titolo e pulsanti. */
.hero-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 28px;
  padding: 34px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  text-align: center;
}

/* Piccola etichetta sopra i titoli. */
.eyebrow {
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: #b45309;
}

/* Titolo principale dentro .hero-card. */
.hero-card h1 {
  margin: 0;
  /* clamp(min, ideale, max) rende il font responsive entro limiti. */
  font-size: clamp(2rem, 4vw, 3.3rem);
  line-height: 1.05;
}

/* Testo descrittivo sotto il titolo. */
.hero-copy {
  max-width: 520px;
  margin: 14px auto 26px;
  font-size: 1rem;
  line-height: 1.65;
  color: #475569;
}

/* Pulsanti della hero. */
.hero-button {
  border: 0;
  border-radius: 999px;
  padding: 14px 28px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), #f97316);
  box-shadow: 0 16px 28px rgba(217, 119, 6, 0.28);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Effetto hover dei pulsanti hero. */
.hero-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(217, 119, 6, 0.35);
}

/* Contenitore dei pulsanti: flex li affianca e flex-wrap li manda a capo se manca spazio. */
.hero-actions {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
}

/* Pannello classroom navigation mostrato nella stessa pagina. */
.classroom-navigation {
  margin-top: 30px;
  padding: 28px;
  border: 1px solid rgba(59, 130, 246, 0.18);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.88));
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
}

/* Testata del pannello con titolo e bottone chiusura. */
.classroom-navigation-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

/* Titolo principale della classroom navigation. */
.classroom-navigation h2 {
  margin: 0;
  font-size: clamp(1.7rem, 3vw, 2.5rem);
  line-height: 1.1;
  color: #1e3a8a;
}

/* Bottone per chiudere la schermata classroom navigation. */
.classroom-close {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(59, 130, 246, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  color: #1e40af;
  cursor: pointer;
}

/* Icona X dentro il bottone di chiusura. */
.classroom-close svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 2.5;
}

/* Console interna del pannello. */
.classroom-console {
  min-width: 0;
  min-height: 430px;
  padding: 18px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  display: grid;
  grid-template-rows: minmax(260px, 1fr) auto;
  gap: 16px;
}

/* Area in basso che contiene testo introduttivo, input, microfono e stato. */
.classroom-input-area {
  align-self: end;
}

/* Testo introduttivo della console vocale/testuale. */
.classroom-console-copy {
  margin: 0 0 16px;
  color: #475569;
  line-height: 1.6;
}

/* Barra di comando: microfono, input e invio. */
.classroom-command-bar {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: stretch;
}

/* Bottone microfono. */
.classroom-mic-button {
  width: 48px;
  min-height: 48px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: #1e40af;
  color: #fff;
  cursor: pointer;
}

/* Stato attivo del microfono. */
.classroom-mic-button--active {
  background: #dc2626;
}

/* Icona microfono. */
.classroom-mic-button svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

/* Textbar per scrivere o ricevere la trascrizione vocale. */
.classroom-command-input {
  min-width: 0;
  width: 100%;
  border: 1px solid rgba(59, 130, 246, 0.24);
  border-radius: 8px;
  padding: 0 14px;
  font: inherit;
  color: #1f2937;
  background: rgba(255, 255, 255, 0.96);
}

/* Focus della textbar. */
.classroom-command-input:focus {
  outline: 2px solid rgba(37, 99, 235, 0.18);
  border-color: rgba(37, 99, 235, 0.55);
}

/* Bottone Ask della classroom navigation. */
.classroom-ask-button {
  min-height: 48px;
  border: 0;
  border-radius: 8px;
  padding: 0 18px;
  font: inherit;
  font-weight: 800;
  color: #fff;
  background: #0f766e;
  cursor: pointer;
}

/* Riga di stato del microfono. */
.classroom-voice-status {
  min-height: 22px;
  margin: 10px 0 0;
  color: #475569;
  font-size: 0.92rem;
}

/* Area dove finira la risposta del sistema. */
.classroom-response {
  min-height: 260px;
  padding: 16px;
  border: 1px solid rgba(15, 118, 110, 0.18);
  border-radius: 8px;
  background: rgba(240, 253, 250, 0.72);
  color: #134e4a;
  line-height: 1.6;
  overflow: auto;
}

/* Intestazione dell'area risposta. */
.classroom-response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: #0f766e;
  font-weight: 800;
}

/* Badge TODO nella risposta. */
.classroom-response-header strong {
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(15, 118, 110, 0.12);
  font-size: 0.78rem;
}

/* Ultima domanda inviata. */
.classroom-last-question {
  margin: 0 0 10px;
  color: #0f766e;
  font-weight: 700;
}

/* Paragrafi dentro la risposta. */
.classroom-response p {
  margin: 0;
}

/* Layout della sezione chatbot: due colonne su schermi grandi. */
.chatbot-section {
  margin-top: 30px;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 20px;
  align-items: stretch;
}

/* Regole condivise da due blocchi: la virgola applica gli stessi stili a entrambi i selettori. */
.chatbot-copy,
.chatbot-card {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
}

/* Colonna testuale del chatbot. */
.chatbot-copy {
  padding: 28px;
}

/* Header del chatbot con titolo e badge affiancati. */
.chatbot-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

/* Titolo h2 dentro l'header del chatbot. */
.chatbot-heading h2 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  color: #7c2d12;
}

/* Badge piccolo accanto al titolo. */
.chatbot-badge {
  white-space: nowrap;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 237, 213, 0.95);
  color: #9a3412;
  font-size: 0.82rem;
  font-weight: 700;
}

/* Paragrafo descrittivo del chatbot. */
.chatbot-description {
  margin: 0;
  color: #475569;
  line-height: 1.7;
}

/* Lista dei suggerimenti: flex con elementi che possono andare a capo. */
.prompt-list {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Singolo chip/suggerimento cliccabile. */
.prompt-chip {
  border: 0;
  border-radius: 999px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.95), rgba(254, 215, 170, 0.9));
  color: #9a3412;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Effetto hover sui suggerimenti. */
.prompt-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 22px rgba(217, 119, 6, 0.18);
}

/* Card che contiene finestra messaggi e form. */
.chatbot-card {
  padding: 18px;
  display: grid;
  gap: 14px;
  background:
    linear-gradient(180deg, rgba(255, 251, 235, 0.95) 0%, rgba(255, 255, 255, 0.82) 100%);
}

/* Area scrollabile dei messaggi. */
.chatbot-window {
  min-height: 300px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(251, 191, 36, 0.22);
  display: grid;
  gap: 12px;
}

/* Riga generica di un messaggio. */
.message-row {
  display: flex;
}

/* I messaggi assistant vengono allineati a sinistra. */
.message-row--assistant {
  justify-content: flex-start;
}

/* I messaggi user vengono allineati a destra. */
.message-row--user {
  justify-content: flex-end;
}

/* Stile comune delle bolle messaggio. */
.message-bubble {
  max-width: min(90%, 380px);
  padding: 14px 16px;
  border-radius: 18px;
  line-height: 1.55;
  font-size: 0.96rem;
}

/* Bolla dell'assistente. */
.message-bubble--assistant {
  background: #fff7ed;
  color: #7c2d12;
  border-top-left-radius: 6px;
}

/* Bolla dell'utente. */
.message-bubble--user {
  background: linear-gradient(135deg, var(--primary), #f97316);
  color: #fff;
  border-top-right-radius: 6px;
}

/* Form della chat: input largo e pulsante a destra. */
.chatbot-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

/* Campo di testo della chat. */
.chatbot-input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 18px;
  padding: 14px 16px;
  font: inherit;
  color: #1f2937;
  background: rgba(255, 255, 255, 0.92);
}

/* :focus si applica quando l'input e selezionato per scrivere. */
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
  padding: 0 20px;
  font: inherit;
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

/* Media query: queste regole valgono solo quando la larghezza dello schermo e al massimo 640px. */
@media (max-width: 640px) {
  /* Su mobile aumenta il padding superiore per lasciare spazio al login in alto. */
  .home-shell {
    padding: 88px 16px 28px;
  }

  /* Riduce il padding della card principale su mobile. */
  .hero-card {
    padding: 26px 20px;
  }

  /* Avvicina leggermente i pulsanti su mobile. */
  .hero-actions {
    gap: 14px;
  }

  /* Il chatbot passa da due colonne a una sola colonna. */
  .chatbot-section {
    grid-template-columns: 1fr;
  }

  /* Il pannello classroom navigation occupa meno spazio laterale su mobile. */
  .classroom-navigation {
    padding: 20px;
  }

  /* Titolo e bottone chiusura restano leggibili su schermi stretti. */
  .classroom-navigation-header {
    align-items: flex-start;
  }

  /* La barra comando su mobile mette il bottone Ask sotto input e microfono. */
  .classroom-command-bar {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  /* Ask prende tutta la larghezza della seconda riga. */
  .classroom-ask-button {
    grid-column: 1 / -1;
  }

  /* Riduce il padding laterale delle card chatbot. */
  .chatbot-copy,
  .chatbot-card {
    padding-left: 20px;
    padding-right: 20px;
  }

  /* Titolo e badge del chatbot vanno uno sotto l'altro. */
  .chatbot-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  /* Il form passa da input+pulsante affiancati a una sola colonna. */
  .chatbot-form {
    grid-template-columns: 1fr;
  }

  /* Altezza minima comoda per tocco su mobile. */
  .chatbot-send {
    min-height: 48px;
  }
}
</style>
