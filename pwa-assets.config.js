import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Full-bleed slate background: iOS and Android round the corners themselves
const background = '#1d2024'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0, resizeOptions: { background } },
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
