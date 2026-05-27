export type CampusBuilding = {
  id: string
  name: string
  latitude: number
  longitude: number
  altitude?: number
  labelAltitude?: number
  alias?: string
  color?: string
}

// Replace these demo anchors with your campus coordinates or populate the
// `campus_buildings` table in Supabase with the same fields.
export const demoCampusBuildings: CampusBuilding[] = [
  {
    id: 'engineering-hall',
    name: 'Engineering Hall',
    latitude: 45.47878,
    longitude: 9.22743,
    altitude: 122,
    labelAltitude: 16,
    color: '#2563eb'
  },
  {
    id: 'central-library',
    name: 'Central Library',
    latitude: 45.47921,
    longitude: 9.22814,
    altitude: 122,
    labelAltitude: 14,
    color: '#0f766e'
  },
  {
    id: 'student-center',
    name: 'Student Center',
    latitude: 45.47831,
    longitude: 9.22867,
    altitude: 122,
    labelAltitude: 12,
    color: '#ea580c'
  }
]
