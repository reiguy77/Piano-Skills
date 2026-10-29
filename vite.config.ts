import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The recognition benchmark needs downloaded samples and takes a while; run it with `npm run bench`.
  test: { exclude: [...configDefaults.exclude, 'bench/**'] },
  // The Basic Pitch chunk (TensorFlow.js) is ~1 MB but only loads once the microphone is in use.
  build: { chunkSizeWarningLimit: 1100 },
})
