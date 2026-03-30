<script setup lang="ts">
type ChatMessage = {
  role: 'assistant' | 'user'
  text: string
}

const quickLinks = [
  {
    title: 'Find Classrooms',
    to: '/explore',
    icon: 'spark'
  },
  {
    title: 'Calendar',
    to: '/favorites',
    icon: 'heart'
  },
  {
    title: 'Campus Services',
    to: '/orders',
    icon: 'bag'
  },

] as const

const starterPrompts = [
  'Where is the admissions office?',
  'What are the library opening hours?',
  'How do I reach building C?',
  'Who can help me with campus Wi-Fi?'
] as const

const chatMessages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    text: 'Hello, I am the campus AI assistant. Ask me about buildings, services, opening hours, or support points.'
  }
])

const userPrompt = ref('')

function iconPath(icon: string) {
  switch (icon) {
    case 'spark':
      return 'M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.9L12 3.5Zm6.5 11 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5ZM6.5 16l1.2 2.8 2.8 1.2-2.8 1.2L6.5 24l-1.2-2.8L2.5 20l2.8-1.2L6.5 16Z'
    case 'heart':
      return 'M12 21.35 10.55 20C5.4 15.24 2 12.09 2 8.25 2 5.1 4.42 2.75 7.5 2.75c1.74 0 3.41.81 4.5 2.09 1.09-1.28 2.76-2.09 4.5-2.09 3.08 0 5.5 2.35 5.5 5.5 0 3.84-3.4 6.99-8.55 11.76L12 21.35Z'
    case 'bag':
      return 'M7 7V6a5 5 0 0 1 10 0v1h3v14H4V7h3Zm2 0h6V6a3 3 0 1 0-6 0v1Zm1.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z'
    default:
      return ''
  }
}

function answerCampusQuestion(question: string) {
  const normalized = question.toLowerCase()

  if (normalized.includes('library')) {
    return 'The main library is open from 8:00 to 20:00 on weekdays. During exams, extended evening hours may be available.'
  }

  if (normalized.includes('wifi') || normalized.includes('wi-fi') || normalized.includes('internet')) {
    return 'For campus Wi-Fi support, start from the digital help desk near the main hall or contact IT support through the student portal.'
  }

  if (normalized.includes('admissions') || normalized.includes('office')) {
    return 'Admissions support is usually located in the welcome area near the main entrance. This draft can later connect to live campus data for exact room details.'
  }

  if (normalized.includes('building') || normalized.includes('classroom') || normalized.includes('reach')) {
    return 'You can ask for a building or classroom and the assistant can guide you with directions, nearby landmarks, and accessible routes.'
  }

  return 'This is a first chatbot draft: it can welcome users, answer common campus questions, and later connect to live data, maps, and university services.'
}

function useStarterPrompt(prompt: string) {
  userPrompt.value = prompt
  submitChat()
}

function submitChat() {
  const question = userPrompt.value.trim()

  if (!question) {
    return
  }

  chatMessages.value.push({
    role: 'user',
    text: question
  })

  chatMessages.value.push({
    role: 'assistant',
    text: answerCampusQuestion(question)
  })

  userPrompt.value = ''
}
</script>

<template>
  <main class="home-shell">
    <div class="background-orb orb-left" />
    <div class="background-orb orb-right" />

    <NuxtLink class="login-link" to="/login" aria-label="Open login page">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
        />
      </svg>
    </NuxtLink>

    <section class="home-panel">
      <div class="hero-card">
        <p class="eyebrow">Home</p>
        <h1>Start Guided Tour.</h1>
        <p class="hero-copy">
          You can use AR mode for an immersive experience
        </p>
        <div class="hero-actions">
          <button type="button" class="hero-button">AR Mode</button>
          <button type="button" class="hero-button">Text Mode</button>
        </div>
      </div>

      <h2 class="section-title">Main services</h2>
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

      <section class="chatbot-section" aria-labelledby="campus-ai-title">
        <div class="chatbot-copy">
          <p class="eyebrow">New</p>
          <div class="chatbot-heading">
            <h2 id="campus-ai-title">Campus AI Assistant</h2>
            <span class="chatbot-badge">Draft experience</span>
          </div>
          <p class="chatbot-description">
            A first chatbot concept for asking questions about the campus, services,
            offices, directions, and student support.
          </p>

          <div class="prompt-list" aria-label="Suggested prompts">
            <button
              v-for="prompt in starterPrompts"
              :key="prompt"
              type="button"
              class="prompt-chip"
              @click="useStarterPrompt(prompt)"
            >
              {{ prompt }}
            </button>
          </div>
        </div>

        <div class="chatbot-card">
          <div class="chatbot-window" aria-live="polite">
            <div
              v-for="(message, index) in chatMessages"
              :key="`${message.role}-${index}`"
              class="message-row"
              :class="`message-row--${message.role}`"
            >
              <div class="message-bubble" :class="`message-bubble--${message.role}`">
                {{ message.text }}
              </div>
            </div>
          </div>

          <form class="chatbot-form" @submit.prevent="submitChat">
            <label class="sr-only" for="campus-ai-input">Ask the campus assistant</label>
            <input
              id="campus-ai-input"
              v-model="userPrompt"
              type="text"
              class="chatbot-input"
              placeholder="Ask something about the campus..."
            >
            <button type="submit" class="chatbot-send">Send</button>
          </form>
        </div>
      </section>
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

.login-link {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 2;
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

.hero-actions {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
}

.section-title {
  margin: 28px 0 14px;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 700;
  color: #7c2d12;
  letter-spacing: 0.04em;
}

.quick-nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.chatbot-section {
  margin-top: 30px;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 20px;
  align-items: stretch;
}

.chatbot-copy,
.chatbot-card {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
}

.chatbot-copy {
  padding: 28px;
}

.chatbot-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.chatbot-heading h2 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  color: #7c2d12;
}

.chatbot-badge {
  white-space: nowrap;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 237, 213, 0.95);
  color: #9a3412;
  font-size: 0.82rem;
  font-weight: 700;
}

.chatbot-description {
  margin: 0;
  color: #475569;
  line-height: 1.7;
}

.prompt-list {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.prompt-chip {
  border: 0;
  border-radius: 999px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.95), rgba(254, 215, 170, 0.9));
  color: #9a3412;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.prompt-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 22px rgba(217, 119, 6, 0.18);
}

.chatbot-card {
  padding: 18px;
  display: grid;
  gap: 14px;
  background:
    linear-gradient(180deg, rgba(255, 251, 235, 0.95) 0%, rgba(255, 255, 255, 0.82) 100%);
}

.chatbot-window {
  min-height: 300px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(251, 191, 36, 0.22);
  display: grid;
  gap: 12px;
}

.message-row {
  display: flex;
}

.message-row--assistant {
  justify-content: flex-start;
}

.message-row--user {
  justify-content: flex-end;
}

.message-bubble {
  max-width: min(90%, 380px);
  padding: 14px 16px;
  border-radius: 18px;
  line-height: 1.55;
  font-size: 0.96rem;
}

.message-bubble--assistant {
  background: #fff7ed;
  color: #7c2d12;
  border-top-left-radius: 6px;
}

.message-bubble--user {
  background: linear-gradient(135deg, var(--primary), #f97316);
  color: #fff;
  border-top-right-radius: 6px;
}

.chatbot-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.chatbot-input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 18px;
  padding: 14px 16px;
  font: inherit;
  color: #1f2937;
  background: rgba(255, 255, 255, 0.92);
}

.chatbot-input:focus {
  outline: 2px solid rgba(217, 119, 6, 0.2);
  border-color: rgba(217, 119, 6, 0.45);
}

.chatbot-send {
  border: 0;
  border-radius: 18px;
  padding: 0 20px;
  font: inherit;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #c2410c, #f97316);
  cursor: pointer;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
    padding: 88px 16px 28px;
  }

  .hero-card {
    padding: 26px 20px;
  }

  .hero-actions {
    gap: 14px;
  }

  .quick-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chatbot-section {
    grid-template-columns: 1fr;
  }

  .chatbot-copy,
  .chatbot-card {
    padding-left: 20px;
    padding-right: 20px;
  }

  .chatbot-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .chatbot-form {
    grid-template-columns: 1fr;
  }

  .chatbot-send {
    min-height: 48px;
  }
}
</style>
