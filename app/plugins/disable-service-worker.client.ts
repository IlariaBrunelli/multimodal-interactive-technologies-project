export default defineNuxtPlugin(async () => {
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    return
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const hadRegistrations = registrations.length > 0

    if (hadRegistrations) {
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }

    const cacheKeys = await caches.keys()

    if (cacheKeys.length > 0) {
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
    }

    if (hadRegistrations && !sessionStorage.getItem('sw-cleared-reload')) {
      sessionStorage.setItem('sw-cleared-reload', 'true')
      window.location.reload()
    }
  } catch (error) {
    console.warn('Unable to clear previous service workers or caches.', error)
  }
})
