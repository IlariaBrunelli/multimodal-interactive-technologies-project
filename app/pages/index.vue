<script setup lang="ts">
const quickLinks = [
  {
    title: 'Explore',
    to: '/explore',
    icon: 'spark'
  },
  {
    title: 'Favorites',
    to: '/favorites',
    icon: 'heart'
  },
  {
    title: 'Orders',
    to: '/orders',
    icon: 'bag'
  },
  {
    title: 'Support',
    to: '/support',
    icon: 'chat'
  }
] as const

function iconPath(icon: string) {
  switch (icon) {
    case 'spark':
      return 'M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.9L12 3.5Zm6.5 11 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5ZM6.5 16l1.2 2.8 2.8 1.2-2.8 1.2L6.5 24l-1.2-2.8L2.5 20l2.8-1.2L6.5 16Z'
    case 'heart':
      return 'M12 21.35 10.55 20C5.4 15.24 2 12.09 2 8.25 2 5.1 4.42 2.75 7.5 2.75c1.74 0 3.41.81 4.5 2.09 1.09-1.28 2.76-2.09 4.5-2.09 3.08 0 5.5 2.35 5.5 5.5 0 3.84-3.4 6.99-8.55 11.76L12 21.35Z'
    case 'bag':
      return 'M7 7V6a5 5 0 0 1 10 0v1h3v14H4V7h3Zm2 0h6V6a3 3 0 1 0-6 0v1Zm1.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z'
    case 'chat':
      return 'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5h10v2H7V9Zm0 4h7v2H7v-2Z'
    default:
      return ''
  }
}
</script>

<template>
  <main class="home-shell">
    <div class="background-orb orb-left" />
    <div class="background-orb orb-right" />

    <section class="home-panel">
      <div class="top-bar">
        <div class="top-spacer" />
        <NuxtLink class="login-link" to="/login" aria-label="Open login page">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
            />
          </svg>
        </NuxtLink>
      </div>

      <div class="hero-card">
        <p class="eyebrow">Home</p>
        <h1>Start Guided Tour.</h1>
        <p class="hero-copy">
          This top container is ready for your primary action, with navigation shortcuts placed directly below it.
        </p>
        <button type="button" class="hero-button">Main Button</button>
      </div>

      <nav class="quick-nav" aria-label="Quick navigation">
        <NuxtLink
          v-for="link in quickLinks"
          :key="link.to"
          :to="link.to"
          class="nav-tile"
        >
          <span class="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path :d="iconPath(link.icon)" />
            </svg>
          </span>
          <span>{{ link.title }}</span>
        </NuxtLink>
      </nav>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(255, 200, 87, 0.24), transparent 30%),
    linear-gradient(180deg, #fff8ef 0%, #f4efe8 100%);
  color: #1f2937;
}

:global(a) {
  color: inherit;
  text-decoration: none;
}

.home-shell {
  --panel-bg: rgba(255, 255, 255, 0.78);
  --panel-border: rgba(148, 163, 184, 0.22);
  --primary: #d97706;
  --primary-dark: #9a3412;
  --shadow: 0 28px 60px rgba(120, 53, 15, 0.16);
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 32px 20px;
}

.background-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(8px);
  opacity: 0.8;
}

.orb-left {
  width: 240px;
  height: 240px;
  background: rgba(251, 191, 36, 0.22);
  top: 5%;
  left: -80px;
}

.orb-right {
  width: 320px;
  height: 320px;
  background: rgba(249, 115, 22, 0.14);
  bottom: -120px;
  right: -80px;
}

.home-panel {
  width: min(760px, 100%);
  position: relative;
  z-index: 1;
}

.top-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  margin-bottom: 18px;
}

.login-link {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.login-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
}

.login-link svg {
  width: 24px;
  height: 24px;
  fill: var(--primary-dark);
}

.hero-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 28px;
  padding: 34px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  text-align: center;
}

.eyebrow {
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: #b45309;
}

.hero-card h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.3rem);
  line-height: 1.05;
}

.hero-copy {
  max-width: 520px;
  margin: 14px auto 26px;
  font-size: 1rem;
  line-height: 1.65;
  color: #475569;
}

.hero-button {
  border: 0;
  border-radius: 999px;
  padding: 14px 28px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), #f97316);
  box-shadow: 0 16px 28px rgba(217, 119, 6, 0.28);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hero-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(217, 119, 6, 0.35);
}

.quick-nav {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.nav-tile {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 22px;
  padding: 18px 14px;
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.nav-tile:hover {
  transform: translateY(-3px);
  border-color: rgba(217, 119, 6, 0.34);
  box-shadow: 0 18px 30px rgba(217, 119, 6, 0.14);
}

.nav-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: rgba(255, 237, 213, 0.9);
}

.nav-icon svg {
  width: 22px;
  height: 22px;
  fill: var(--primary-dark);
}

@media (max-width: 640px) {
  .home-shell {
    padding: 20px 16px 28px;
  }

  .hero-card {
    padding: 26px 20px;
  }

  .quick-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
