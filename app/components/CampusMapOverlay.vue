<script setup lang="ts">
import type { CampusArPosition } from '~/composables/useCampusAr'

const props = defineProps<{
  position: CampusArPosition
}>()

const emit = defineEmits<{
  close: []
}>()

const mapUrl = computed(() => {
  const latitudeHalfSpan = 0.0025
  const longitudeHalfSpan =
    latitudeHalfSpan / Math.max(Math.cos((props.position.latitude * Math.PI) / 180), 0.2)
  const west = props.position.longitude - longitudeHalfSpan
  const south = props.position.latitude - latitudeHalfSpan
  const east = props.position.longitude + longitudeHalfSpan
  const north = props.position.latitude + latitudeHalfSpan
  const query = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    layer: 'mapnik',
    marker: `${props.position.latitude},${props.position.longitude}`
  })

  return `https://www.openstreetmap.org/export/embed.html?${query.toString()}`
})

const accuracyLabel = computed(() => {
  if (props.position.accuracyMeters === null) {
    return 'GPS position'
  }

  return `GPS accuracy: ${Math.round(props.position.accuracyMeters)} m`
})
</script>

<template>
  <section aria-label="OpenStreetMap location view" class="campus-map-overlay">
    <iframe
      :src="mapUrl"
      allowfullscreen
      class="campus-map-frame"
      loading="eager"
      referrerpolicy="strict-origin-when-cross-origin"
      title="Your current position on OpenStreetMap"
    ></iframe>

    <div class="campus-map-toolbar">
      <button class="campus-map-back" type="button" @click="emit('close')">
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>Back to AR Mode</span>
      </button>

      <div class="campus-map-position">
        <strong>Your position</strong>
        <span>{{ accuracyLabel }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.campus-map-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  background: #dbe7ef;
}

.campus-map-frame {
  width: 100%;
  height: 100%;
  border: 0;
}

.campus-map-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: calc(14px + env(safe-area-inset-top)) 16px 14px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.62), transparent);
}

.campus-map-back,
.campus-map-position {
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 999px;
  color: #102c53;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2);
  backdrop-filter: blur(16px);
  pointer-events: auto;
}

.campus-map-back {
  min-height: 48px;
  padding: 0 18px 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: 0.94rem;
  font-weight: 800;
  cursor: pointer;
}

.campus-map-back svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.campus-map-position {
  display: grid;
  gap: 2px;
  padding: 8px 14px;
  text-align: right;
}

.campus-map-position strong {
  font-size: 0.88rem;
}

.campus-map-position span {
  color: #475569;
  font-size: 0.72rem;
}

@media (max-width: 640px) {
  .campus-map-toolbar {
    align-items: flex-start;
    padding-right: 12px;
    padding-left: 12px;
  }

  .campus-map-back {
    min-height: 46px;
    padding-right: 14px;
    padding-left: 10px;
    font-size: 0.86rem;
  }

  .campus-map-position {
    padding: 7px 11px;
  }
}
</style>
