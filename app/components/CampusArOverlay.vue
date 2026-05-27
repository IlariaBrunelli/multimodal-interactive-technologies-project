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
  guidedTourCurrentName?: string | null
  guidedTourCurrentStorytelling?: string | null
  guidedTourCurrentDistanceMeters?: number | null
  guidedTourCompletionRadiusMeters?: number
  guidedTourError?: string | null
}>()

const emit = defineEmits<{
  requestAccess: []
  requestBuildingDetails: [buildingId: string]
}>()

const guidedTourNsteps = computed(() => props.guidedTourNsteps ?? 0)
const guidedTourTotalSteps = computed(() => props.guidedTourTotalSteps ?? 0)
const guidedTourCompletionRadius = computed(() => props.guidedTourCompletionRadiusMeters ?? 15)
const isGuidedTourComplete = computed(() => (
  Boolean(props.isGuidedTourActive) &&
  guidedTourTotalSteps.value > 0 &&
  guidedTourNsteps.value >= guidedTourTotalSteps.value
))
const guidedTourStepNumber = computed(() => Math.min(guidedTourNsteps.value + 1, guidedTourTotalSteps.value))
const guidedTourDistanceLabel = computed(() => {
  if (
    props.guidedTourCurrentDistanceMeters === null ||
    typeof props.guidedTourCurrentDistanceMeters === 'undefined'
  ) {
    return null
  }

  return `${Math.round(props.guidedTourCurrentDistanceMeters)} m away`
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

  if (props.isGuidedTourActive && props.guidedTourCurrentName && props.markers.length === 0) {
    return {
      title: 'Find the next stop',
      detail: `Move toward ${props.guidedTourCurrentName}. This step completes within ${guidedTourCompletionRadius.value} meters.`
    }
  }

  if (props.markers.length === 0) {
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
</script>

<template>
  <div v-if="enabled" class="campus-ar-overlay">
    <div
      v-for="marker in markers"
      :key="marker.id"
      class="ar-marker"
      :class="{ 'ar-marker--primary': primaryMarker?.id === marker.id }"
      :style="{
        left: `${marker.x}px`,
        top: `${marker.y}px`,
        opacity: marker.confidence.toFixed(2)
      }"
    >
      <div class="ar-marker-dot" :style="{ backgroundColor: marker.color }"></div>
      <div class="ar-marker-label">
        <strong>{{ marker.name }}</strong>
        <span>{{ Math.round(marker.distanceMeters) }} m</span>
      </div>
    </div>

    <div v-if="isGuidedTourActive" class="guided-tour-status">
      <div class="guided-tour-status-header">
        <span>Guided Tour</span>
        <strong>{{ guidedTourNsteps }} / {{ guidedTourTotalSteps }}</strong>
      </div>
      <div v-if="isGuidedTourComplete" class="guided-tour-status-body">
        <strong>Tour complete</strong>
        <span>All stops reached.</span>
      </div>
      <div v-else class="guided-tour-status-body">
        <span v-if="guidedTourTotalSteps > 0">Step {{ guidedTourStepNumber }} of {{ guidedTourTotalSteps }}</span>
        <strong>{{ guidedTourCurrentName ?? 'Loading next stop' }}</strong>
        <span v-if="guidedTourCurrentStorytelling">{{ guidedTourCurrentStorytelling }}</span>
        <span v-if="guidedTourDistanceLabel">
          {{ guidedTourDistanceLabel }} - complete within {{ guidedTourCompletionRadius }} m
        </span>
      </div>
    </div>

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
      v-if="primaryMarker"
      type="button"
      class="ar-primary-card"
      @click="emit('requestBuildingDetails', primaryMarker.id)"
    >
      <strong>{{ primaryMarker.name }}</strong>
      <span>{{ Math.round(primaryMarker.distanceMeters) }} m away</span>
      <span>Bearing {{ formatBearing(primaryMarker.bearing) }}</span>
      <span v-if="!shouldShowPrimaryDetails()" class="ar-primary-hint">Tap for details</span>
      <span v-else-if="isLoadingBuildingDetails" class="ar-primary-hint">Loading details...</span>
      <span v-else-if="buildingDetailsError" class="ar-primary-detail ar-primary-detail--error">
        {{ buildingDetailsError }}
      </span>
      <span v-else-if="buildingHistoricalDetails" class="ar-primary-detail">
        {{ buildingHistoricalDetails }}
      </span>
      <span v-else class="ar-primary-detail">
        No historical details available for this building.
      </span>
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
.ar-error-banner {
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
  transition: left 0.12s linear, top 0.12s linear, opacity 0.12s linear;
}

.ar-marker-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.96);
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
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

.guided-tour-status {
  position: absolute;
  top: 24px;
  right: 24px;
  width: min(330px, calc(100vw - 48px));
  padding: 12px 14px;
  border-radius: 12px;
  display: grid;
  gap: 10px;
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
  color: #f8fafc;
  font-size: 1rem;
  letter-spacing: 0;
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

.ar-empty-state {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(340px, calc(100vw - 36px));
  padding: 14px 16px;
  border-radius: 12px;
  display: grid;
  gap: 6px;
  pointer-events: auto;
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
  bottom: max(340px, 42vh);
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
  }

  .ar-primary-card {
    left: 12px;
    right: 12px;
    width: auto;
    bottom: max(360px, 44vh);
  }

  .ar-error-banner {
    left: 12px;
    right: 12px;
  }
}
</style>
