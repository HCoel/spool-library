import filament from './filament/index.js'

export const LIBRARIES = [filament]

export function getLibrary(id) {
  return LIBRARIES.find(l => l.id === id)
}
