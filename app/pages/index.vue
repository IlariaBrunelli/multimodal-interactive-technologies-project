<script setup lang="ts">
type MenuButton = {
  id: number
  text: string
  link: string
  iconPath: string
  colorExpanded: string
  colorCollapsed: string
}

type ChatMessage = {
  role: 'assistant' | 'user'
  text: string
}

const isExpanded = ref(false)

const buttons = ref<MenuButton[]>([
  {
    id: 1,
    text: 'Profilo',
    link: '/profilo',
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    colorExpanded: 'bg-blue-50 text-blue-600 border-blue-500 hover:bg-blue-100',
    colorCollapsed: 'bg-white text-blue-500 border-blue-400 hover:bg-blue-50'
  },
  {
    id: 2,
    text: 'Report',
    link: '/statistiche',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    colorExpanded: 'bg-emerald-50 text-emerald-600 border-emerald-500 hover:bg-emerald-100',
    colorCollapsed: 'bg-white text-emerald-500 border-emerald-400 hover:bg-emerald-50'
  },
  {
    id: 3,
    text: 'Impostazioni',
    link: '/impostazioni',
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    colorExpanded: 'bg-purple-50 text-purple-600 border-purple-500 hover:bg-purple-100',
    colorCollapsed: 'bg-white text-purple-500 border-purple-400 hover:bg-purple-50'
  }
])

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

function toggleExpand() {
  isExpanded.value = !isExpanded.value

  if (import.meta.client) {
    document.body.style.overflow = isExpanded.value ? 'hidden' : 'auto'
  }
}

function goToPage(button: MenuButton) {
  if (import.meta.client) {
    window.alert(`Navigo a: ${button.link}`)
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

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.body.style.overflow = 'auto'
  }
})
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

      <section class="mt-8">
        <div class="app-container">
          <div
            class="w-full flex items-center justify-center transition-colors duration-[800ms]"
            :class="isExpanded ? 'fixed inset-0 z-40 bg-white' : 'rounded-[2.5rem] bg-gray-50/90 p-4'"
          >
            <div
              class="bg-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.1,0.64,1)] flex flex-col overflow-hidden"
              :class="isExpanded
                ? 'w-[100vw] h-[100vh] p-8 sm:p-12 rounded-none z-50'
                : 'w-full max-w-xs h-60 p-6 rounded-[2rem] shadow-xl border border-gray-100 cursor-pointer hover:shadow-2xl relative'"
              @click="!isExpanded && toggleExpand()"
            >
              <div
                class="flex items-center justify-between transition-all duration-[800ms]"
                :class="isExpanded ? 'mb-16 sm:mb-20' : 'mb-6'"
              >
                <span
                  class="font-black tracking-tight text-gray-900 transition-all duration-[800ms]"
                  :class="isExpanded ? 'text-5xl sm:text-6xl' : 'text-xl'"
                >
                  Main Services
                </span>

                <button
                  type="button"
                  :aria-expanded="isExpanded"
                  :aria-label="isExpanded ? 'Close services menu' : 'Open services menu'"
                  class="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-all duration-[800ms] focus:outline-none z-20 relative"
                  :class="isExpanded ? 'text-gray-400' : 'text-blue-500'"
                  @click.stop="toggleExpand"
                >
                  <div class="relative w-7 h-7">
                    <svg
                      :class="isExpanded ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'"
                      class="absolute inset-0 w-7 h-7 transition-all duration-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                    <svg
                      :class="isExpanded ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'"
                      class="absolute inset-0 w-7 h-7 transition-all duration-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </button>
              </div>

              <div
                class="transition-all duration-[800ms] flex flex-col w-full"
                :class="isExpanded ? 'flex-1 justify-start max-w-3xl mx-auto' : 'justify-start'"
              >
                <div class="relative w-full" :style="{ height: isExpanded ? '190px' : '56px' }">
                  <button
                    v-for="(button, index) in buttons"
                    :key="button.id"
                    type="button"
                    class="absolute transition-all duration-[800ms] flex items-center justify-center overflow-hidden group focus:outline-none border-2"
                    :style="{
                      transitionDelay: isExpanded ? `${index * 120}ms` : `${(2 - index) * 40}ms`,
                      transitionTimingFunction: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
                      top: isExpanded ? (index === 2 ? '104px' : '0px') : '0px',
                      left: isExpanded ? (index === 1 ? 'calc(50% + 10px)' : '0px') : `${index * 68}px`,
                      width: isExpanded ? (index === 2 ? '100%' : 'calc(50% - 10px)') : '56px',
                      height: isExpanded ? '80px' : '56px',
                      borderRadius: isExpanded ? '1.5rem' : '50%'
                    }"
                    :class="isExpanded
                      ? `shadow-lg ${button.colorExpanded}`
                      : `${button.colorCollapsed} shadow-sm`"
                    @click.stop="goToPage(button)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="absolute transition-all duration-[500ms] w-7 h-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2.5"
                      :style="{ transitionDelay: isExpanded ? '0ms' : `${(2 - index) * 40 + 350}ms` }"
                      :class="isExpanded ? 'opacity-0 scale-50' : 'opacity-100 scale-100'"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" :d="button.iconPath" />
                    </svg>

                    <div
                      class="flex items-center space-x-4 transition-all duration-[500ms]"
                      :style="{ transitionDelay: isExpanded ? `${index * 120 + 400}ms` : '0ms' }"
                      :class="isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75'"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-7 h-7 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2.5"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" :d="button.iconPath" />
                      </svg>
                      <span class="font-bold text-xl sm:text-2xl tracking-tight">{{ button.text }}</span>
                    </div>
                  </button>
                </div>
              </div>

              <p
                class="transition-all duration-300 text-sm font-medium text-gray-400 absolute bottom-6 left-6"
                :class="isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-500'"
              >
                Tocca per esplorare
              </p>

              <div
                class="transition-all duration-[800ms] text-center text-gray-300 pb-8"
                :class="isExpanded ? 'opacity-100 delay-[800ms]' : 'opacity-0 absolute bottom-0 pointer-events-none w-full left-0'"
              >
                <p class="uppercase tracking-widest text-xs font-bold">Menu Navigazione</p>
              </div>
            </div>
          </div>
        </div>
      </section>

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
