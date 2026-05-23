<script setup lang="ts">
type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'

type CampusBuildingRow = Record<string, unknown> & {
  id?: string | number | null
  name?: string | null
  title?: string | null
  building_name?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  lat?: number | string | null
  lng?: number | string | null
  lon?: number | string | null
  long?: number | string | null
}

type MicrowaveRow = Record<string, unknown>

type BuildingLocation = {
  id: string
  name: string
  latitude: number
  longitude: number
}

type UserPosition = {
  latitude: number
  longitude: number
  accuracyMeters: number | null
}

type MicrowaveListItem = {
  id: string
  name: string
  buildingName: string
  latitude: number
  longitude: number
  distanceMeters: number | null
  floor: string | null
}

const supabase = useSupabaseClient()
const microwaves = ref<MicrowaveRow[]>([])
const buildingLocations = ref<BuildingLocation[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const locationState = ref<LocationState>('idle')
const locationError = ref<string | null>(null)
const userPosition = ref<UserPosition | null>(null)
const buildingSourceLabel = ref('Not loaded')
const lastUpdatedAt = ref<number | null>(null)

let locationWatchId: number | null = null

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

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
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

function readCoordinateCandidate(record: Record<string, unknown>, keys: string[]) {
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

function normalizeLookup(value: string) {
  return value.trim().toLowerCase()
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function computeDistanceMeters(from: UserPosition, target: { latitude: number; longitude: number }) {
  const earthRadius = 6371000
  const latitudeDelta = toRadians(target.latitude - from.latitude)
  const longitudeDelta = toRadians(target.longitude - from.longitude)
  const latitudeStart = toRadians(from.latitude)
  const latitudeEnd = toRadians(target.latitude)
  const haversineValue =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(latitudeStart) *
      Math.cos(latitudeEnd) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2)

  return 2 * earthRadius * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
}

function mapCampusBuildingRow(row: CampusBuildingRow) {
  const id = readStringCandidate(row, ['id'])
  const name = readStringCandidate(row, ['name', 'title', 'building_name'])
  const latitude = readCoordinateCandidate(row, ['latitude', 'lat'])
  const longitude = readCoordinateCandidate(row, ['longitude', 'long', 'lng', 'lon'])

  if (!id || !name || latitude === null || longitude === null) {
    return null
  }

  return {
    id,
    name,
    latitude,
    longitude
  } satisfies BuildingLocation
}

async function fetchBuildingLocations() {
  let lastError: unknown = null

  for (const source of [
    { tableName: 'building', label: 'Supabase building' },
    { tableName: 'buildings', label: 'Supabase buildings' },
    { tableName: 'campus_buildings', label: 'Supabase campus_buildings' }
  ]) {
    try {
      const { data, error } = await supabase.from(source.tableName).select('*')

      if (error) {
        throw error
      }

      const mappedBuildings = ((data ?? []) as CampusBuildingRow[])
        .map(mapCampusBuildingRow)
        .filter((building): building is BuildingLocation => building !== null)

      if (mappedBuildings.length > 0) {
        buildingSourceLabel.value = source.label
        return mappedBuildings
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    console.warn('Unable to load buildings for microwave distance ranking.', lastError)
  }

  buildingSourceLabel.value = 'No building dataset available'
  return []
}

async function loadPageData() {
  if (isLoading.value) {
    return
  }

  isLoading.value = true
  loadError.value = null

  try {
    const [{ data, error }, resolvedBuildings] = await Promise.all([
      supabase.from('microwaves').select('*'),
      fetchBuildingLocations()
    ])

    if (error) {
      throw error
    }

    microwaves.value = (data ?? []) as MicrowaveRow[]
    buildingLocations.value = resolvedBuildings
    lastUpdatedAt.value = Date.now()
  } catch (error) {
    console.error('Unable to load microwaves.', error)
    loadError.value =
      error instanceof Error ? error.message : 'Unable to load microwaves from Supabase.'
  } finally {
    isLoading.value = false
  }
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

function refreshLocation() {
  startLocationWatch()
}

function formatDistance(distanceMeters: number | null) {
  if (distanceMeters === null) {
    return 'Distance unavailable'
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`
  }

  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 2 : 1)} km`
}

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

const buildingsById = computed(() => {
  const lookup = new Map<string, BuildingLocation>()

  for (const building of buildingLocations.value) {
    lookup.set(normalizeLookup(building.id), building)
  }

  return lookup
})

const buildingsByName = computed(() => {
  const lookup = new Map<string, BuildingLocation>()

  for (const building of buildingLocations.value) {
    lookup.set(normalizeLookup(building.name), building)
  }

  return lookup
})

function resolveMicrowaveLocation(row: MicrowaveRow) {
  const buildingReference = readStringCandidate(row, ['building'])
  const directLatitude = readCoordinateCandidate(row, ['latitude', 'lat'])
  const directLongitude = readCoordinateCandidate(row, ['longitude', 'long', 'lng', 'lon'])

  if (directLatitude !== null && directLongitude !== null) {
    return {
      latitude: directLatitude,
      longitude: directLongitude,
      buildingName:
        readStringCandidate(row, ['building_name', 'buildingName']) ?? buildingReference ?? 'Unknown building'
    }
  }

  const buildingId =
    readStringCandidate(row, ['building_id', 'buildingId', 'building_uuid', 'buildingUuid']) ??
    buildingReference
  const buildingName = readStringCandidate(row, ['building_name', 'buildingName']) ?? buildingReference
  const nestedBuilding = readRecordCandidate(row, ['building', 'buildings'])

  if (buildingId) {
    const building = buildingsById.value.get(normalizeLookup(buildingId))

    if (building) {
      return building
    }
  }

  if (buildingName) {
    const building = buildingsByName.value.get(normalizeLookup(buildingName))

    if (building) {
      return building
    }
  }

  if (nestedBuilding) {
    const nestedLatitude = readCoordinateCandidate(nestedBuilding, ['latitude', 'lat'])
    const nestedLongitude = readCoordinateCandidate(nestedBuilding, ['longitude', 'long', 'lng', 'lon'])
    const nestedName = readStringCandidate(nestedBuilding, ['name', 'title', 'building_name'])

    if (nestedLatitude !== null && nestedLongitude !== null) {
      return {
        latitude: nestedLatitude,
        longitude: nestedLongitude,
        buildingName: nestedName ?? 'Unknown building'
      }
    }

    const nestedId = readStringCandidate(nestedBuilding, ['id'])

    if (nestedId) {
      const building = buildingsById.value.get(normalizeLookup(nestedId))

      if (building) {
        return building
      }
    }

    if (nestedName) {
      const building = buildingsByName.value.get(normalizeLookup(nestedName))

      if (building) {
        return building
      }
    }
  }

  return null
}

const microwaveResolution = computed(() => {
  const items: MicrowaveListItem[] = []
  let unresolvedCount = 0

  for (const row of microwaves.value) {
    const location = resolveMicrowaveLocation(row)

    if (!location) {
      unresolvedCount += 1
      continue
    }

    const microwaveName =
      readStringCandidate(row, ['name', 'title', 'label']) ??
      `${location.buildingName} microwave`
    const microwaveId =
      readStringCandidate(row, ['id']) ??
      `${location.buildingName}-${microwaveName}`

    items.push({
      id: microwaveId,
      name: microwaveName,
      buildingName: location.buildingName,
      latitude: location.latitude,
      longitude: location.longitude,
      distanceMeters: userPosition.value
        ? computeDistanceMeters(userPosition.value, location)
        : null,
      floor: readStringCandidate(row, ['floor', 'level'])
    })
  }

  items.sort((left, right) => {
    if (left.distanceMeters !== null && right.distanceMeters !== null) {
      if (left.distanceMeters !== right.distanceMeters) {
        return left.distanceMeters - right.distanceMeters
      }
    } else if (left.distanceMeters !== null) {
      return -1
    } else if (right.distanceMeters !== null) {
      return 1
    }

    const buildingCompare = left.buildingName.localeCompare(right.buildingName)

    if (buildingCompare !== 0) {
      return buildingCompare
    }

    return left.name.localeCompare(right.name)
  })

  return {
    items,
    unresolvedCount
  }
})

const microwaveItems = computed(() => microwaveResolution.value.items)
const unresolvedMicrowavesCount = computed(() => microwaveResolution.value.unresolvedCount)
const nearestMicrowave = computed(() => microwaveItems.value[0] ?? null)

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

onMounted(() => {
  loadPageData()
  startLocationWatch()
})

onBeforeUnmount(() => {
  stopLocationWatch()
})
</script>

<template>
  <main class="min-h-screen bg-slate-50 text-slate-950">
    <section class="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header class="border-b border-slate-200 pb-5">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
        >
          <span aria-hidden="true">←</span>
          <span>Back home</span>
        </NuxtLink>

        <div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div class="space-y-2">
            <p class="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">Main Services</p>
            <h1 class="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Microwaves</h1>
            <p class="max-w-2xl text-sm text-slate-600 sm:text-base">
              Sorted by distance from your current position, using each microwave building location.
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
              class="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:border-orange-400 hover:bg-orange-100"
              :disabled="isLoading"
              @click="loadPageData"
            >
              {{ isLoading ? 'Loading…' : 'Reload data' }}
            </button>
          </div>
        </div>
      </header>

      <section class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Microwaves</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">{{ microwaveItems.length }}</p>
          <p class="mt-1 text-sm text-slate-600">
            <template v-if="unresolvedMicrowavesCount > 0">
              {{ unresolvedMicrowavesCount }} missing a building match
            </template>
            <template v-else>
              All visible rows have coordinates
            </template>
          </p>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Nearest</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">
            {{ nearestMicrowave ? formatDistance(nearestMicrowave.distanceMeters) : '—' }}
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

      <section class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
        <p>Building source: {{ buildingSourceLabel }}</p>
        <p>Last refresh: {{ lastUpdatedLabel }}</p>
      </section>

      <section class="mt-6 flex-1">
        <div v-if="isLoading" class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading microwaves and building positions…
        </div>

        <div
          v-else-if="loadError"
          class="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        >
          {{ loadError }}
        </div>

        <div
          v-else-if="microwaveItems.length === 0"
          class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          No microwave rows with a resolvable position are currently available.
        </div>

        <ul v-else class="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <li
            v-for="(microwave, index) in microwaveItems"
            :key="microwave.id"
            class="border-b border-slate-200 last:border-b-0"
          >
            <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div class="flex items-start gap-4">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700"
                >
                  {{ index + 1 }}
                </div>

                <div class="min-w-0">
                  <h2 class="text-base font-semibold text-slate-950">{{ microwave.name }}</h2>
                  <p class="mt-1 text-sm text-slate-600">{{ microwave.buildingName }}</p>
                  <p v-if="microwave.floor" class="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    Floor {{ microwave.floor }}
                  </p>
                </div>
              </div>

              <div class="pl-14 text-left sm:pl-0 sm:text-right">
                <p class="text-lg font-semibold text-slate-950">{{ formatDistance(microwave.distanceMeters) }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ formatCoordinates(microwave.latitude, microwave.longitude) }}</p>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </section>
  </main>
</template>
