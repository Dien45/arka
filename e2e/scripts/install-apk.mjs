#!/usr/bin/env node
/**
 * Install the freshly built debug APK onto the selected device.
 * Resolves ADB automatically (same logic as helpers/device.ts).
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const CANDIDATES = (() => {
  const list: string[] = []
  if (process.env.ADB_PATH) list.push(process.env.ADB_PATH)
  list.push('adb')
  const local = process.env.LOCALAPPDATA
  if (local) list.push(resolve(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe'))
  for (const key of ['ANDROID_HOME', 'ANDROID_SDK_ROOT']) {
    const sdk = process.env[key]
    if (sdk) list.push(resolve(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'))
  }
  return list
})()

function findAdb(): string {
  for (const c of CANDIDATES) {
    try {
      execFileSync(c, ['version'], { stdio: 'ignore' })
      return c
    } catch {}
  }
  throw new Error('adb not found')
}

const adb = findAdb()
const apk = resolve(process.cwd(), '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
if (!existsSync(apk)) throw new Error(`APK not found at ${apk}`)
console.log(`[install-app] using ${adb}`)
console.log(`[install-app] installing ${apk}`)
execFileSync(adb, ['install', '-r', apk], { stdio: 'inherit' })
console.log('[install-app] done')