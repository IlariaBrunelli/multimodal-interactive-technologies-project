<script setup lang="ts">
import type { ArPermissionState, CampusArMarker, CampusArStatus } from '~/composables/useCampusAr'

const props = defineProps<{
  enabled: boolean
  markers: CampusArMarker[]
  primaryMarker: CampusArMarker | null
  sensorStatus: CampusArStatus
  cameraPermissionState: ArPermissionState
  buildingSourceLabel: string
  isLoadingBuildings: boolean
  isRequestingAccess?: boolean
}>()

const emit = defineEmits<{
  requestAccess: []
}>()

const permissionSummary = computed(() => [
  { label: 'Camera', value: props.cameraPermissionState },
  { label: 'Location', value: props.sensorStatus.locationPermissionState },
  { label: 'Compass', value: props.sensorStatus.orientationPermissionState }
])

const emptyState = computed(() => {
  if (props.isLoadingBuildings) {
    return {
      title: 'Loading building anchors',
      detail: `Source: ${props.buildingSourceLabel}`
    }
  }

  if (props.cameraPermissionState === 'denied') {
    return {
      title: 'Camera access is blocked',
      detail: 'Allow camera access to use the outdoor AR overlay.'
    }
  }

  if (props.sensorStatus.locationPermissionState === 'denied') {
    return {
      title: 'Location access is blocked',
      detail: 'Allow precise location to place labels against the campus layout.'
    }
  }

  if (props.sensorStatus.orientationPermissionState === 'denied') {
    return {
      title: 'Motion access is blocked',
      detail: 'Allow motion and compass access so the overlay can follow the camera heading.'
    }
  }

  if (props.markers.length === 0) {
    return {
      title: 'No building anchor in view',
      detail: 'Move closer to a mapped building or replace the demo coordinates with your campus dataset.'
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
</script>

<template>
  <div v-if="enabled" class="campus-ar-overlay">
    <div class="ar-hud">
      <div class="ar-source-pill">
        {{ buildingSourceLabel }}
      </div>

      <div class="ar-permission-row">
        <div
          v-for="entry in permissionSummary"
          :key="entry.label"
          class="ar-status-pill"
          :class="`ar-status-pill--${entry.value}`"
        >
          <span>{{ entry.label }}</span>
          <strong>{{ formatPermissionLabel(entry.value) }}</strong>
        </div>
      </div>

      <div class="ar-metrics">
        <span v-if="sensorStatus.heading !== null">Heading {{ formatBearing(sensorStatus.heading) }}</span>
        <span v-if="sensorStatus.pitch !== null">Pitch {{ Math.round(sensorStatus.pitch) }}°</span>
        <span v-if="sensorStatus.locationAccuracyMeters !== null">Accuracy {{ Math.round(sensorStatus.locationAccuracyMeters) }} m</span>
      </div>
    </div>

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

    <div v-if="primaryMarker" class="ar-primary-card">
      <strong>{{ primaryMarker.name }}</strong>
      <span>{{ Math.round(primaryMarker.distanceMeters) }} m away</span>
      <span>Bearing {{ formatBearing(primaryMarker.bearing) }}</span>
    </div>

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

.ar-hud {
  position: absolute;
  top: 24px;
  right: 24px;
  display: grid;
  justify-items: end;
  gap: 10px;
  max-width: min(360px, calc(100vw - 40px));
}

.ar-source-pill,
.ar-status-pill,
.ar-primary-card,
.ar-empty-state,
.ar-error-banner {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(15, 23, 42, 0.74);
  color: #f8fafc;
  backdrop-filter: blur(18px);
}

.ar-source-pill {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  letter-spacing: 0;
}

.ar-permission-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.ar-status-pill {
  min-width: 94px;
  padding: 8px 10px;
  border-radius: 10px;
  display: grid;
  gap: 2px;
  font-size: 0.75rem;
}

.ar-status-pill strong {
  font-size: 0.82rem;
  font-weight: 700;
}

.ar-status-pill--granted {
  border-color: rgba(34, 197, 94, 0.35);
}

.ar-status-pill--denied {
  border-color: rgba(248, 113, 113, 0.4);
}

.ar-status-pill--prompt,
.ar-status-pill--idle {
  border-color: rgba(250, 204, 21, 0.35);
}

.ar-status-pill--unsupported {
  border-color: rgba(148, 163, 184, 0.35);
}

.ar-metrics {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 12px;
  color: rgba(248, 250, 252, 0.88);
  font-size: 0.78rem;
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
  background: rgba(15, 23, 42, 0.74);
  color: #f8fafc;
  backdrop-filter: blur(12px);
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
  bottom: max(220px, 28vh);
  width: min(240px, calc(100vw - 36px));
  padding: 12px 14px;
  border-radius: 12px;
  display: grid;
  gap: 4px;
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
  .ar-hud {
    left: 12px;
    right: 12px;
    top: 12px;
    justify-items: stretch;
    max-width: none;
  }

  .ar-permission-row,
  .ar-metrics {
    justify-content: flex-start;
  }

  .ar-status-pill {
    min-width: 0;
    flex: 1 1 96px;
  }

  .ar-primary-card {
    left: 12px;
    right: 12px;
    width: auto;
    bottom: max(208px, 30vh);
  }

  .ar-error-banner {
    left: 12px;
    right: 12px;
  }
}
</style>
