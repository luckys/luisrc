import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4399',
    browserName: 'chromium',
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:4399',
    reuseExistingServer: false,
  },
})
