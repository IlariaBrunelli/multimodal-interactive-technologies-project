<script setup lang="ts">
const services = [
  {
    name: 'Microwaves',
    description: 'Find the nearest microwave to heat up your food.',
    to: '/microwaves'
  },
  {
    name: 'Food & Drinks',
    description: 'Discover restaurants, bars, and cafes near you.',
    to: '/food'
  },
  {
    name: 'Fountains',
    description: 'Locate the closest water fountain to stay hydrated.',
    to: '/fountains'
  },
  {
    name: 'Plugs',
    description: 'Find a plug to charge your devices.',
    to: '/plugs'
  }
]
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

        <div class="mt-4">
          <h1 class="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Explore</h1>
          <p class="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            Discover the services available on campus.
          </p>
        </div>
      </header>

      <section class="mt-6 grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="service in services"
          :key="service.name"
          :to="service.to"
          class="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <h2 class="text-lg font-semibold text-slate-950">{{ service.name }}</h2>
          <p class="mt-1 text-sm text-slate-600">{{ service.description }}</p>
        </NuxtLink>
      </section>
    </section>
  </main>
</template>
