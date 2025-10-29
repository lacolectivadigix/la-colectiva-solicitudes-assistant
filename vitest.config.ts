import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['la-colectiva-solicitudes-assistant/**', 'node_modules/**']
  }
})