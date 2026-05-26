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
  buildingId: string
  buildingName: string
  floor: string
  notes: string
  distanceMeters: number | null
}

type NearestMicrowavesRequestBody = {
  action: 'get_nearest_microwaves'
  data: string
}

const nearestMicrowavesEndpoint = 'http://localhost:5678/webhook/get-campus-data'

const locationState = ref<LocationState>('idle')
const locationError = ref<string | null>(null)
const userPosition = ref<UserPosition | null>(null)
const microwaves = ref<MicrowaveRow[]>([])
const isLoading = ref(false)
const fetchErrorMessage = ref<string | null>(null)
const lastUpdatedAt = ref<number | null>(null)

let locationWatchId: number | null = null
let lastRequestedPositionKey = ''

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

  if ('id' in value || 'building_id' in value || 'buildingId' in value) {
    return [value]
  }

  for (const key of ['microwaves', 'data', 'items', 'result', 'rows', 'json', 'body', 'text', 'output']) {
    const rows = extractMicrowaveRows(value[key])

    if (rows.length > 0) {
      return rows
    }
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
  const buildingId =
    readStringCandidate(row, ['building_id', 'buildingId', 'building_uuid', 'buildingUuid']) ??
    (nestedBuilding ? readStringCandidate(nestedBuilding, ['id']) : null) ??
    'Not provided'
  const buildingName =
    readStringCandidate(row, ['building_name', 'buildingName']) ??
    (nestedBuilding ? readStringCandidate(nestedBuilding, ['name', 'title', 'building_name']) : null) ??
    'Unknown building'

  return {
    id: readStringCandidate(row, ['id', 'microwave_id', 'microwaveId']) ?? `microwave-${index + 1}`,
    rank: index + 1,
    buildingId,
    buildingName,
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

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
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

    microwaves.value = extractMicrowaveRows(response)
    lastUpdatedAt.value = Date.now()
  } catch (error) {
    fetchErrorMessage.value = extractErrorMessage(
      error,
      'Unable to load microwaves from the campus webhook.'
    )
  } finally {
    isLoading.value = false
  }
}

function refreshLocation() {
  startLocationWatch()
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

const locationStatusLabel = computed(() => {
  switch (locationState.value) {
    case 'requesting':
      return 'Locating'
    case 'granted':
      return 'Live location'
    case 'denied':
      return 'Permission denied'
    case 'unsupported':
      return 'Unsupported'
    case 'error':
      return 'Location error'
    default:
      return 'Idle'
  }
})

const locationStatusDetail = computed(() => {
  if (locationState.value === 'granted' && userPosition.value?.accuracyMeters) {
    return `Accuracy ${Math.round(userPosition.value.accuracyMeters)} m`
  }

  if (locationError.value) {
    return locationError.value
  }

  if (locationState.value === 'requesting') {
    return 'Waiting for a geolocation fix'
  }

  return 'Distance ranking starts after location access'
})

const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) {
    return 'Not loaded'
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(lastUpdatedAt.value)
})

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
  <main class="h-dvh overflow-y-auto bg-slate-50 text-slate-950">
    <section class="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header class="shrink-0 border-b border-slate-200 pb-5">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back home</span>
        </NuxtLink>

        <div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div class="space-y-2">
            <p class="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">Main Services</p>
            <h1 class="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Microwaves</h1>
            <p class="max-w-2xl text-sm text-slate-600 sm:text-base">
              Ranked by distance from your current location.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              @click="refreshLocation"
            >
              Update location
            </button>
            <button
              type="button"
              class="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:border-orange-400 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isLoading || !userPosition"
              @click="loadNearestMicrowaves"
            >
              {{ isLoading ? 'Loading...' : 'Reload data' }}
            </button>
          </div>
        </div>
      </header>

      <section class="mt-6 grid shrink-0 gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Microwaves</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">{{ microwaveItems.length }}</p>
          <p class="mt-1 text-sm text-slate-600">Returned by the campus endpoint</p>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Nearest</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">
            {{ nearestMicrowave ? formatDistance(nearestMicrowave.distanceMeters) : '-' }}
          </p>
          <p class="mt-1 text-sm text-slate-600">
            {{ nearestMicrowave ? nearestMicrowave.buildingName : 'No ranked microwaves yet' }}
          </p>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Location</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">{{ locationStatusLabel }}</p>
          <p class="mt-1 text-sm text-slate-600">{{ locationStatusDetail }}</p>
        </div>
      </section>

      <section class="mt-4 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
        <p>Last refresh: {{ lastUpdatedLabel }}</p>
        <p v-if="userPosition">Coordinates: {{ formatCoordinates(userPosition.latitude, userPosition.longitude) }}</p>
      </section>

      <section class="mt-6 min-h-0 flex-1 pb-8">
        <div v-if="isLoading" class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading ranked microwaves...
        </div>

        <div
          v-else-if="loadError"
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

        <div v-else class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <span>Showing all {{ microwaveItems.length }} returned microwaves</span>
            <span v-if="nearestMicrowave">Nearest: {{ formatDistance(nearestMicrowave.distanceMeters) }}</span>
          </div>

          <div class="max-h-[65dvh] overflow-auto">
            <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead class="sticky top-0 z-10 bg-slate-100 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Rank</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Microwave ID</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Building</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Floor</th>
                  <th scope="col" class="min-w-[220px] px-4 py-3">Notes</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3 text-right">Distance</th>
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
                  <td class="px-4 py-4">
                    <span class="break-all font-mono text-xs text-slate-700">{{ microwave.id }}</span>
                  </td>
                  <td class="px-4 py-4">
                    <div class="font-medium text-slate-950">{{ microwave.buildingName }}</div>
                    <div class="mt-1 break-all font-mono text-xs text-slate-500">{{ microwave.buildingId }}</div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-slate-700">{{ microwave.floor }}</td>
                  <td class="px-4 py-4 text-slate-700">{{ microwave.notes }}</td>
                  <td class="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-950">
                    {{ formatDistance(microwave.distanceMeters) }}
                  </td>
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
