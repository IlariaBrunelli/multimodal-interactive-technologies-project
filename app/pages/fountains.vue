<script setup lang="ts">
type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'

type FountainRow = Record<string, unknown>

type UserPosition = {
  latitude: number
  longitude: number
  accuracyMeters: number | null
}

type FountainTableRow = {
  id: string
  rank: number
  buildingName: string
  buildingAlias: string
  floor: string
  notes: string
  distanceMeters: number | null
}

type NearestFountainsRequestBody = {
  action: 'get_nearest_fountains'
  data: string
}
const nearestFountainsEndpoint = '/api/campus-data'

const locationState = ref<LocationState>('idle')
const locationError = ref<string | null>(null)
const userPosition = ref<UserPosition | null>(null)
const fountains = ref<FountainRow[]>([])
const isLoading = ref(false)
const fetchErrorMessage = ref<string | null>(null)
const servicePage = ref<HTMLElement | null>(null)

let locationWatchId: number | null = null
let lastRequestedPositionKey = ''

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFountainRow(value: Record<string, unknown>) {
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

function extractFountainRows(value: unknown): FountainRow[] {
  if (typeof value === 'string') {
    try {
      return extractFountainRows(JSON.parse(value))
    } catch {
      return []
    }
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => extractFountainRows(item))
      .filter(isRecord)
  }

  if (!isRecord(value)) {
    return []
  }

  for (const key of ['fountains', 'water_fountains', 'waterFountains', 'data', 'items', 'result', 'rows', 'json', 'body', 'text', 'output']) {
    const rows = extractFountainRows(value[key])

    if (rows.length > 0) {
      return rows
    }
  }

  const nestedRows = Object.values(value).flatMap((nestedValue) => {
    if (Array.isArray(nestedValue)) {
      return extractFountainRows(nestedValue)
    }

    if (isRecord(nestedValue) && isFountainRow(nestedValue)) {
      return [nestedValue]
    }

    if (typeof nestedValue === 'string' && nestedValue.trim().startsWith('[')) {
      return extractFountainRows(nestedValue)
    }

    return []
  })

  if (nestedRows.length > 0) {
    return nestedRows
  }

  if (isFountainRow(value)) {
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

function readDistanceMeters(row: FountainRow) {
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

function mapFountainRow(row: FountainRow, index: number): FountainTableRow {
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
    id: readStringCandidate(row, ['id', 'fountain_id', 'fountainId', 'water_fountain_id', 'waterFountainId']) ?? `fountain-${index + 1}`,
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

async function loadNearestFountains() {
  if (!userPosition.value) {
    fetchErrorMessage.value = 'Allow location access before loading water fountains.'

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
  const requestBody: NearestFountainsRequestBody = {
    action: 'get_nearest_fountains',
    data: JSON.stringify({
      longitude: userPosition.value.longitude,
      latitude: userPosition.value.latitude
    })
  }

  try {
    const response = await $fetch<unknown>(nearestFountainsEndpoint, {
      method: 'POST',
      body: requestBody
    })
    console.log(response)

    const scrollTop = servicePage.value?.scrollTop
    fountains.value = extractFountainRows(response)
    await nextTick()

    if (typeof scrollTop === 'number') {
      servicePage.value?.scrollTo({ top: scrollTop })
    }
  } catch (error) {
    fetchErrorMessage.value = extractErrorMessage(
      error,
      'Unable to load water fountains from the campus webhook.'
    )
  } finally {
    isLoading.value = false
  }
}

const fountainItems = computed(() => {
  return fountains.value.map(mapFountainRow)
})
const nearestFountain = computed(() => fountainItems.value[0] ?? null)
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
  void loadNearestFountains()
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
  <main ref="servicePage" class="h-dvh overflow-y-auto bg-slate-50 text-slate-950">
    <section class="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header
        class="sticky top-0 z-20 shrink-0 cursor-pointer border-b border-slate-200 bg-slate-50/95 pb-5 backdrop-blur"
        @click="scrollToTop"
      >
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
          @click.stop
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back home</span>
        </NuxtLink>

        <div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-2">
            <p class="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">Main Services</p>
            <h1 class="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Water Fountains</h1>
            <p class="max-w-2xl text-sm text-slate-600 sm:text-base">
              Ranked by distance from your current location.
            </p>
          </div>

          <div class="w-full rounded-lg border border-slate-200 bg-white p-4 lg:w-72">
            <p class="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Nearest</p>
            <p class="mt-2 text-2xl font-semibold text-slate-950">
              {{ nearestFountain ? formatDistance(nearestFountain.distanceMeters) : '-' }}
            </p>
            <p class="mt-1 text-sm text-slate-600">
              {{ nearestFountain ? `${nearestFountain.buildingName} · ${nearestFountain.buildingAlias}` : 'No ranked water fountains yet' }}
            </p>
          </div>
        </div>
      </header>

      <section class="mt-6 min-h-0 flex-1 pb-8">
        <div v-if="isLoading && fountainItems.length === 0" class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading ranked water fountains...
        </div>

        <div
          v-else-if="loadError && fountainItems.length === 0"
          class="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        >
          {{ loadError }}
        </div>

        <div
          v-else-if="!userPosition"
          class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          Waiting for your location before requesting water fountains.
        </div>

        <div
          v-else-if="fountainItems.length === 0"
          class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          No water fountains were returned for this location.
        </div>

        <div v-else class="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <span>Showing all {{ fountainItems.length }} returned water fountains</span>
            <span v-if="isLoading">Refreshing data...</span>
            <span v-else-if="loadError">Refresh failed. Showing existing data.</span>
            <span v-else-if="nearestFountain">Nearest: {{ formatDistance(nearestFountain.distanceMeters) }}</span>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead class="bg-slate-100 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Rank</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Building</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Alias</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Floor</th>
                  <th scope="col" class="min-w-[220px] px-4 py-3">Notes</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3 text-right">Distance</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr
                  v-for="fountain in fountainItems"
                  :key="`${fountain.id}-${fountain.rank}`"
                  class="align-top transition hover:bg-orange-50/60"
                >
                  <td class="whitespace-nowrap px-4 py-4 font-semibold text-orange-700">
                    {{ fountain.rank }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 font-medium text-slate-950">
                    {{ fountain.buildingName }}
                  </td>
                  <td class="px-4 py-4 text-slate-700">
                    {{ fountain.buildingAlias }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-slate-700">{{ fountain.floor }}</td>
                  <td class="px-4 py-4 text-slate-700">{{ fountain.notes }}</td>
                  <td class="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-950">
                    {{ formatDistance(fountain.distanceMeters) }}
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
