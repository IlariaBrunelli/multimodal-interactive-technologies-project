<script lang="ts" setup>
import type { ArPermissionState, CampusArPosition } from '~/composables/useCampusAr'
import type { CampusBuilding } from '~/data/campusBuildings'
import { getChatLocationCoordinates } from '~/composables/useChatLocation'
import { useCampusAr } from '~/composables/useCampusAr'

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

type CampusBuildingRow = {
  id?: string | number | null
  name?: string | null
  alias?: string | null
  title?: string | null
  building_name?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  lat?: number | string | null
  lng?: number | string | null
  lon?: number | string | null
  long?: number | string | null
  altitude?: number | string | null
  label_altitude?: number | string | null
  labelAltitude?: number | string | null
  color?: string | null
}

type BuildingHistoricalDetailsRow = {
  historical_details?: string | null
}

type GuidedTourRow = CampusBuildingRow & {
  id?: string | number | null
  building_id?: string | number | null
  buildingId?: string | number | null
  storytelling?: string | null
  step?: number | string | null
  building?: CampusBuildingRow | null
  buildings?: CampusBuildingRow | null
  campus_buildings?: CampusBuildingRow | null
}

type GuidedTourStep = {
  id: string
  order: number
  storytelling: string | null
  building: CampusBuilding
}

type GuidedTourStepsResponse = {
  steps?: GuidedTourRow[]
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
    id: 1,
    text: 'Microwaves',
    link: '/microwaves',
    iconPath: 'M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M8 6v14 M18 10h.01 M18 14h.01',
    colorExpanded: 'bg-orange-50 text-orange-600 border-orange-500 hover:bg-orange-100',
    colorCollapsed: 'bg-white text-orange-500 border-orange-400 hover:bg-orange-50'
  },
  {
    id: 2,
    text: 'Plugs',
    link: '/plugs',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
    colorExpanded: 'bg-yellow-50 text-yellow-600 border-yellow-500 hover:bg-yellow-100',
    colorCollapsed: 'bg-white text-yellow-500 border-yellow-400 hover:bg-yellow-50'
  },
  {
    id: 3,
    text: 'Water Fountains',
    link: '/fountains',
    iconPath: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0z',
    colorExpanded: 'bg-cyan-50 text-cyan-600 border-cyan-500 hover:bg-cyan-100',
    colorCollapsed: 'bg-white text-cyan-500 border-cyan-400 hover:bg-cyan-50'
  },
  {
    id: 4,
    text: 'Food Places',
    link: '/food',
    iconPath: 'M9 3v6c0 1.66-1.34 3-3 3s-3-1.34-3-3V3m3 3v15 M15 3v18 M15 3c2.5 0 6 1.5 6 4s-3.5 4-6 4',
    colorExpanded: 'bg-rose-50 text-rose-600 border-rose-500 hover:bg-rose-100',
    colorCollapsed: 'bg-white text-rose-500 border-rose-400 hover:bg-rose-50'
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

// Stato vero se il microfono sta attivamente registrando
const isListening = ref(false)
let speechRecognition: BrowserSpeechRecognition | null = null

const isSpeakEnabled = ref(false)
function toggleSpeak() {
  isSpeakEnabled.value = !isSpeakEnabled.value
  if (import.meta.client) {
    window.speechSynthesis.cancel()
  }
}

// AR Mode states per invocare la videocamera e collassare l'UI
const isArMode = ref(false)
const isArMapOpen = ref(false)
const arMapPosition = ref<CampusArPosition | null>(null)
const videoElement = ref<HTMLVideoElement | null>(null)
let cameraStream: MediaStream | null = null
const cameraPermissionState = ref<ArPermissionState>('idle')
const isRequestingArAccess = ref(false)
const arBuildings = ref<CampusBuilding[]>([])
const arBuildingSource = ref('No building dataset loaded')
const arBuildingTableName = ref<string | null>(null)
const isArBuildingsLoading = ref(false)
const selectedArBuildingId = ref<string | null>(null)
const selectedArBuildingHistoricalDetails = ref<string | null>(null)
const isLoadingArBuildingDetails = ref(false)
const arBuildingDetailsError = ref<string | null>(null)
let arBuildingDetailsRequestId = 0
const CAMERA_PERMISSION_TIMEOUT_MS = 10000
const GUIDED_TOUR_COMPLETION_RADIUS_METERS = 15
const isGuidedTourActive = ref(false)
const guidedTourSteps = ref<GuidedTourStep[]>([])
const guidedTourNsteps = ref(0)
const isGuidedTourLoading = ref(false)
const guidedTourError = ref<string | null>(null)
const activeGuidedTourStep = computed(() => guidedTourSteps.value[guidedTourNsteps.value] ?? null)
const activeGuidedTourBuilding = computed(() => activeGuidedTourStep.value?.building ?? null)
const isGuidedTourComplete = computed(
  () => guidedTourSteps.value.length > 0 && guidedTourNsteps.value >= guidedTourSteps.value.length
)
const visibleArBuildings = computed(() => {
  if (!isGuidedTourActive.value) {
    return arBuildings.value
  }

  return activeGuidedTourBuilding.value ? [activeGuidedTourBuilding.value] : []
})
const {
  buildingDistances: arBuildingDistances,
  markers: arMarkers,
  position: arPosition,
  primaryMarker: primaryArMarker,
  status: arStatus,
  start: startCampusAr,
  stop: stopCampusAr
} = useCampusAr(visibleArBuildings)
const activeGuidedTourDistanceMeters = computed(() => {
  const activeBuilding = activeGuidedTourBuilding.value

  if (!activeBuilding) {
    return null
  }

  return arBuildingDistances.value.find((building) => building.id === activeBuilding.id)?.distanceMeters ?? null
})
const hasArOverlayBuildings = computed(() => (
  isGuidedTourActive.value ? guidedTourSteps.value.length > 0 : arBuildings.value.length > 0
))
const isArOverlayLoading = computed(() => (
  isArBuildingsLoading.value || (isGuidedTourActive.value && isGuidedTourLoading.value)
))

watch(() => primaryArMarker.value?.id, (newId, oldId) => {
  if (isSpeakEnabled.value && newId && newId !== oldId && primaryArMarker.value && import.meta.client) {
    window.speechSynthesis.cancel()
    const text = `${primaryArMarker.value.name}, ${Math.round(primaryArMarker.value.distanceMeters)} meters away.`
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = navigator.language || 'en-US'
    window.speechSynthesis.speak(utterance)
  }
})

// Modal Bottom Sheet State per la Chat
const isSheetDragging = ref(false)
const sheetDragY = ref(0)
const maxDragDistance = 250 // Altezza cumulativa per chiudere services e hero text
const chatbotCard = ref<HTMLElement | null>(null)
const AR_SHEET_COLLAPSED_VISIBLE_HEIGHT = 72
const AR_SHEET_REOPEN_DRAG_THRESHOLD = 56

const sheetProgress = computed(() => {
  return Math.max(0, Math.min(1, -sheetDragY.value / maxDragDistance))
})

let dragStartY = 0
let currentDragY = 0
let maxSheetDragDown = 0

function getArSheetMaxDown() {
  if (!import.meta.client || !chatbotCard.value) {
    return 0
  }

  const renderedTranslateY = Math.max(sheetDragY.value, 0)
  const cardTopWithoutTransform = chatbotCard.value.getBoundingClientRect().top - renderedTranslateY

  return Math.max(
    0,
    window.innerHeight - AR_SHEET_COLLAPSED_VISIBLE_HEIGHT - cardTopWithoutTransform
  )
}

function onSheetPointerDown(e: PointerEvent) {
  // Solo tasto sinistro per mouse
  if (e.pointerType === 'mouse' && e.button !== 0) return
  
  isSheetDragging.value = true
  dragStartY = e.clientY
  currentDragY = sheetDragY.value
  maxSheetDragDown = getArSheetMaxDown()

  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)

  const handleMove = (ev: PointerEvent) => {
    ev.preventDefault()
    const deltaY = ev.clientY - dragStartY
    let newY = currentDragY + deltaY
    
    if (!isArMode.value) {
      if (newY > 0) newY = 0 // Limita verso il basso in normal mode
    } else {
      if (newY > maxSheetDragDown) newY = maxSheetDragDown
    }
    
    sheetDragY.value = newY
  }

  const handleUp = () => {
    isSheetDragging.value = false
    target.releasePointerCapture(e.pointerId)
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    
    // Snap automatico
    if (isArMode.value) {
      const dragDelta = sheetDragY.value - currentDragY

      if (currentDragY > 100 && dragDelta < -AR_SHEET_REOPEN_DRAG_THRESHOLD) {
        sheetDragY.value = 0
      } else if (sheetDragY.value > 100) {
        sheetDragY.value = getArSheetMaxDown()
      } else if (sheetDragY.value < -100) {
        sheetDragY.value = -maxDragDistance // Snap to full height
      } else {
        sheetDragY.value = 0 // Snap to default
      }
    } else {
      if (sheetDragY.value < -100) {
        sheetDragY.value = -maxDragDistance
      } else {
        sheetDragY.value = 0
      }
    }
  }

  window.addEventListener('pointermove', handleMove, { passive: false })
  window.addEventListener('pointerup', handleUp)
}

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
async function goToPage(button: MenuButton) {
  // Anche qui controlliamo di essere nel browser, perche window esiste solo lato client.
  if (!import.meta.client) {
    return
  }

  isExpanded.value = false
  document.body.style.overflow = 'auto'
  await navigateTo(button.link)
}

const chatbotWindow = ref<HTMLElement | null>(null)
const chatScrollState = ref({ top: false, bottom: false })

function handleChatScroll() {
  if (!chatbotWindow.value) return
  const { scrollTop, scrollHeight, clientHeight } = chatbotWindow.value
  chatScrollState.value.top = scrollTop > 5
  chatScrollState.value.bottom = Math.ceil(scrollTop + clientHeight) < scrollHeight - 5
}

watch(chatMessages, () => {
  nextTick(() => {
    if (chatbotWindow.value) {
      chatbotWindow.value.scrollTop = chatbotWindow.value.scrollHeight
      handleChatScroll()
    }
  })
}, { deep: true })

// Questa funzione prende una domanda e restituisce una risposta testuale.
function answerCampusQuestion(question: string) {
  // toLowerCase rende tutto minuscolo, cosi i controlli non dipendono da maiuscole/minuscole.
  const normalized = question.toLowerCase()

  // includes controlla se una parola e presente nella domanda.
  if (normalized.includes('library')) {
    // return termina la funzione e restituisce questa stringa.
    return 'The main library is open from 8:00 to 20:00 on weekdays. During exams, extended evening hours may be available.'
  }

  // || significa "oppure": basta che una delle condizioni sia vera.
  if (normalized.includes('wifi') || normalized.includes('wi-fi') || normalized.includes('internet')) {
    return 'For campus Wi-Fi support, start from the digital help desk near the main hall or contact IT support through the student portal.'
  }

  // Qui rispondiamo alle domande che contengono admissions oppure office.
  if (normalized.includes('admissions') || normalized.includes('office')) {
    return 'Admissions support is usually located in the welcome area near the main entrance. This draft can later connect to live campus data for exact room details.'
  }

  // Qui rispondiamo alle domande su edificio, aula o percorso.
  if (normalized.includes('building') || normalized.includes('classroom') || normalized.includes('reach')) {
    return 'You can ask for a building or classroom and the assistant can guide you with directions, nearby landmarks, and accessible routes.'
  }

  // Risposta di fallback: viene usata se nessun if precedente ha fatto return.
  return 'This is a first chatbot draft: it can welcome users, answer common campus questions, and later connect to live data, maps, and university services.'
}

// Questa funzione viene usata quando l'utente clicca un suggerimento.
function useStarterPrompt(prompt: string) {
  // Copia il suggerimento dentro l'input.
  userPrompt.value = prompt
  // Invia subito la domanda come se l'utente avesse premuto Send.
  submitChat()
}

// Controllo supporto Browser per il riconoscimento
function getSpeechRecognition() {
  if (!import.meta.client) return null
  const browserWindow = window as BrowserWindowWithSpeech
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null
}

function startMicrophone() {
  const SpeechConstructor = getSpeechRecognition()
  if (!SpeechConstructor) {
    // Fallback for browsers like Zen/Firefox that lack native SpeechRecognition engine
    console.warn('Speech recognition is not supported natively. Using mock for UI testing.')
    isListening.value = true
    
    // Simulate recording duration and then inject fake transcription
    setTimeout(() => {
      const mockTranscription = "Where is the main library located?"
      userPrompt.value = userPrompt.value ? `${userPrompt.value} ${mockTranscription}` : mockTranscription
      isListening.value = false
    }, 2800)
    return
  }

  speechRecognition = new SpeechConstructor()
  speechRecognition.lang = import.meta.client ? navigator.language : 'en-US'
  speechRecognition.continuous = false
  speechRecognition.interimResults = true

  let basePromptForMic = userPrompt.value

  speechRecognition.onresult = (event) => {
    let interimTranscript = ''
    let finalTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript
      } else {
        interimTranscript += event.results[i][0].transcript
      }
    }

    if (finalTranscript) {
      basePromptForMic = basePromptForMic ? `${basePromptForMic} ${finalTranscript}`.trim() : finalTranscript
    }

    userPrompt.value = [basePromptForMic, interimTranscript]
      .filter(t => t.trim().length > 0)
      .join(' ')
  }

  speechRecognition.onerror = (event) => {
    isListening.value = false
    console.error('Microphone error:', event.error)
  }

  speechRecognition.onend = () => {
    isListening.value = false
  }

  try {
    speechRecognition.start()
    isListening.value = true
  } catch (err) {
    isListening.value = false
    console.error('Could not start microphone', err)
  }
}

function stopMicrophone() {
  if (!speechRecognition) {
    isListening.value = false
    return
  }
  
  try {
    speechRecognition.stop()
  } catch {
    // gia fermato
  }
  
  speechRecognition = null
  isListening.value = false
}

function toggleMicrophone() {
  if (isListening.value) {
    stopMicrophone()
  } else {
    startMicrophone()
  }
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

function parseCoordinateValue(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return fallback
}

function parseCoordinateCandidate(...values: Array<number | string | null | undefined>) {
  for (const value of values) {
    const parsedValue = parseCoordinateValue(value, Number.NaN)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return Number.NaN
}

function mapCampusBuildingRow(row: CampusBuildingRow): CampusBuilding | null {
  const name = row.name ?? row.title ?? row.building_name ?? null
  const id = row.id ?? name

  if (!id || !name) {
    return null
  }

  const latitude = parseCoordinateCandidate(row.latitude, row.lat)
  const longitude = parseCoordinateCandidate(row.longitude, row.long, row.lng, row.lon)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return {
    id: String(id),
    name,
    latitude,
    longitude,
    altitude: parseCoordinateValue(row.altitude, 0),
    labelAltitude: parseCoordinateValue(row.label_altitude ?? row.labelAltitude, 12),
    alias: row.alias?.trim() || undefined,
    color: row.color ?? undefined
  }
}

async function fetchCampusBuildings(tableName: string) {
  const supabase = useSupabaseClient()
  const { data, error } = await supabase.from(tableName).select('*')

  if (error) {
    throw error
  }

  return ((data ?? []) as CampusBuildingRow[])
    .map(mapCampusBuildingRow)
    .filter((building): building is CampusBuilding => building !== null)
    .sort((left, right) => left.name.localeCompare(right.name))
}

let campusBuildingsLoadPromise: Promise<void> | null = null

async function loadCampusBuildings() {
  if (campusBuildingsLoadPromise) {
    return campusBuildingsLoadPromise
  }

  campusBuildingsLoadPromise = (async () => {
    isArBuildingsLoading.value = true

    try {
      for (const source of [
        { tableName: 'building', label: 'Supabase building' },
        { tableName: 'buildings', label: 'Supabase buildings' },
        { tableName: 'campus_buildings', label: 'Supabase campus_buildings' }
      ]) {
        try {
          const mappedBuildings = await fetchCampusBuildings(source.tableName)

          if (mappedBuildings.length > 0) {
            arBuildings.value = mappedBuildings
            arBuildingSource.value = source.label
            arBuildingTableName.value = source.tableName
            return
          }
        } catch (error) {
          console.warn(`Unable to load ${source.tableName}.`, error)
        }
      }

      arBuildings.value = []
      arBuildingSource.value = 'No Supabase building dataset available'
      arBuildingTableName.value = null
    } finally {
      isArBuildingsLoading.value = false
      campusBuildingsLoadPromise = null
    }
  })()

  return campusBuildingsLoadPromise
}

function parseGuidedTourOrder(value: number | string | null | undefined, fallback: number) {
  const parsedValue = parseCoordinateValue(value, Number.NaN)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function normalizeSearchValue(value: string | number | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function getGuidedTourBuildingId(row: GuidedTourRow) {
  const dynamicRow = row as Record<string, unknown>
  const value =
    row.building_id ??
    row.buildingId ??
    dynamicRow.buildingID ??
    dynamicRow.building_id_uuid ??
    dynamicRow['building.id'] ??
    row.building?.id ??
    row.buildings?.id ??
    row.campus_buildings?.id ??
    null

  return value === null || typeof value === 'undefined' ? null : String(value)
}

function mapGuidedTourBuilding(row: GuidedTourRow) {
  const buildingId = getGuidedTourBuildingId(row)
  const linkedBuilding = buildingId
    ? arBuildings.value.find((building) => building.id === buildingId)
    : null

  if (linkedBuilding) {
    return linkedBuilding
  }

  const embeddedBuilding = row.building ?? row.buildings ?? row.campus_buildings ?? null

  if (embeddedBuilding) {
    return mapCampusBuildingRow(embeddedBuilding)
  }

  const rowName = normalizeSearchValue(row.name ?? row.title ?? row.building_name)
  const rowAlias = normalizeSearchValue(row.alias)
  const matchedBuilding = arBuildings.value.find((building) => {
    const buildingName = normalizeSearchValue(building.name)
    const buildingAlias = normalizeSearchValue(building.alias)

    return (
      (rowName && (rowName === buildingName || rowName === buildingAlias)) ||
      (rowAlias && (rowAlias === buildingAlias || rowAlias === buildingName))
    )
  })

  if (matchedBuilding) {
    return matchedBuilding
  }

  return mapCampusBuildingRow({
    ...row,
    id: buildingId ?? row.id
  })
}

function mapGuidedTourRows(rows: GuidedTourRow[]) {
  return rows
    .map((row, index) => {
      const building = mapGuidedTourBuilding(row)

      if (!building) {
        console.warn(`Guided tour step ${row.id ?? index + 1} has no mapped building coordinates.`)
        return null
      }

      return {
        id: String(row.id ?? `${building.id}-${index}`),
        order: parseGuidedTourOrder(row.step, index + 1),
        storytelling: row.storytelling?.trim() || null,
        building
      }
    })
    .filter((step): step is GuidedTourStep => step !== null)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
}

let guidedTourLoadPromise: Promise<void> | null = null

async function loadGuidedTour() {
  if (guidedTourLoadPromise) {
    return guidedTourLoadPromise
  }

  guidedTourLoadPromise = (async () => {
    isGuidedTourLoading.value = true
    guidedTourError.value = null

    try {
      await loadCampusBuildings()
      const supabase = useSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await $fetch<GuidedTourStepsResponse>('/api/guided-tour-steps', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 70000
      })
      const rows = Array.isArray(response.steps) ? response.steps : []
      guidedTourSteps.value = mapGuidedTourRows(rows)
      guidedTourNsteps.value = 0

      if (guidedTourSteps.value.length === 0) {
        guidedTourError.value = 'No guided tour steps are available.'
      }
    } catch (error) {
      console.warn('Unable to load guided tour.', error)
      guidedTourSteps.value = []
      guidedTourNsteps.value = 0
      guidedTourError.value = 'Unable to load guided tour.'
    } finally {
      isGuidedTourLoading.value = false
      guidedTourLoadPromise = null
    }
  })()

  return guidedTourLoadPromise
}

async function loadArBuildingHistoricalDetails(buildingId: string) {
  if (selectedArBuildingId.value === buildingId) {
    clearSelectedArBuildingDetails()
    return
  }

  const requestId = ++arBuildingDetailsRequestId
  selectedArBuildingId.value = buildingId
  selectedArBuildingHistoricalDetails.value = null
  arBuildingDetailsError.value = null

  if (!arBuildingTableName.value) {
    arBuildingDetailsError.value = 'Building data is still loading.'
    return
  }

  isLoadingArBuildingDetails.value = true

  try {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from(arBuildingTableName.value)
      .select('historical_details')
      .eq('id', buildingId)
      .maybeSingle()

    if (error) {
      throw error
    }

    const details = (data as BuildingHistoricalDetailsRow | null)?.historical_details?.trim()

    if (requestId !== arBuildingDetailsRequestId || selectedArBuildingId.value !== buildingId) {
      return
    }

    selectedArBuildingHistoricalDetails.value = details || null
    if (isSpeakEnabled.value && import.meta.client) {
      window.speechSynthesis.cancel()
      const textToSpeak = details || 'No historical details available for this building.'
      const utterance = new SpeechSynthesisUtterance(textToSpeak)
      utterance.lang = navigator.language || 'en-US'
      window.speechSynthesis.speak(utterance)
    }
  } catch (error) {
    if (requestId !== arBuildingDetailsRequestId || selectedArBuildingId.value !== buildingId) {
      return
    }

    console.warn('Unable to load building historical details.', error)
    arBuildingDetailsError.value = 'Unable to load building details.'
    if (isSpeakEnabled.value && import.meta.client) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance('Unable to load building details.')
      utterance.lang = navigator.language || 'en-US'
      window.speechSynthesis.speak(utterance)
    }
  } finally {
    if (requestId === arBuildingDetailsRequestId) {
      isLoadingArBuildingDetails.value = false
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) {
  let timeoutId: number | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(timeoutMessage))
        }, timeoutMs)
      })
    ])
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
  }
}

async function startCamera() {
  if (!import.meta.client || !videoElement.value) return false

  if (
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    cameraPermissionState.value = 'unsupported'
    alert('Camera access is not available on this device or browser.')
    return false
  }

  if (cameraStream) {
    cameraPermissionState.value = 'granted'
    return true
  }

  cameraPermissionState.value = 'prompt'

  try {
    cameraStream = await withTimeout(
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            ideal: 'environment'
          }
        }
      }),
      CAMERA_PERMISSION_TIMEOUT_MS,
      'Camera permission request timed out.'
    )
    videoElement.value.srcObject = cameraStream
    await videoElement.value.play().catch(() => undefined)
    cameraPermissionState.value = 'granted'
    return true
  } catch (error) {
    console.error('Camera access error:', error)
    cameraPermissionState.value = 'denied'
    isArMode.value = false
    isGuidedTourActive.value = false
    alert(
      error instanceof Error
        ? error.message
        : 'Unable to access camera. Please check browser permissions.'
    )
    return false
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop())
    cameraStream = null
  }
  if (videoElement.value) {
    videoElement.value.srcObject = null
  }
}

function clearSelectedArBuildingDetails() {
  arBuildingDetailsRequestId += 1
  selectedArBuildingId.value = null
  selectedArBuildingHistoricalDetails.value = null
  arBuildingDetailsError.value = null
  isLoadingArBuildingDetails.value = false
}

async function requestArAccess() {
  if (!import.meta.client || isRequestingArAccess.value) {
    return
  }

  isRequestingArAccess.value = true

  try {
    const cameraReady = await startCamera()

    if (!cameraReady) {
      disableArMode()
      return
    }

    await startCampusAr()
  } finally {
    isRequestingArAccess.value = false
  }
}

async function enableArMode() {
  if (!import.meta.client) {
    return
  }

  isArMode.value = true
  isGuidedTourActive.value = false
  guidedTourNsteps.value = 0
  guidedTourError.value = null
  sheetDragY.value = 0
  clearSelectedArBuildingDetails()
  const buildingLoadPromise = loadCampusBuildings()
  await requestArAccess()
  await buildingLoadPromise
}

async function enableGuidedTourMode() {
  if (!import.meta.client) {
    return
  }

  isArMode.value = true
  isGuidedTourActive.value = true
  guidedTourNsteps.value = 0
  guidedTourError.value = null
  sheetDragY.value = 0
  clearSelectedArBuildingDetails()
  const guidedTourLoadPromise = loadGuidedTour()
  await requestArAccess()
  await guidedTourLoadPromise
}

function disableArMode() {
  isArMode.value = false
  isArMapOpen.value = false
  arMapPosition.value = null
  isGuidedTourActive.value = false
  sheetDragY.value = 0
  guidedTourNsteps.value = 0
  clearSelectedArBuildingDetails()
  stopCampusAr()
  stopCamera()
}

function openArMap() {
  if (!arPosition.value) {
    return
  }

  arMapPosition.value = { ...arPosition.value }
  isArMapOpen.value = true
}

function closeArMap() {
  isArMapOpen.value = false
}

async function toggleArMode() {
  if (isArMode.value) {
    disableArMode()
    return
  }

  await enableArMode()
}

function completeGuidedTourStep() {
  if (!isGuidedTourActive.value || isGuidedTourComplete.value) {
    return
  }

  guidedTourNsteps.value = Math.min(guidedTourNsteps.value + 1, guidedTourSteps.value.length)
  clearSelectedArBuildingDetails()
}

async function toggleGuidedTourMode() {
  if (isGuidedTourActive.value) {
    disableArMode()
    return
  }

  await enableGuidedTourMode()
}

watch(activeGuidedTourDistanceMeters, (distanceMeters) => {
  if (
    !isGuidedTourActive.value ||
    isGuidedTourLoading.value ||
    !activeGuidedTourStep.value ||
    distanceMeters === null
  ) {
    return
  }

  if (distanceMeters <= GUIDED_TOUR_COMPLETION_RADIUS_METERS) {
    completeGuidedTourStep()
  }
})

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
    const chatLocation = await getChatLocationCoordinates()

    const response = await $fetch<CampusChatResponse>('/api/campus-chat', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 600000, // 10 minutes timeout for slow local LLM responses
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

    if (isSpeakEnabled.value && import.meta.client) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(response.reply)
      utterance.lang = navigator.language || 'en-US'
      window.speechSynthesis.speak(utterance)
    }
  } catch (error: any) {
    const errorMsg = error.data?.statusMessage || error.message || 'Errore sconosciuto'
    const fallbackText = `Non riesco a contattare l'agente in questo momento. (${errorMsg})`
    chatMessages.value[assistantMessageIndex] = {
      role: 'assistant',
      text: fallbackText
    }

    if (isSpeakEnabled.value && import.meta.client) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(fallbackText)
      utterance.lang = navigator.language || 'en-US'
      window.speechSynthesis.speak(utterance)
    }
  } finally {
    isChatLoading.value = false
  }
}

onMounted(() => {
  loadCampusBuildings()
  nextTick(handleChatScroll)
  window.addEventListener('resize', handleChatScroll)
})

// onBeforeUnmount viene eseguito quando il componente sta per essere rimosso dalla pagina.
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleChatScroll)
  stopMicrophone()
  disableArMode()

  // Ripristina lo scroll nel caso il componente venga chiuso mentre il menu e aperto.
  if (import.meta.client) {
    document.body.style.overflow = 'auto'
  }
})
</script>

<template>
  <main :class="{ 'bg-black': isArMode }" class="home-shell">
    <!-- Camera background -->
    <video 
      ref="videoElement" 
      :class="isArMode ? 'opacity-100' : 'opacity-0'"
      autoplay
      class="ar-camera-view transition-opacity duration-[800ms] pointer-events-none"
      muted
      playsinline
    />
    <CampusArOverlay
      :building-details-error="arBuildingDetailsError"
      :building-historical-details="selectedArBuildingHistoricalDetails"
      :building-source-label="arBuildingSource"
      :camera-permission-state="cameraPermissionState"
      :enabled="isArMode && !isArMapOpen"
      :guided-tour-completion-radius-meters="GUIDED_TOUR_COMPLETION_RADIUS_METERS"
      :guided-tour-current-alias="activeGuidedTourStep?.building.alias ?? null"
      :guided-tour-current-building-id="activeGuidedTourBuilding?.id ?? null"
      :guided-tour-current-distance-meters="activeGuidedTourDistanceMeters"
      :guided-tour-current-name="activeGuidedTourStep?.building.name ?? null"
      :guided-tour-current-storytelling="activeGuidedTourStep?.storytelling ?? null"
      :guided-tour-error="guidedTourError"
      :guided-tour-nsteps="guidedTourNsteps"
      :guided-tour-total-steps="guidedTourSteps.length"
      :has-buildings="hasArOverlayBuildings"
      :is-guided-tour-active="isGuidedTourActive"
      :is-loading-building-details="isLoadingArBuildingDetails"
      :is-loading-buildings="isArOverlayLoading"
      :is-requesting-access="isRequestingArAccess"
      :markers="arMarkers"
      :primary-marker="primaryArMarker"
      :selected-building-id="selectedArBuildingId"
      :sensor-status="arStatus"
      @open-map="openArMap"
      @request-access="requestArAccess"
      @request-building-details="loadArBuildingHistoricalDetails"
    />
    <CampusMapOverlay
      v-if="isArMapOpen && arMapPosition"
      :position="arMapPosition"
      @close="closeArMap"
    />

    <!-- Gradienti atmosferici originali -->
    <div :class="isArMode ? 'opacity-0' : 'opacity-80'" class="background-orb orb-left transition-opacity duration-500" />
    <div :class="isArMode ? 'opacity-0' : 'opacity-80'" class="background-orb orb-right transition-opacity duration-500" />

    <!-- Pulsante Speak -->
    <button
      type="button"
      :class="isArMode ? 'opacity-0 pointer-events-none' : 'opacity-100'"
      class="speak-btn transition-opacity duration-500"
      @click="toggleSpeak"
      :aria-label="isSpeakEnabled ? 'Disable voice' : 'Enable voice'"
    >
      <svg v-if="isSpeakEnabled" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>
    </button>

    <!-- Pulsante Login -->
    <NuxtLink :class="isArMode ? 'opacity-0 pointer-events-none' : 'opacity-100'" aria-label="Open login page" class="login-link transition-opacity duration-500" to="/login">
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
      </svg>
    </NuxtLink>

    <section class="home-panel">
      <!-- Card principale della pagina. -->
      <div :class="isArMode ? '!bg-transparent !border-transparent !shadow-none !backdrop-blur-none !p-0 !m-0 pointer-events-none' : ''" class="hero-card transition-all duration-500">
        <div 
          :class="[
            !isSheetDragging ? 'transition-all duration-300' : '',
            isArMode ? 'opacity-0 pointer-events-none translate-y-[-20px]' : ''
          ]"
          :style="{
            opacity: isArMode ? 0 : Math.max(0, 1 - sheetProgress * 2),
            height: isArMode ? '0px' : `${(1 - sheetProgress) * 132}px`,
            transform: isArMode ? 'translateY(-20px)' : `scale(${1 - sheetProgress * 0.1})`,
            overflow: 'hidden',
            transformOrigin: 'top center'
          }"
          class="transition-all duration-300"
        >
          <h1>PolinSight</h1>
          <p class="hero-copy">
            Welcome to your Polimi campus companion.
          </p>
          <p class="hero-section-title">AR Experience</p>
          <p class="hero-copy hero-copy-compact">
            Look through the camera to find nearby buildings and ask for useful insights.
          </p>
        </div>
        
        <div 
          :class="isArMode ? 'fixed top-6 left-6 z-50 flex-row items-center gap-4 pointer-events-auto' : 'relative flex-row justify-center gap-[14px]'"
          class="hero-actions transition-all duration-700 ease-[cubic-bezier(0.34,1.1,0.64,1)]"
        >
          <button :class="{ 'ar-button-active': isArMode && !isGuidedTourActive }" class="hero-button" type="button" @click="toggleArMode">
            <svg fill="none" height="20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" x2="12" y1="22.08" y2="12" />
            </svg>
            {{ isArMode ? (isGuidedTourActive ? 'Exit Tour' : 'Exit AR Mode') : 'AR Mode' }}
          </button>
          <button
            :class="[{ 'ar-button-active': isGuidedTourActive }, isArMode ? 'translate-x-0' : '']"
            class="hero-button transition-all duration-500 delay-100"
            type="button"
            @click="toggleGuidedTourMode"
          >
            Guided Tour
          </button>
        </div>
      </div>

      <!-- Sezione del menu animato dei servizi. -->
      <section 
        :class="[
          !isSheetDragging ? 'transition-all duration-300' : '',
          isArMode ? 'opacity-0 pointer-events-none translate-y-10' : ''
        ]"
        :style="{
          opacity: isArMode ? 0 : Math.max(0, 1 - sheetProgress * 1.5),
          height: isArMode ? '0px' : `${(1 - sheetProgress) * 176}px`,
          overflow: sheetProgress > 0 || isArMode ? 'hidden' : 'visible'
        }"
        class="services-menu-section"
      >
          <div
            :class="isExpanded ? 'fixed inset-0 z-40 bg-white' : ''"
            class="w-full flex items-center justify-center transition-colors duration-500"
          >
            <div
              :class="isExpanded
                ? 'bg-white w-[100vw] h-[100vh] pt-28 px-8 pb-8 sm:px-12 rounded-none z-50'
                : 'services-card-collapsed w-full h-44 p-6 cursor-pointer relative'"
              class="transition-all duration-500 ease-[cubic-bezier(0.34,1.1,0.64,1)] flex flex-col overflow-hidden"
              @click="!isExpanded && toggleExpand()"
            >
              <div
                :class="isExpanded ? 'mb-16 sm:mb-20' : 'mb-6'"
                class="flex items-center justify-between transition-all duration-500"
              >
                <span
                  :class="isExpanded ? 'text-3xl sm:text-4xl' : 'text-[clamp(1.4rem,2.5vw,2.2rem)]'"
                  class="transition-all duration-500"
                >
                  Main Services
                </span>

                <button
                  :aria-expanded="isExpanded"
                  :aria-label="isExpanded ? 'Close services menu' : 'Open services menu'"
                  :class="isExpanded ? 'text-gray-400' : 'text-[#102C53]'"
                  class="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-all duration-500 focus:outline-none z-20 relative"
                  type="button"
                  @click.stop="toggleExpand"
                >
                  <div class="relative w-7 h-7">
                    <svg
                      :class="isExpanded ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'"
                      class="absolute inset-0 w-7 h-7 transition-all duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" />
                    </svg>
                    <svg
                      :class="isExpanded ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'"
                      class="absolute inset-0 w-7 h-7 transition-all duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" />
                    </svg>
                  </div>
                </button>
              </div>

              <div
                :class="isExpanded ? 'flex-1 justify-start max-w-3xl mx-auto' : 'justify-start'"
                class="transition-all duration-500 flex flex-col w-full"
              >
                <div :style="{ height: isExpanded ? `${Math.ceil(buttons.length / 2) * 104 - 18}px` : '56px' }" class="relative w-full">
                  <button
                    v-for="(button, index) in buttons"
                    :key="button.id"
                    :class="isExpanded
                      ? `shadow-lg ${button.colorExpanded}`
                      : `${button.colorCollapsed} shadow-sm`"
                    :style="{
                      transitionDelay: isExpanded ? `${index * 60}ms` : `${(buttons.length - 1 - index) * 30}ms`,
                      transitionTimingFunction: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
                      top: isExpanded ? `${Math.floor(index / 2) * 104}px` : '0px',
                      left: isExpanded ? (index % 2 === 1 ? 'calc(50% + 8px)' : '0px') : `calc((100% - 56px) / ${buttons.length - 1} * ${index})`,
                      width: isExpanded ? 'calc(50% - 8px)' : '56px',
                      height: isExpanded ? '80px' : '56px',
                      borderRadius: isExpanded ? '1.5rem' : '50%'
                    }"
                    class="absolute transition-all duration-500 flex items-center justify-center overflow-hidden group focus:outline-none border-2"
                    type="button"
                    @click.stop="goToPage(button)"
                  >
                    <svg
                      :class="isExpanded ? 'opacity-0 scale-50' : 'opacity-100 scale-100'"
                      :style="{ transitionDelay: isExpanded ? '0ms' : `${(buttons.length - 1 - index) * 40 + 200}ms` }"
                      class="absolute transition-all duration-[400ms] w-7 h-7"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path :d="button.iconPath" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>

                    <div
                      :class="isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75'"
                      :style="{ transitionDelay: isExpanded ? `${index * 80 + 200}ms` : '0ms' }"
                      class="flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300 w-full px-2"
                    >
                      <svg
                        class="w-6 h-6 sm:w-7 sm:h-7 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path :d="button.iconPath" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      <span class="font-bold text-[1.05rem] sm:text-xl tracking-tight leading-tight text-left">{{ button.text }}</span>
                    </div>
                  </button>
                </div>
              </div>

              <div
                :class="isExpanded ? 'opacity-100 delay-500' : 'opacity-0 absolute bottom-0 pointer-events-none w-full left-0'"
                class="transition-all duration-500 text-center text-gray-300 pb-8"
              >
                <p class="uppercase tracking-widest text-xs font-bold">Menu Navigazione</p>
              </div>
              </div>
            </div>
      </section>

      <!-- Sezione chatbot. -->
      <section
        :class="{
          'chatbot-section--ar': isArMode,
          'chatbot-section--guided-details': isArMode && isGuidedTourActive && Boolean(selectedArBuildingId)
        }"
        aria-label="Campus AI Assistant"
        class="chatbot-section"
      >
        <div
          ref="chatbotCard"
          :class="{ 'chatbot-card--dragging': isSheetDragging, 'transition-all duration-300': !isSheetDragging }"
          :style="{ transform: (isArMode && sheetDragY > 0) ? `translateY(${sheetDragY}px)` : 'translateY(0px)' }"
          class="chatbot-card"
        >
          <div class="drag-handle" @pointerdown="onSheetPointerDown">
            <div class="drag-bar"></div>
          </div>

          <div class="ai-assistant-block">
            <div class="chatbot-heading">
              <h2 id="campus-ai-title">Campus AI Assistant</h2>
            </div>
            
            <div aria-label="Suggested prompts" class="prompt-list">
              <button
                v-for="prompt in starterPrompts"
                :key="prompt"
                class="prompt-chip"
                type="button"
                @click="useStarterPrompt(prompt)"
              >
                {{ prompt }}
              </button>
            </div>
          </div>

          <div
            ref="chatbotWindow"
            :class="{
              'mask-both': chatScrollState.top && chatScrollState.bottom,
              'mask-top': chatScrollState.top && !chatScrollState.bottom,
              'mask-bottom': chatScrollState.bottom && !chatScrollState.top
            }"
            aria-live="polite"
            class="chatbot-window"
            @scroll="handleChatScroll"
          >
            <div
              v-for="(message, index) in chatMessages"
              :key="`${message.role}-${index}`"
              :class="`message-row--${message.role}`"
              class="message-row"
            >
              <div :class="`message-bubble--${message.role}`" class="message-bubble">
                {{ message.text }}
              </div>
            </div>
          </div>

          <form class="chatbot-form" @submit.prevent="submitChat">
            <label class="sr-only" for="campus-ai-input">Ask the campus assistant</label>
            <button
              :aria-label="isListening ? 'Stop recording' : 'Enable microphone'"
              :aria-pressed="isListening"
              :class="{ 'chatbot-mic-button--listening': isListening }"
              class="chatbot-mic-button"
              type="button"
              @click="toggleMicrophone"
            >
              <svg :class="{ 'scale-110': isListening }" aria-hidden="true" class="transition-transform duration-300" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z" />
              </svg>
              
              <span v-if="isListening" class="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20 pointer-events-none"></span>
              <span v-if="isListening" class="absolute inset-0 rounded-full animate-pulse bg-blue-500 opacity-10 pointer-events-none"></span>
            </button>
            <input
              id="campus-ai-input"
              v-model="userPrompt"
              :disabled="isChatLoading"
              :placeholder="isChatLoading ? 'Attendo la risposta...' : 'Chiedi qualcosa sulle lezioni...'"
              class="chatbot-input"
              type="text"
            >
            <button :disabled="isChatLoading" class="chatbot-send" type="submit">
              <svg v-if="!isChatLoading" class="w-5 h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                <line x1="22" x2="11" y1="2" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <span v-else class="text-xs">...</span>
            </button>
          </form>
        </div>
      </section>
    </section>
  </main>
</template>


<style scoped>
:global(html) {
  height: 100%;
  overflow: hidden; /* signals to the browser this page does not scroll */
}

:global(body) {
  margin: 0;
  height: 100%;
  font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
  background:
    radial-gradient(circle at top left, rgba(16, 44, 83, 0.15), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #e0dcdc 100%);
  color: #000000;
  overflow: hidden; /* prevents body scroll */
}


:global(a) {
  color: inherit;
  text-decoration: none;
}

.home-shell {
  --panel-bg: rgba(255, 255, 255, 0.78);
  --panel-border: rgba(148, 163, 184, 0.22);
  --primary: #102C53;
  --primary-dark: #000000;
  --shadow: 0 28px 60px rgba(16, 44, 83, 0.16);
  height: 100dvh;
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
  background: rgba(16, 44, 83, 0.15);
  top: 5%;
  left: -80px;
}

.orb-right {
  width: 320px;
  height: 320px;
  background: rgba(16, 44, 83, 0.1);
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

.speak-btn {
  position: absolute;
  top: 20px;
  right: 80px;
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
  cursor: pointer;
  color: var(--primary-dark);
}

.speak-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
}

.speak-btn svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.hero-card,
.services-card-collapsed {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  flex-shrink: 0;
}

.hero-card {
  padding: 16px; /* reduced padding */
  text-align: center;
}



.eyebrow {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  color: #102C53;
}

.hero-card h1 {
  margin: 0;
  font-size: clamp(1.4rem, 2.5vw, 2.2rem); /* reduced size */
  line-height: 1.05;
}

.hero-copy {
  max-width: 520px;
  margin: 10px auto 12px;
  font-size: 0.9rem; /* reduced size */
  line-height: 1.5;
  color: #475569;
}

.hero-section-title {
  margin: 4px 0 0;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #102C53;
}

.hero-copy-compact {
  margin: 6px auto 14px;
  font-size: 0.84rem;
}

.hero-button {
  border: 0;
  border-radius: 999px;
  padding: 12px 24px;
  font-size: 1.05rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), #1a427a);
  box-shadow: 0 16px 28px rgba(16, 44, 83, 0.28);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hero-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(16, 44, 83, 0.35);
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


.chatbot-section {
  display: flex;
  flex-direction: column;
  flex: 1; /* take remaining vertical space */
  min-height: 0; /* needed for flex children to shrink */
  transition: flex 0.3s ease, padding-top 0.3s ease;
}

.chatbot-section--guided-details {
  padding-top: min(360px, 44dvh);
}

.chatbot-card {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 -4px 30px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(18px);
  padding: 16px;
  padding-top: 8px; /* reduced for handle */
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  gap: 10px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(224, 220, 220, 0.6) 100%);
}

.chatbot-card--dragging {
  box-shadow: 0 -22px 50px rgba(16, 44, 83, 0.12);
}

.drag-handle {
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0px;
  margin-bottom: 4px;
  cursor: grab;
  touch-action: none; /* Prevent scroll on touch */
  flex-shrink: 0;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-bar {
  width: 48px;
  height: 5px;
  background: rgba(148, 163, 184, 0.4);
  border-radius: 4px;
  transition: background 0.2s ease, width 0.2s ease;
}

.drag-handle:hover .drag-bar {
  background: rgba(148, 163, 184, 0.7);
  width: 60px;
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
  color: #102C53;
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
  background: linear-gradient(135deg, rgba(224, 220, 220, 0.95), #ffffff);
  color: #102C53;
  font-size: 0.8rem; /* reduced */
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.prompt-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 22px rgba(16, 44, 83, 0.18);
}

.chatbot-window {
  min-height: 0; /* allows shrinking */
  flex: 1; /* takes all space possible */
  overflow-y: auto;
  padding: 10px 4px; /* gives a slightly freer horizontal alignment */
  background: transparent;
  border: none;
  display: grid;
  align-content: start; /* align messages to top */
  gap: 10px; /* reduced */
  transition: mask-image 0.2s ease, -webkit-mask-image 0.2s ease;
}

.chatbot-window.mask-both {
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent);
  mask-image: linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent);
}
.chatbot-window.mask-top {
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 16px, black 100%);
  mask-image: linear-gradient(to bottom, transparent, black 16px, black 100%);
}
.chatbot-window.mask-bottom {
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black calc(100% - 16px), transparent);
  mask-image: linear-gradient(to bottom, black 0%, black calc(100% - 16px), transparent);
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
  background: #f0f4f8;
  color: #102C53;
  border-top-left-radius: 6px;
}

.message-bubble--user {
  background: linear-gradient(135deg, var(--primary), #1a427a);
  color: #fff;
  border-top-right-radius: 6px;
}

.chatbot-form {
  display: flex;
  align-items: stretch;
  gap: 8px; /* reduced */
  flex-shrink: 0;
}

.chatbot-mic-button {
  width: 44px;
  min-width: 44px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  color: #102C53;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.chatbot-mic-button:hover {
  border-color: rgba(16, 44, 83, 0.45);
}

.chatbot-mic-button--listening {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.05);
}

.chatbot-mic-button--listening:hover {
  border-color: rgba(239, 68, 68, 0.6);
  background: rgba(239, 68, 68, 0.1);
}

.chatbot-mic-button svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
  position: relative;
  z-index: 2;
}

.chatbot-input {
  min-width: 0;
  flex: 1;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 18px;
  padding: 12px 14px; /* reduced */
  font: inherit;
  font-size: 0.85rem;
  color: #1f2937;
  background: rgba(255, 255, 255, 0.92);
}

.chatbot-input:focus {
  outline: 2px solid rgba(16, 44, 83, 0.2);
  border-color: rgba(16, 44, 83, 0.45);
}

.chatbot-input:disabled {
  cursor: wait;
  opacity: 0.72;
}

/* Pulsante invio della chat. */
.chatbot-send {
  border: 0;
  border-radius: 18px;
  width: 44px;
  min-width: 44px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), #1a427a);
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

  .chatbot-section--ar {
    /* Keep the AR status card above the assistant sheet instead of over it. */
    padding-top: 166px;
  }

  .chatbot-section--guided-details {
    /* Reserve room for the expanded guided-tour building description. */
    padding-top: min(430px, 52dvh);
  }

  .chatbot-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .chatbot-send {
    min-height: 42px;
  }
}

.ar-camera-view {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  object-fit: cover;
  z-index: 0;
  background: #000;
}

.ar-button-active {
  background: rgba(255, 255, 255, 0.9) !important;
  color: #102C53 !important;
  border: 1px solid rgba(16, 44, 83, 0.2);
}
.ar-button-active svg {
  stroke: #102C53 !important;
}
</style>
