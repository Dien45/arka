#!/usr/bin/env node
/**
 * Doctor: checks adb, device connection, app state, APK presence.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const apk = resolve(process.cwd(), '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

function run(cmd: string[]): string | null {
  try {
    return execFileSync(cmd[0], cmd.slice(1), { encoding: 'utf8' }).trim()
  } catch (e: any) {
    return e.stdout?.toString() ?? e.stderr?.toString() ?? null
  }
}

const findAdb = run(['which', 'adb']) || run(['adb', 'version']) && 'adb'
const adbPath = process.env.ADB_PATH || findAdb || (process.env.LOCALAPPDATA && require('path').join(require('path').win32.resolve(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools'),'adb.exe')) || 'adb'
console.log('adbPath', adbPath)
console.log('devices', run([adbPath,'devices']))
console.log('appInstalled?', existsSync(apk), apk)
console.log('focus', run([adbPath,'shell','dumpsys window | grep mCurrentFocus']))