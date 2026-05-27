import { computed, onBeforeUnmount, reactive, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { CampusBuilding } from '~/data/campusBuildings'

export type ArPermissionState = 'idle' | 'prompt' | 'granted' | 'denied' | 'unsupported'

export type CampusArMarker = {
  id: string
  name: string
  color: string
  distanceMeters: number
  bearing: number
  relativeBearing: number
  x: number
  y: number
  confidence: number
  isPinnedTarget?: boolean
}

export type CampusArBuildingDistance = {
  id: string
  name: string
  distanceMeters: number
  bearing: number
}

export type CampusArStatus = {
  heading: number | null
  pitch: number | null
  roll: number | null
  locationAccuracyMeters: number | null
  locationPermissionState: ArPermissionState
  orientationPermissionState: ArPermissionState
  errorMessage: string | null
}

type GeoFix = {
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
}

type DevicePose = {
  heading: number | null
  pitch: number | null
  roll: number | null
}

type CompassDeviceOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number
}

type DeviceOrientationPermissionApi = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<'granted' | 'denied'>
}

type DeviceMotionPermissionApi = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

const DEFAULT_HORIZONTAL_FOV = 58
const MAX_VISIBLE_DISTANCE_METERS = 160
const MARKER_ALTITUDE_OFFSET_METERS = 25
const SENSOR_PERMISSION_TIMEOUT_MS = 10000
const PRIMARY_MARKER_SWITCH_MARGIN = 8

export function useCampusAr(buildingsSource: MaybeRefOrGetter<CampusBuilding[]>) {
  const buildings = computed(() => toValue(buildingsSource))
  const viewport = reactive({
    width: 1,
    height: 1
  })
  const userFix = ref<GeoFix | null>(null)
  const pose = ref<DevicePose>({
    heading: null,
    pitch: null,
    roll: null
  })
  const locationPermissionState = ref<ArPermissionState>('idle')
  const orientationPermissionState = ref<ArPermissionState>('idle')
  const errorMessage = ref<string | null>(null)

  let locationWatchId: number | null = null
  let orientationListenerAttached = false
  let resizeListenerAttached = false

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

  function normalizeAngle(value: number) {
    return (value % 360 + 360) % 360
  }

  function shortestAngleDelta(target: number, current: number) {
    let delta = normalizeAngle(target - current)

    if (delta > 180) {
      delta -= 360
    }

    return delta
  }

  function smoothAngle(previous: number | null, next: number, factor = 0.18) {
    if (previous === null) {
      return normalizeAngle(next)
    }

    return normalizeAngle(previous + shortestAngleDelta(next, previous) * factor)
  }

  function smoothValue(previous: number | null, next: number, factor = 0.18) {
    if (previous === null) {
      return next
    }

    return previous + (next - previous) * factor
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
  }

  function toRadians(value: number) {
    return (value * Math.PI) / 180
  }

  function toDegrees(value: number) {
    return (value * 180) / Math.PI
  }

  function computeDistanceMeters(from: GeoFix, target: CampusBuilding) {
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

  function computeBearingDegrees(from: GeoFix, target: CampusBuilding) {
    const latitudeStart = toRadians(from.latitude)
    const latitudeEnd = toRadians(target.latitude)
    const longitudeDelta = toRadians(target.longitude - from.longitude)
    const y = Math.sin(longitudeDelta) * Math.cos(latitudeEnd)
    const x =
      Math.cos(latitudeStart) * Math.sin(latitudeEnd) -
      Math.sin(latitudeStart) * Math.cos(latitudeEnd) * Math.cos(longitudeDelta)

    return normalizeAngle(toDegrees(Math.atan2(y, x)))
  }

  function computeElevationDegrees(from: GeoFix, target: CampusBuilding, distanceMeters: number) {
    const userAltitude = from.altitude ?? target.altitude ?? 0
    // Keep markers above ground level so nearby buildings sit closer to eye height in AR.
    const targetAltitude =
      (target.altitude ?? userAltitude) + (target.labelAltitude ?? 12) + MARKER_ALTITUDE_OFFSET_METERS

    if (distanceMeters < 1) {
      return 0
    }

    return toDegrees(Math.atan2(targetAltitude - userAltitude, distanceMeters))
  }

  function computeVerticalFovDegrees(width: number, height: number) {
    const horizontalFov = toRadians(DEFAULT_HORIZONTAL_FOV)

    if (!width || !height) {
      return 45
    }

    return toDegrees(2 * Math.atan(Math.tan(horizontalFov / 2) * (height / width)))
  }

  function getScreenAngle() {
    if (!import.meta.client) {
      return 0
    }

    const screenOrientation = window.screen.orientation

    if (screenOrientation && typeof screenOrientation.angle === 'number') {
      return screenOrientation.angle
    }

    return typeof window.orientation === 'number' ? window.orientation : 0
  }

  function extractHeading(event: CompassDeviceOrientationEvent) {
    if (typeof event.webkitCompassHeading === 'number') {
      return normalizeAngle(event.webkitCompassHeading)
    }

    if (typeof event.alpha === 'number') {
      return normalizeAngle(360 - event.alpha)
    }

    return null
  }

  function extractPitch(event: DeviceOrientationEvent) {
    if (typeof event.beta !== 'number') {
      return null
    }

    const screenAngle = getScreenAngle()

    if (screenAngle === 90) {
      return clamp(-(event.gamma ?? 0), -90, 90)
    }

    if (screenAngle === -90 || screenAngle === 270) {
      return clamp(event.gamma ?? 0, -90, 90)
    }

    return clamp(90 - event.beta, -90, 90)
  }

  function extractRoll(event: DeviceOrientationEvent) {
    if (typeof event.gamma !== 'number') {
      return null
    }

    const screenAngle = getScreenAngle()

    if (screenAngle === 90 || screenAngle === -90 || screenAngle === 270) {
      return clamp(90 - (event.beta ?? 90), -90, 90)
    }

    return clamp(event.gamma, -90, 90)
  }

  function handleOrientation(event: Event) {
    const orientationEvent = event as CompassDeviceOrientationEvent
    const nextHeading = extractHeading(orientationEvent)
    const nextPitch = extractPitch(orientationEvent)
    const nextRoll = extractRoll(orientationEvent)

    if (nextHeading === null && nextPitch === null && nextRoll === null) {
      return
    }

    orientationPermissionState.value = 'granted'
    errorMessage.value = null

    if (nextHeading !== null) {
      pose.value.heading = smoothAngle(pose.value.heading, nextHeading)
    }

    if (nextPitch !== null) {
      pose.value.pitch = smoothValue(pose.value.pitch, nextPitch)
    }

    if (nextRoll !== null) {
      pose.value.roll = smoothValue(pose.value.roll, nextRoll)
    }
  }

  function updateViewport() {
    if (!import.meta.client) {
      return
    }

    viewport.width = Math.max(window.innerWidth, 1)
    viewport.height = Math.max(window.innerHeight, 1)
  }

  async function ensureOrientationAccess() {
    if (!import.meta.client || typeof window.DeviceOrientationEvent === 'undefined') {
      orientationPermissionState.value = 'unsupported'
      return
    }

    const orientationApi = window.DeviceOrientationEvent as DeviceOrientationPermissionApi
    const motionApi =
      typeof window.DeviceMotionEvent === 'undefined'
        ? null
        : (window.DeviceMotionEvent as DeviceMotionPermissionApi)

    if (typeof orientationApi.requestPermission === 'function') {
      if (orientationPermissionState.value === 'granted') {
        return
      }

      orientationPermissionState.value = 'prompt'

      try {
        const motionResult =
          typeof motionApi?.requestPermission === 'function'
            ? await withTimeout(
                motionApi.requestPermission(),
                SENSOR_PERMISSION_TIMEOUT_MS,
                'Motion permission request timed out.'
              )
            : 'granted'
        const orientationResult = await withTimeout(
          orientationApi.requestPermission(true),
          SENSOR_PERMISSION_TIMEOUT_MS,
          'Compass permission request timed out.'
        )

        orientationPermissionState.value =
          motionResult === 'granted' && orientationResult === 'granted' ? 'granted' : 'denied'

        if (orientationPermissionState.value === 'denied') {
          errorMessage.value = 'Motion and compass permission was denied.'
        }
      } catch (error) {
        orientationPermissionState.value = 'idle'
        errorMessage.value =
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Motion and compass permission was denied.'
            : error instanceof Error
              ? error.message
              : 'Unable to start motion and compass sensors.'
      }

      return
    }

    orientationPermissionState.value = 'granted'
    errorMessage.value = null
  }

  function startLocationWatch() {
    if (!import.meta.client) {
      return
    }

    if (!navigator.geolocation) {
      locationPermissionState.value = 'unsupported'
      errorMessage.value = 'Geolocation is not available on this device.'
      return
    }

    if (locationWatchId !== null) {
      return
    }

    locationPermissionState.value = 'prompt'
    locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        locationPermissionState.value = 'granted'
        errorMessage.value = null
        userFix.value = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude,
          accuracy: position.coords.accuracy
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          locationPermissionState.value = 'denied'
          errorMessage.value = 'Location permission was denied.'
          return
        }

        errorMessage.value = 'Unable to resolve your position.'
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    )
  }

  function stopLocationWatch() {
    if (!import.meta.client || locationWatchId === null) {
      return
    }

    navigator.geolocation.clearWatch(locationWatchId)
    locationWatchId = null
  }

  function startOrientationWatch() {
    if (!import.meta.client || orientationListenerAttached) {
      return
    }

    window.addEventListener('deviceorientationabsolute', handleOrientation, true)
    window.addEventListener('deviceorientation', handleOrientation, true)
    orientationListenerAttached = true
  }

  function stopOrientationWatch() {
    if (!import.meta.client || !orientationListenerAttached) {
      return
    }

    window.removeEventListener('deviceorientationabsolute', handleOrientation, true)
    window.removeEventListener('deviceorientation', handleOrientation, true)
    orientationListenerAttached = false
  }

  function startResizeWatch() {
    if (!import.meta.client || resizeListenerAttached) {
      return
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    resizeListenerAttached = true
  }

  function stopResizeWatch() {
    if (!import.meta.client || !resizeListenerAttached) {
      return
    }

    window.removeEventListener('resize', updateViewport)
    resizeListenerAttached = false
  }

  async function start() {
    updateViewport()
    startResizeWatch()
    startLocationWatch()
    await ensureOrientationAccess()

    if (orientationPermissionState.value !== 'denied') {
      startOrientationWatch()
    }
  }

  function stop() {
    stopLocationWatch()
    stopOrientationWatch()
    stopResizeWatch()
  }

  function scoreMarker(marker: CampusArMarker) {
    return Math.abs(marker.relativeBearing) * 1.8 + marker.distanceMeters * 0.08
  }

  const buildingDistances = computed<CampusArBuildingDistance[]>(() => {
    if (!userFix.value) {
      return []
    }

    return buildings.value.map((building) => ({
      id: building.id,
      name: building.name,
      distanceMeters: computeDistanceMeters(userFix.value as GeoFix, building),
      bearing: computeBearingDegrees(userFix.value as GeoFix, building)
    }))
  })

  const markers = computed<CampusArMarker[]>(() => {
    if (!userFix.value) {
      return []
    }

    const verticalFov = computeVerticalFovDegrees(viewport.width, viewport.height)
    const shouldPinSingleTarget = buildings.value.length === 1

    if (pose.value.heading === null) {
      if (!shouldPinSingleTarget) {
        return []
      }

      return buildings.value.map((building) => {
        const distanceMeters = computeDistanceMeters(userFix.value as GeoFix, building)
        const bearing = computeBearingDegrees(userFix.value as GeoFix, building)

        return {
          id: building.id,
          name: building.name,
          color: building.color ?? '#2563eb',
          distanceMeters,
          bearing,
          relativeBearing: 0,
          x: clamp(viewport.width / 2, 36, viewport.width - 36),
          y: clamp(viewport.height * 0.52, 120, viewport.height - 190),
          confidence: 0.88,
          isPinnedTarget: true
        }
      })
    }

    const visibleMarkers = buildings.value
      .map((building) => {
        const distanceMeters = computeDistanceMeters(userFix.value as GeoFix, building)
        const bearing = computeBearingDegrees(userFix.value as GeoFix, building)
        const relativeBearing = shortestAngleDelta(bearing, pose.value.heading as number)
        const elevation = computeElevationDegrees(userFix.value as GeoFix, building, distanceMeters)
        const relativePitch = elevation - (pose.value.pitch ?? 0)
        const isWithinHorizontalFov = Math.abs(relativeBearing) <= DEFAULT_HORIZONTAL_FOV / 2 + 6
        const isWithinVerticalFov = Math.abs(relativePitch) <= verticalFov / 2 + 10
        const isNearby = distanceMeters <= MAX_VISIBLE_DISTANCE_METERS

        if ((!isWithinHorizontalFov || !isWithinVerticalFov || !isNearby) && !shouldPinSingleTarget) {
          return null
        }

        const isPinnedTarget = shouldPinSingleTarget && (!isWithinHorizontalFov || !isWithinVerticalFov || !isNearby)
        const projectedBearing = isPinnedTarget
          ? clamp(relativeBearing, -DEFAULT_HORIZONTAL_FOV / 2, DEFAULT_HORIZONTAL_FOV / 2)
          : relativeBearing
        const projectedPitch = isPinnedTarget
          ? clamp(relativePitch, -verticalFov / 2, verticalFov / 2)
          : relativePitch
        const x = ((projectedBearing + DEFAULT_HORIZONTAL_FOV / 2) / DEFAULT_HORIZONTAL_FOV) * viewport.width
        const y = ((verticalFov / 2 - projectedPitch) / verticalFov) * viewport.height
        const confidenceBase =
          1 -
          clamp(
            Math.abs(relativeBearing) / (DEFAULT_HORIZONTAL_FOV / 2) * 0.45 +
              Math.abs(relativePitch) / (verticalFov / 2) * 0.35 +
              distanceMeters / MAX_VISIBLE_DISTANCE_METERS * 0.2,
            0,
            1
          )

        return {
          id: building.id,
          name: building.name,
          color: building.color ?? '#2563eb',
          distanceMeters,
          bearing,
          relativeBearing,
          x: clamp(x, 36, viewport.width - 36),
          y: clamp(y, 88, viewport.height - 220),
          confidence: isPinnedTarget ? 0.88 : clamp(confidenceBase, 0.2, 1),
          isPinnedTarget
        }
      })
      .filter((marker): marker is CampusArMarker => marker !== null)
      .sort((left, right) => {
        const leftScore = Math.abs(left.relativeBearing) * 1.8 + left.distanceMeters * 0.08
        const rightScore = Math.abs(right.relativeBearing) * 1.8 + right.distanceMeters * 0.08

        return leftScore - rightScore
      })

    return visibleMarkers.slice(0, 6)
  })

  const primaryMarkerId = ref<string | null>(null)

  watch(
    markers,
    (nextMarkers) => {
      if (nextMarkers.length === 0) {
        primaryMarkerId.value = null
        return
      }

      const bestMarker = nextMarkers[0]
      const currentMarker = primaryMarkerId.value
        ? nextMarkers.find((marker) => marker.id === primaryMarkerId.value)
        : null

      if (!currentMarker) {
        primaryMarkerId.value = bestMarker.id
        return
      }

      const bestScore = scoreMarker(bestMarker)
      const currentScore = scoreMarker(currentMarker)

      if (bestMarker.id !== currentMarker.id && bestScore + PRIMARY_MARKER_SWITCH_MARGIN < currentScore) {
        primaryMarkerId.value = bestMarker.id
      }
    },
    { immediate: true }
  )

  const primaryMarker = computed(() => {
    if (!primaryMarkerId.value) {
      return null
    }

    return markers.value.find((marker) => marker.id === primaryMarkerId.value) ?? markers.value[0] ?? null
  })

  const status = computed<CampusArStatus>(() => ({
    heading: pose.value.heading,
    pitch: pose.value.pitch,
    roll: pose.value.roll,
    locationAccuracyMeters: userFix.value?.accuracy ?? null,
    locationPermissionState: locationPermissionState.value,
    orientationPermissionState: orientationPermissionState.value,
    errorMessage: errorMessage.value
  }))

  onBeforeUnmount(stop)

  return {
    buildingDistances,
    markers,
    primaryMarker,
    status,
    ensureOrientationAccess,
    start,
    stop
  }
}
