<script setup lang="ts">
import type { ArPermissionState, CampusArMarker, CampusArStatus } from '~/composables/useCampusAr'

const props = defineProps<{
  enabled: boolean
  markers: CampusArMarker[]
  primaryMarker: CampusArMarker | null
  sensorStatus: CampusArStatus
  cameraPermissionState: ArPermissionState
  buildingSourceLabel: string
  hasBuildings: boolean
  isLoadingBuildings: boolean
  isRequestingAccess?: boolean
  selectedBuildingId?: string | null
  buildingHistoricalDetails?: string | null
  isLoadingBuildingDetails?: boolean
  buildingDetailsError?: string | null
  isGuidedTourActive?: boolean
  guidedTourNsteps?: number
  guidedTourTotalSteps?: number
  guidedTourCurrentBuildingId?: string | null
  guidedTourCurrentName?: string | null
  guidedTourCurrentAlias?: string | null
  guidedTourCurrentStorytelling?: string | null
  guidedTourCurrentDistanceMeters?: number | null
  guidedTourCompletionRadiusMeters?: number
  guidedTourError?: string | null
}>()

const emit = defineEmits<{
  openMap: []
  requestAccess: []
  requestBuildingDetails: [buildingId: string]
}>()

type RenderedCampusArMarker = CampusArMarker & {
  isGuidedTourFallback?: boolean
}

const guidedTourNsteps = computed(() => props.guidedTourNsteps ?? 0)
const guidedTourTotalSteps = computed(() => props.guidedTourTotalSteps ?? 0)
const guidedTourCompletionRadius = computed(() => props.guidedTourCompletionRadiusMeters ?? 15)
const isGuidedTourComplete = computed(() => (
  Boolean(props.isGuidedTourActive) &&
  guidedTourTotalSteps.value > 0 &&
  guidedTourNsteps.value >= guidedTourTotalSteps.value
))
const guidedTourStepNumber = computed(() => Math.min(guidedTourNsteps.value + 1, guidedTourTotalSteps.value))
const guidedTourBuildingLabel = computed(() => {
  const name = props.guidedTourCurrentName?.trim()
  const alias = props.guidedTourCurrentAlias?.trim()

  if (name && alias) {
    return `${name} - ${alias}`
  }

  return name || alias || null
})
const guidedTourDistanceLabel = computed(() => {
  if (
    props.guidedTourCurrentDistanceMeters === null ||
    typeof props.guidedTourCurrentDistanceMeters === 'undefined'
  ) {
    return null
  }

  return `${Math.round(props.guidedTourCurrentDistanceMeters)} m away`
})
const overlayViewport = ref({
  width: 1,
  height: 1
})
const renderedMarkers = computed<RenderedCampusArMarker[]>(() => {
  if (props.markers.length > 0) {
    return props.markers
  }

  if (!props.isGuidedTourActive || isGuidedTourComplete.value || !guidedTourBuildingLabel.value) {
    return []
  }

  const width = overlayViewport.value.width
  const height = overlayViewport.value.height

  return [
    {
      id: 'guided-tour-fallback-target',
      name: guidedTourBuildingLabel.value,
      color: '#ef4444',
      distanceMeters: props.guidedTourCurrentDistanceMeters ?? 0,
      bearing: props.sensorStatus.heading ?? 0,
      relativeBearing: 0,
      x: Math.min(Math.max(width / 2, 44), width - 44),
      y: Math.min(Math.max(height * 0.52, 220), Math.max(220, height - 190)),
      confidence: 0.92,
      isPinnedTarget: true,
      isGuidedTourFallback: true
    }
  ]
})

function updateOverlayViewport() {
  if (!import.meta.client) {
    return
  }

  overlayViewport.value = {
    width: Math.max(window.innerWidth, 1),
    height: Math.max(window.innerHeight, 1)
  }
}

function getMarkerDetailLabel(marker: RenderedCampusArMarker) {
  if (marker.isGuidedTourFallback) {
    return guidedTourDistanceLabel.value ?? 'Target position'
  }

  if (marker.isPinnedTarget) {
    return 'Target direction'
  }

  return `${Math.round(marker.distanceMeters)} m`
}

onMounted(() => {
  updateOverlayViewport()

  if (import.meta.client) {
    window.addEventListener('resize', updateOverlayViewport)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', updateOverlayViewport)
  }
})

const emptyState = computed(() => {
  if (props.cameraPermissionState === 'denied') {
    return {
      title: 'Camera access is blocked',
      detail: 'Allow camera access to use the outdoor AR overlay.'
    }
  }

  if (props.cameraPermissionState !== 'granted') {
    return {
      title: 'Starting camera',
      detail: 'Allow camera access to open the live AR view.'
    }
  }

  if (props.sensorStatus.locationPermissionState === 'denied') {
    return {
      title: 'Location access is blocked',
      detail: 'Allow precise location to place labels against the campus layout.'
    }
  }

  if (
    props.sensorStatus.locationPermissionState !== 'granted' ||
    props.sensorStatus.locationAccuracyMeters === null
  ) {
    return {
      title: 'Locating you',
      detail: 'Allow precise location and wait a moment for the first GPS fix.'
    }
  }

  if (props.sensorStatus.orientationPermissionState === 'denied') {
    return {
      title: 'Motion access is blocked',
      detail: 'Allow motion and compass access so the overlay can follow the camera heading.'
    }
  }

  if (
    props.sensorStatus.orientationPermissionState !== 'granted' ||
    props.sensorStatus.heading === null
  ) {
    return {
      title: 'Calibrating compass',
      detail: 'Move the phone slightly so the AR overlay can align with nearby buildings.'
    }
  }

  if (props.isLoadingBuildings) {
    return {
      title: props.isGuidedTourActive ? 'Loading guided tour' : 'Loading building anchors',
      detail: props.isGuidedTourActive ? 'Reading ordered tour stops...' : 'Reading mapped buildings...'
    }
  }

  if (props.isGuidedTourActive && props.guidedTourError) {
    return {
      title: 'Guided tour unavailable',
      detail: props.guidedTourError
    }
  }

  if (isGuidedTourComplete.value) {
    return {
      title: 'Guided tour complete',
      detail: 'All guided tour stops have been reached.'
    }
  }

  if (!props.hasBuildings) {
    return {
      title: props.isGuidedTourActive ? 'No guided tour stops' : 'No building dataset available',
      detail: props.isGuidedTourActive
        ? 'Add rows to guided_tour and connect each step to a mapped building.'
        : 'Load building rows from Supabase before using the outdoor AR overlay.'
    }
  }

  if (props.markers.length === 0) {
    if (props.isGuidedTourActive) {
      return null
    }

    return {
      title: 'No building anchor in view',
      detail: 'Move closer to a mapped building within 160 meters or verify the Supabase building coordinates.'
    }
  }

  return null
})

function formatPermissionLabel(value: ArPermissionState) {
  switch (value) {
    case 'granted':
      return 'ready'
    case 'prompt':
      return 'pending'
    case 'denied':
      return 'blocked'
    case 'unsupported':
      return 'unsupported'
    default:
      return 'idle'
  }
}

function formatBearing(value: number) {
  return `${Math.round(value)}°`
}

function shouldShowAccessButton() {
  return (
    props.cameraPermissionState !== 'granted' ||
    props.sensorStatus.locationPermissionState !== 'granted' ||
    props.sensorStatus.orientationPermissionState !== 'granted'
  )
}

function shouldShowPrimaryDetails() {
  return props.primaryMarker?.id === props.selectedBuildingId
}

function shouldShowGuidedTourDetails() {
  return Boolean(
    props.guidedTourCurrentBuildingId &&
    props.guidedTourCurrentBuildingId === props.selectedBuildingId
  )
}

function requestGuidedTourBuildingDetails() {
  if (!isGuidedTourComplete.value && props.guidedTourCurrentBuildingId) {
    emit('requestBuildingDetails', props.guidedTourCurrentBuildingId)
  }
}
</script>

<template>
  <div v-if="enabled" class="campus-ar-overlay">
    <div
      v-for="marker in renderedMarkers"
      :key="marker.id"
      class="ar-marker"
      :class="{
        'ar-marker--primary': primaryMarker?.id === marker.id,
        'ar-marker--pinned-target': marker.isPinnedTarget,
        'ar-marker--guided-target': isGuidedTourActive
      }"
      :style="{
        left: `${marker.x}px`,
        top: `${marker.y}px`,
        opacity: marker.confidence.toFixed(2)
      }"
    >
      <div
        class="ar-marker-dot"
        :class="{ 'ar-marker-dot--guided': isGuidedTourActive }"
        :style="{ backgroundColor: isGuidedTourActive ? '#ef4444' : marker.color }"
      ></div>
      <div class="ar-marker-label">
        <strong>{{ marker.name }}</strong>
        <span>{{ getMarkerDetailLabel(marker) }}</span>
      </div>
    </div>

    <button
      v-if="isGuidedTourActive"
      type="button"
      class="guided-tour-status"
      :class="{
        'guided-tour-status--interactive': !isGuidedTourComplete && Boolean(guidedTourCurrentBuildingId),
        'guided-tour-status--details': shouldShowGuidedTourDetails()
      }"
      :aria-expanded="shouldShowGuidedTourDetails()"
      @click="requestGuidedTourBuildingDetails"
    >
      <div class="guided-tour-status-header">
        <span>Guided Tour</span>
        <strong>
          <span class="guided-tour-pin" aria-hidden="true"></span>
          {{ guidedTourNsteps }} / {{ guidedTourTotalSteps }}
        </strong>
      </div>
      <div v-if="isGuidedTourComplete" class="guided-tour-status-body">
        <strong>Tour complete</strong>
        <span>All stops reached.</span>
      </div>
      <div v-else class="guided-tour-status-body">
        <div v-if="guidedTourTotalSteps > 0" class="guided-tour-step-instruction">
          <span>Step {{ guidedTourStepNumber }} of {{ guidedTourTotalSteps }}</span>
          <span>Move within {{ guidedTourCompletionRadius }} meters from the indicated building</span>
        </div>
        <strong>{{ guidedTourBuildingLabel ?? 'Loading next stop' }}</strong>
        <span v-if="guidedTourCurrentStorytelling">{{ guidedTourCurrentStorytelling }}</span>
        <div class="guided-tour-detail-summary">
          <span v-if="guidedTourDistanceLabel">{{ guidedTourDistanceLabel }}</span>
          <span
            v-if="guidedTourCurrentBuildingId && !shouldShowGuidedTourDetails()"
            class="ar-primary-hint"
          >
            Tap for details
          </span>
          <span v-else-if="isLoadingBuildingDetails" class="ar-primary-hint">Loading details...</span>
          <span v-else-if="shouldShowGuidedTourDetails()" class="ar-primary-hint">Tap to close details</span>
        </div>
        <template v-if="shouldShowGuidedTourDetails() && !isLoadingBuildingDetails">
          <span v-if="buildingDetailsError" class="ar-primary-detail ar-primary-detail--error">
            {{ buildingDetailsError }}
          </span>
          <span v-else-if="buildingHistoricalDetails" class="ar-primary-detail">
            {{ buildingHistoricalDetails }}
          </span>
          <span v-else class="ar-primary-detail">
            No historical details available for this building.
          </span>
        </template>
      </div>
    </button>

    <button
      v-if="!isGuidedTourActive"
      type="button"
      class="ar-map-button"
      :disabled="sensorStatus.locationPermissionState !== 'granted' || sensorStatus.locationAccuracyMeters === null"
      @click="emit('openMap')"
    >
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
        <path d="M9 3v15M15 6v15" />
      </svg>
      <span>
        {{ sensorStatus.locationAccuracyMeters === null ? 'Locating for map...' : 'Open in map' }}
      </span>
    </button>

    <div v-if="emptyState" class="ar-empty-state">
      <strong>{{ emptyState.title }}</strong>
      <span>{{ emptyState.detail }}</span>
      <button
        v-if="shouldShowAccessButton()"
        type="button"
        class="ar-access-button"
        :disabled="props.isRequestingAccess"
        @click="emit('requestAccess')"
      >
        {{ props.isRequestingAccess ? 'Requesting access...' : 'Allow Access' }}
      </button>
    </div>

    <button
      v-if="primaryMarker && !isGuidedTourActive"
      type="button"
      class="ar-primary-card"
      @click="emit('requestBuildingDetails', primaryMarker.id)"
    >
      <strong>{{ primaryMarker.name }}</strong>
      <span>{{ Math.round(primaryMarker.distanceMeters) }} m away</span>
      <span>Bearing {{ formatBearing(primaryMarker.bearing) }}</span>
      <span v-if="!shouldShowPrimaryDetails()" class="ar-primary-hint">Tap for details</span>
      <span v-else-if="isLoadingBuildingDetails" class="ar-primary-hint">Loading details...</span>
      <template v-else>
        <span class="ar-primary-hint">Tap to close details</span>
        <span v-if="buildingDetailsError" class="ar-primary-detail ar-primary-detail--error">
          {{ buildingDetailsError }}
        </span>
        <span v-else-if="buildingHistoricalDetails" class="ar-primary-detail">
          {{ buildingHistoricalDetails }}
        </span>
        <span v-else class="ar-primary-detail">
          No historical details available for this building.
        </span>
      </template>
    </button>

    <div v-if="sensorStatus.errorMessage" class="ar-error-banner">
      {{ sensorStatus.errorMessage }}
    </div>
  </div>
</template>

<style scoped>
.campus-ar-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.ar-marker-label,
.ar-primary-card,
.ar-empty-state,
.guided-tour-status,
.ar-error-banner,
.ar-map-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(15, 23, 42, 0.74);
  color: #f8fafc;
  backdrop-filter: blur(18px);
}

.ar-marker {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transform: translate(-50%, -50%);
  transition: left 0.24s ease-out, top 0.24s ease-out, opacity 0.18s linear;
  z-index: 2;
}

.ar-marker-dot {
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.96);
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.ar-marker-dot--guided {
  width: 18px;
  height: 18px;
  border-radius: 999px 999px 999px 4px;
  transform: rotate(-45deg);
  box-shadow: 0 0 0 7px rgba(239, 68, 68, 0.18);
}

.ar-marker-dot--guided::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #fff;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.ar-marker-label {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  min-width: 116px;
}

.ar-marker-label strong {
  font-size: 0.88rem;
  line-height: 1.1;
}

.ar-marker-label span {
  font-size: 0.76rem;
  color: rgba(226, 232, 240, 0.9);
}

.ar-marker--primary .ar-marker-dot {
  width: 18px;
  height: 18px;
  box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.14);
}

.ar-marker--primary .ar-marker-dot--guided {
  box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.18);
}

.ar-marker--pinned-target {
  opacity: 0.94 !important;
}

.ar-marker--guided-target {
  z-index: 4;
}

.ar-marker--pinned-target .ar-marker-label {
  border-color: rgba(248, 113, 113, 0.35);
  background: rgba(127, 29, 29, 0.78);
}

.guided-tour-status {
  position: absolute;
  top: 24px;
  right: 24px;
  width: min(330px, calc(100vw - 48px));
  padding: 12px 14px;
  border-radius: 12px;
  display: grid;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  text-align: left;
  font: inherit;
  appearance: none;
  pointer-events: auto;
  z-index: 3;
}

.guided-tour-status--interactive {
  cursor: pointer;
}

.guided-tour-status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(226, 232, 240, 0.92);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.guided-tour-status-header strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #f8fafc;
  font-size: 1rem;
  letter-spacing: 0;
}

.guided-tour-pin {
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 999px 999px 999px 3px;
  background: #ef4444;
  transform: rotate(-45deg);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
}

.guided-tour-pin::after {
  content: '';
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #fff;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.guided-tour-status-body {
  display: grid;
  gap: 4px;
}

.guided-tour-status-body strong {
  color: #f8fafc;
  font-size: 0.96rem;
  line-height: 1.2;
}

.guided-tour-status-body span {
  color: rgba(226, 232, 240, 0.92);
  font-size: 0.82rem;
  line-height: 1.35;
}

.guided-tour-step-instruction {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.guided-tour-step-instruction span:last-child {
  color: #f8fafc;
  font-weight: 700;
}

.guided-tour-detail-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.guided-tour-detail-summary .ar-primary-hint {
  margin-top: 0;
}

.ar-empty-state {
  position: absolute;
  left: 24px;
  top: 154px;
  transform: none;
  width: min(340px, calc(100vw - 36px));
  padding: 14px 16px;
  border-radius: 12px;
  display: grid;
  gap: 6px;
  pointer-events: auto;
  z-index: 3;
}

.ar-empty-state strong,
.ar-primary-card strong {
  font-size: 0.96rem;
}

.ar-empty-state span,
.ar-primary-card span,
.ar-error-banner {
  font-size: 0.82rem;
  line-height: 1.4;
}

.ar-primary-card {
  position: absolute;
  left: 24px;
  top: 154px;
  bottom: auto;
  width: min(320px, calc(100vw - 36px));
  padding: 12px 14px;
  border-radius: 12px;
  display: grid;
  gap: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  text-align: left;
  font: inherit;
  appearance: none;
  cursor: pointer;
  pointer-events: auto;
  z-index: 3;
}

.ar-map-button {
  position: absolute;
  left: 24px;
  top: 96px;
  min-height: 46px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  pointer-events: auto;
  z-index: 4;
}

.ar-map-button:disabled {
  cursor: wait;
  opacity: 0.58;
}

.ar-map-button svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ar-primary-hint {
  margin-top: 4px;
  font-size: 0.76rem;
  font-weight: 700;
  color: rgba(248, 250, 252, 0.82);
}

.ar-primary-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(248, 250, 252, 0.94);
  max-height: 170px;
  overflow-y: auto;
}

.ar-primary-detail--error {
  color: #fecaca;
}

.ar-access-button {
  min-height: 42px;
  margin-top: 6px;
  border: 0;
  border-radius: 10px;
  padding: 0 14px;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  color: #102c53;
  background: rgba(255, 255, 255, 0.94);
  cursor: pointer;
}

.ar-access-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.ar-error-banner {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 24px;
  padding: 10px 12px;
  border-radius: 10px;
  text-align: center;
}

@media (max-width: 640px) {
  .guided-tour-status {
    top: 92px;
    left: 12px;
    right: 12px;
    width: auto;
    max-height: 176px;
    overflow-y: auto;
  }

  .guided-tour-status--details {
    max-height: min(360px, 46dvh);
  }

  .ar-primary-card {
    left: 12px;
    right: 12px;
    top: 154px;
    width: auto;
    bottom: auto;
  }

  .ar-empty-state {
    left: 12px;
    right: 12px;
    top: 154px;
    width: auto;
  }

  .ar-primary-detail {
    max-height: min(150px, 18dvh);
  }

  .ar-map-button {
    left: 12px;
    top: 96px;
  }

  .ar-error-banner {
    left: 12px;
    right: 12px;
  }
}
</style>
