<script setup lang="ts">
type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'

type MicrowaveRow = Record<string, unknown>

type UserPosition = {
  latitude: number
  longitude: number
  accuracyMeters: number | null
}

type MicrowaveTableRow = {
  id: string
  rank: number
  buildingName: string
  buildingAlias: string
  floor: string
  notes: string
  distanceMeters: number | null
}

type NearestMicrowavesRequestBody = {
  action: 'get_nearest_microwaves'
  data: string
}
const nearestMicrowavesEndpoint = '/api/campus-data'

const locationState = ref<LocationState>('idle')
const locationError = ref<string | null>(null)
const userPosition = ref<UserPosition | null>(null)
const microwaves = ref<MicrowaveRow[]>([])
const isLoading = ref(false)
const fetchErrorMessage = ref<string | null>(null)
const servicePage = ref<HTMLElement | null>(null)

let locationWatchId: number | null = null
let lastRequestedPositionKey = ''

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMicrowaveRow(value: Record<string, unknown>) {
  return (
    'id' in value ||
    'building_id' in value ||
    'buildingId' in value ||
    ('name' in value && ('alias' in value || 'floor' in value || 'distance_in_meter' in value))
  )
}

function readValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      return record[key]
    }
  }

  return null
}

function readRecordCandidate(record: Record<string, unknown>, keys: string[]) {
  const value = readValue(record, keys)

  if (isRecord(value)) {
    return value
  }

  return null
}

function readStringCandidate(record: Record<string, unknown>, keys: string[]) {
  const value = readValue(record, keys)

  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    return trimmedValue.length > 0 ? trimmedValue : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
}

function readNumberCandidate(record: Record<string, unknown>, keys: string[]) {
  const value = readValue(record, keys)

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return null
}

function extractMicrowaveRows(value: unknown): MicrowaveRow[] {
  if (typeof value === 'string') {
    try {
      return extractMicrowaveRows(JSON.parse(value))
    } catch {
      return []
    }
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => extractMicrowaveRows(item))
      .filter(isRecord)
  }

  if (!isRecord(value)) {
    return []
  }

  for (const key of ['microwaves', 'data', 'items', 'result', 'rows', 'json', 'body', 'text', 'output']) {
    const rows = extractMicrowaveRows(value[key])

    if (rows.length > 0) {
      return rows
    }
  }

  const nestedRows = Object.values(value).flatMap((nestedValue) => {
    if (Array.isArray(nestedValue)) {
      return extractMicrowaveRows(nestedValue)
    }

    if (isRecord(nestedValue) && isMicrowaveRow(nestedValue)) {
      return [nestedValue]
    }

    if (typeof nestedValue === 'string' && nestedValue.trim().startsWith('[')) {
      return extractMicrowaveRows(nestedValue)
    }

    return []
  })

  if (nestedRows.length > 0) {
    return nestedRows
  }

  if (isMicrowaveRow(value)) {
    return [value]
  }

  return []
}

function extractErrorMessage(error: unknown, fallbackMessage: string) {
  if (isRecord(error)) {
    if (isRecord(error.data) && typeof error.data.statusMessage === 'string' && error.data.statusMessage.trim()) {
      return error.data.statusMessage.trim()
    }

    if (typeof error.statusMessage === 'string' && error.statusMessage.trim()) {
      return error.statusMessage.trim()
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim()
    }
  }

  return fallbackMessage
}

function readDistanceMeters(row: MicrowaveRow) {
  const distanceKilometers = readNumberCandidate(row, ['distance_km', 'distanceKm', 'kilometers'])

  if (distanceKilometers !== null) {
    return distanceKilometers * 1000
  }

  return readNumberCandidate(row, [
    'distance_meters',
    'distanceMeters',
    'distance_in_meter',
    'distance_in_meters',
    'distanceInMeters',
    'meters',
    'distance_m',
    'distance'
  ])
}

function mapMicrowaveRow(row: MicrowaveRow, index: number): MicrowaveTableRow {
  const nestedBuilding = readRecordCandidate(row, ['building', 'buildings'])
  const buildingName =
    readStringCandidate(row, ['name', 'building_name', 'buildingName']) ??
    (nestedBuilding ? readStringCandidate(nestedBuilding, ['name', 'title', 'building_name']) : null) ??
    'Unknown building'
  const buildingAlias =
    readStringCandidate(row, ['alias', 'building_alias', 'buildingAlias']) ??
    (nestedBuilding ? readStringCandidate(nestedBuilding, ['alias', 'building_alias', 'buildingAlias']) : null) ??
    '-'

  return {
    id: readStringCandidate(row, ['id', 'microwave_id', 'microwaveId']) ?? `microwave-${index + 1}`,
    rank: index + 1,
    buildingName,
    buildingAlias,
    floor: readStringCandidate(row, ['floor', 'level']) ?? '-',
    notes: readStringCandidate(row, ['notes', 'note', 'description']) ?? '-',
    distanceMeters: readDistanceMeters(row)
  }
}

function formatDistance(distanceMeters: number | null) {
  if (distanceMeters === null) {
    return '-'
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`
  }

  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 2 : 1)} km`
}

function stopLocationWatch() {
  if (!import.meta.client || locationWatchId === null) {
    return
  }

  navigator.geolocation.clearWatch(locationWatchId)
  locationWatchId = null
}

function startLocationWatch() {
  if (!import.meta.client) {
    return
  }

  if (!navigator.geolocation) {
    locationState.value = 'unsupported'
    locationError.value = 'Geolocation is not available on this device.'
    return
  }

  stopLocationWatch()
  locationState.value = 'requesting'
  locationError.value = null

  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      locationState.value = 'granted'
      locationError.value = null
      userPosition.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy
      }
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        locationState.value = 'denied'
        locationError.value = 'Location permission was denied.'
        return
      }

      locationState.value = 'error'
      locationError.value = 'Unable to resolve your position.'
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    }
  )
}

async function loadNearestMicrowaves() {
  if (!userPosition.value) {
    fetchErrorMessage.value = 'Allow location access before loading microwaves.'

    if (locationState.value === 'idle') {
      startLocationWatch()
    }

    return
  }

  if (isLoading.value) {
    return
  }

  isLoading.value = true
  fetchErrorMessage.value = null
  const requestBody: NearestMicrowavesRequestBody = {
    action: 'get_nearest_microwaves',
    data: JSON.stringify({
      longitude: userPosition.value.longitude,
      latitude: userPosition.value.latitude
    })
  }

  try {
    const response = await $fetch<unknown>(nearestMicrowavesEndpoint, {
      method: 'POST',
      body: requestBody
    })
    console.log(response)

    const scrollTop = servicePage.value?.scrollTop
    microwaves.value = extractMicrowaveRows(response)
    await nextTick()

    if (typeof scrollTop === 'number') {
      servicePage.value?.scrollTo({ top: scrollTop })
    }
  } catch (error) {
    fetchErrorMessage.value = extractErrorMessage(
      error,
      'Unable to load microwaves from the campus webhook.'
    )
  } finally {
    isLoading.value = false
  }
}

const microwaveItems = computed(() => {
  return microwaves.value.map(mapMicrowaveRow)
})
const nearestMicrowave = computed(() => microwaveItems.value[0] ?? null)
const loadError = computed(() => {
  if (fetchErrorMessage.value) {
    return fetchErrorMessage.value
  }

  return null
})

function scrollToTop() {
  servicePage.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(userPosition, (position) => {
  if (!position) {
    return
  }

  const positionKey = `${position.latitude.toFixed(5)},${position.longitude.toFixed(5)}`

  if (positionKey === lastRequestedPositionKey) {
    return
  }

  lastRequestedPositionKey = positionKey
  void loadNearestMicrowaves()
})

onMounted(() => {
  if (import.meta.client) {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
  }

  startLocationWatch()
})

onBeforeUnmount(() => {
  stopLocationWatch()
})
</script>

<template>
  <main ref="servicePage" class="h-dvh overflow-y-auto text-slate-950 relative">
    <div class="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,44,83,0.15),transparent_30%),linear-gradient(180deg,#ffffff_0%,#e0dcdc_100%)]"></div>
    <section class="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header
        class="shrink-0 pb-6"
      >
        <NuxtLink
          to="/"
          class="mb-6 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-300/40 bg-white/80 px-4 pl-3 font-[800] text-[#102C53] shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]"
          @click.stop
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" class="h-5 w-5 stroke-current stroke-[2.2px] [stroke-linecap:round] [stroke-linejoin:round]">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Back home</span>
        </NuxtLink>

        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="space-y-2">
            <h1 class="text-3xl font-[800] tracking-tight text-[#102C53] sm:text-4xl">Microwaves</h1>
          </div>

          <div class="w-full rounded-2xl border border-slate-200 bg-white/90 p-5 lg:w-96 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur">
            <p class="text-[0.84rem] font-[800] uppercase tracking-[0.18em] text-[#102C53] mb-3">Nearest</p>
            <div class="flex items-end justify-between gap-4">
              <div class="flex flex-col">
                <span class="text-lg font-[800] text-[#102C53]">{{ nearestMicrowave ? nearestMicrowave.buildingName : 'No ranked microwaves yet' }}</span>
                <span v-if="nearestMicrowave" class="text-[0.84rem] font-medium text-[#102C53] opacity-80">{{ nearestMicrowave.buildingAlias }}</span>
              </div>
              <span class="text-lg font-[800] text-[#102C53] whitespace-nowrap">{{ nearestMicrowave ? formatDistance(nearestMicrowave.distanceMeters) : '-' }}</span>
            </div>
          </div>
        </div>
      </header>

      <section class="mt-6 min-h-0 flex-1 pb-8">
        <div v-if="isLoading && microwaveItems.length === 0" class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading ranked microwaves...
        </div>

        <div
          v-else-if="loadError && microwaveItems.length === 0"
          class="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        >
          {{ loadError }}
        </div>

        <div
          v-else-if="!userPosition"
          class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          Waiting for your location before requesting microwaves.
        </div>

        <div
          v-else-if="microwaveItems.length === 0"
          class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          No microwaves were returned for this location.
        </div>

        <div v-else class="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead class="bg-slate-100 text-[0.84rem] font-[800] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Rank</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3 text-right">Distance</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Building</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Alias</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Floor</th>
                  <th scope="col" class="min-w-[220px] px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr
                  v-for="microwave in microwaveItems"
                  :key="`${microwave.id}-${microwave.rank}`"
                  class="align-top transition hover:bg-orange-50/60"
                >
                  <td class="whitespace-nowrap px-4 py-4 font-semibold text-orange-700">
                    {{ microwave.rank }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-950">
                    {{ formatDistance(microwave.distanceMeters) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 font-medium text-slate-950">
                    {{ microwave.buildingName }}
                  </td>
                  <td class="px-4 py-4 text-slate-700">
                    {{ microwave.buildingAlias }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-slate-700">{{ microwave.floor }}</td>
                  <td class="px-4 py-4 text-slate-700">{{ microwave.notes }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
:global(html),
:global(body) {
  height: auto;
  min-height: 100%;
  overflow: auto;
}
</style>
