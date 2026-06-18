<script setup lang="ts">
type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'

type FoodRow = Record<string, unknown>

type UserPosition = {
  latitude: number
  longitude: number
  accuracyMeters: number | null
}

type FoodTableRow = {
  id: string
  rank: number
  name: string
  amenity: string
  address: string
  distanceMeters: number | null
}

type NearestFoodRequestBody = {
  action: 'get_nearest_food_and_drinks'
  data: string
}
const nearestFoodEndpoint = '/api/campus-data'

const locationState = ref<LocationState>('idle')
const locationError = ref<string | null>(null)
const userPosition = ref<UserPosition | null>(null)
const foodPlaces = ref<FoodRow[]>([])
const isLoading = ref(false)
const fetchErrorMessage = ref<string | null>(null)
const servicePage = ref<HTMLElement | null>(null)

let locationWatchId: number | null = null
let lastRequestedPositionKey = ''

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFoodRow(value: Record<string, unknown>) {
  return (
    'name' in value && ('amenity' in value || 'distance_in_meter' in value)
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

function extractFoodRows(value: unknown): FoodRow[] {
  if (typeof value === 'string') {
    try {
      return extractFoodRows(JSON.parse(value))
    } catch {
      return []
    }
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => extractFoodRows(item))
      .filter(isRecord)
  }

  if (!isRecord(value)) {
    return []
  }

  for (const key of ['food', 'places', 'data', 'items', 'result', 'rows', 'json', 'body', 'text', 'output']) {
    const rows = extractFoodRows(value[key])

    if (rows.length > 0) {
      return rows
    }
  }

  const nestedRows = Object.values(value).flatMap((nestedValue) => {
    if (Array.isArray(nestedValue)) {
      return extractFoodRows(nestedValue)
    }

    if (isRecord(nestedValue) && isFoodRow(nestedValue)) {
      return [nestedValue]
    }

    if (typeof nestedValue === 'string' && nestedValue.trim().startsWith('[')) {
      return extractFoodRows(nestedValue)
    }

    return []
  })

  if (nestedRows.length > 0) {
    return nestedRows
  }

  if (isFoodRow(value)) {
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

function readDistanceMeters(row: FoodRow) {
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

function mapFoodRow(row: FoodRow, index: number): FoodTableRow {
  return {
    id: `food-${index + 1}`,
    rank: index + 1,
    name: readStringCandidate(row, ['name']) ?? 'Unknown place',
    amenity: readStringCandidate(row, ['amenity']) ?? '-',
    address: readStringCandidate(row, ['address']) ?? '-',
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

async function loadNearestFood() {
  if (!userPosition.value) {
    fetchErrorMessage.value = 'Allow location access before loading food places.'

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
  const requestBody: NearestFoodRequestBody = {
    action: 'get_nearest_food_and_drinks',
    data: JSON.stringify({
      longitude: userPosition.value.longitude,
      latitude: userPosition.value.latitude
    })
  }

  try {
    const response = await $fetch<unknown>(nearestFoodEndpoint, {
      method: 'POST',
      body: requestBody
    })
    console.log(response)

    const scrollTop = servicePage.value?.scrollTop
    foodPlaces.value = extractFoodRows(response)
    await nextTick()

    if (typeof scrollTop === 'number') {
      servicePage.value?.scrollTo({ top: scrollTop })
    }
  } catch (error) {
    fetchErrorMessage.value = extractErrorMessage(
      error,
      'Unable to load food places from the campus webhook.'
    )
  } finally {
    isLoading.value = false
  }
}

const foodItems = computed(() => {
  return foodPlaces.value.map(mapFoodRow)
})
const nearestFood = computed(() => foodItems.value[0] ?? null)
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
  void loadNearestFood()
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
            <h1 class="text-3xl font-semibold tracking-tight text-[#102C53] sm:text-4xl">Food & Drinks</h1>
          </div>

          <div class="w-full rounded-2xl border border-slate-200 bg-white/90 p-5 lg:w-96 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur">
            <p class="text-[0.84rem] font-[800] uppercase tracking-[0.18em] text-[#102C53] mb-3">Nearest</p>
            <div class="flex items-end justify-between gap-4">
              <div class="flex flex-col">
                <span class="text-lg font-[800]">{{ nearestFood ? nearestFood.name : 'No ranked places yet' }}</span>
                <span v-if="nearestFood" class="text-[0.84rem] font-medium opacity-80 capitalize">{{ nearestFood.amenity }}</span>
              </div>
              <span class="text-lg font-[800] text-[#102C53] whitespace-nowrap">{{ nearestFood ? formatDistance(nearestFood.distanceMeters) : '-' }}</span>
            </div>
          </div>
        </div>
      </header>

      <section class="mt-6 min-h-0 flex-1 pb-8">
        <div v-if="isLoading && foodItems.length === 0" class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading ranked places...
        </div>

        <div
          v-else-if="loadError && foodItems.length === 0"
          class="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        >
          {{ loadError }}
        </div>

        <div
          v-else-if="!userPosition"
          class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          Waiting for your location before requesting food places.
        </div>

        <div
          v-else-if="foodItems.length === 0"
          class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          No places were returned for this location.
        </div>

        <div v-else class="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead class="bg-slate-100 text-[0.84rem] font-[800] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Rank</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3 text-right">Distance</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Name</th>
                  <th scope="col" class="whitespace-nowrap px-4 py-3">Type</th>
                  <th scope="col" class="min-w-[220px] px-4 py-3">Address</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr
                  v-for="food in foodItems"
                  :key="`${food.id}-${food.rank}`"
                  class="align-top transition hover:bg-orange-50/60"
                >
                  <td class="whitespace-nowrap px-4 py-4 font-semibold text-orange-700">
                    {{ food.rank }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-950">
                    {{ formatDistance(food.distanceMeters) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 font-medium text-slate-950">
                    {{ food.name }}
                  </td>
                  <td class="px-4 py-4 text-slate-700 capitalize">
                    {{ food.amenity }}
                  </td>
                  <td class="px-4 py-4 text-slate-700">{{ food.address }}</td>
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
