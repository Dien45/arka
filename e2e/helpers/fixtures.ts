/**
 * Playwright fixtures for the Arka Android native E2E suite.
 *
 * `device` is worker-scoped (one physical device shared by the single worker).
 * Each test starts from a clean app state and always produces artifacts.
 */

import { test as base, expect, type TestInfo } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AndroidDevice, sleep } from './device'

export const ARTIFACTS_ROOT = resolve(__dirname, '..', 'artifacts')
export const SCREENSHOTS_DIR = join(ARTIFACTS_ROOT, 'screenshots')
export const VIDEOS_DIR = join(ARTIFACTS_ROOT, 'videos')
export const DUMP_DIR = join(ARTIFACTS_ROOT, 'failures')

const VIDEO = process.env.E2E_VIDEO !== '0'

export function sanitize(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

type Fixtures = {
  device: AndroidDevice
}

type WorkerFixtures = {
  deviceWorker: AndroidDevice
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  deviceWorker: [
    async ({}, use) => {
      const device = new AndroidDevice(process.env.ANDROID_SERIAL)
      const info = device.info()
      // eslint-disable-next-line no-console
      console.log(
        `\n[device] ${info.model} · Android ${info.android} · ${info.width}x${info.height} · ${info.serial}\n`,
      )
      if (!device.isInstalled()) {
        throw new Error(
          `App ${'com.arka.app'} is not installed on ${info.serial}. Run \`npm run install-app\` first.`,
        )
      }
      await use(device)
    },
    { scope: 'worker' },
  ],

  device: async ({ deviceWorker }, use, testInfo) => {
    const device = deviceWorker
    const name = sanitize(testInfo.title)

    mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    if (VIDEO) mkdirSync(VIDEOS_DIR, { recursive: true })

    // --- Arrange: deterministic, isolated start state -------------------
    device.unlock()
    device.forceStop()
    device.clearData()
    if (VIDEO) device.startRecording(name)
    device.launch()
    // App readiness anchor: bottom navigation "Chat" exists in both languages.
    await device.waitForText('Chat', { timeout: 30_000, message: 'App did not reach the Chat screen' })
    // Allow first-run initialisation to settle.
    await sleep(600)

    await use(device)

    // --- Teardown / artifacts -------------------------------------------
    const failed = testInfo.status !== testInfo.expectedStatus
    const suffix = failed ? '-FAILED' : ''
    try {
      const shot = device.screenshot(join(SCREENSHOTS_DIR, `${name}${suffix}.png`))
      await testInfo.attach(failed ? 'screenshot (failed)' : 'screenshot', {
        path: shot,
        contentType: 'image/png',
      })
    } catch {
      /* screencap can fail transiently */
    }

    if (VIDEO) {
      const video = device.stopRecording(join(VIDEOS_DIR, `${name}${suffix}.mp4`))
      if (video && failed) {
        await testInfo.attach('video', { path: video, contentType: 'video/mp4' })
      } else if (video && !failed) {
        // Keep passing runs' artifacts small: discard video when green.
        device.deleteFile(video)
      }
    }

    if (failed) {
      try {
        const root = await device.dump()
        const xmlPath = join(DUMP_DIR, `${name}.xml`)
        mkdirSync(DUMP_DIR, { recursive: true })
        writeFileSync(xmlPath, JSON.stringify(root, null, 2), 'utf8')
        await testInfo.attach('ui-tree (json)', { path: xmlPath, contentType: 'application/json' })
      } catch {
        /* best effort */
      }
    }
  },
})

export { expect }

/** Assert a text node is visible on screen. */
export async function expectTextVisible(device: AndroidDevice, text: string, timeout = 15_000): Promise<void> {
  const node = await device.waitForText(text, { timeout })
  expect(node, `text "${text}" should be visible`).toBeTruthy()
}

/** Assert a text node containing the given substring is visible. */
export async function expectContains(
  device: AndroidDevice,
  text: string,
  timeout = 15_000,
): Promise<void> {
  const node = await device.waitForTextContains(text, { timeout })
  expect(node, `text containing "${text}" should be visible`).toBeTruthy()
}

/** Assert a content-desc node is visible. */
export async function expectDescVisible(device: AndroidDevice, desc: string, timeout = 15_000): Promise<void> {
  const node = await device.waitForDesc(desc, { timeout })
  expect(node, `content-desc "${desc}" should be visible`).toBeTruthy()
}

export async function attachText(info: TestInfo, name: string, body: string): Promise<void> {
  await info.attach(name, { body, contentType: 'text/plain' })
}
