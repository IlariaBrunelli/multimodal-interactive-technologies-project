export type ChatLocationCoordinates = {
  latitude: number | null
  longitude: number | null
}

const emptyChatLocation: ChatLocationCoordinates = {
  latitude: null,
  longitude: null
}

export function getChatLocationCoordinates() {
  if (!import.meta.client || !navigator.geolocation) {
    return Promise.resolve(emptyChatLocation)
  }

  return new Promise<ChatLocationCoordinates>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      },
      () => {
        resolve(emptyChatLocation)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 8000
      }
    )
  })
}
