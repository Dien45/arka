/**
 * AndroidDevice — thin, dependency-free wrapper around `adb` that gives the
 * Playwright test runner a first-class device object:
 *
 *   - lifecycle: launch / force-stop / clear-data
 *   - observation: uiautomator dump -> queryable tree, screenshots
 *   - interaction: tap (by text / content-desc), type, swipe, scroll-to
 *   - artifacts: screenshots + screenrecord videos
 *
 * Resolution order for the adb binary:
 *   1. ADB_PATH env var
 *   2. `adb` on PATH
 *   3. %LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe (Windows default)
 *   4. $ANDROID_HOME / $ANDROID_SDK_ROOT platform-tools
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  byDesc,
  byDescContains,
  byText,
  byTextContains,
  center,
  clickableAncestor,
  isVisible,
  parseUi,
  pickBest,
  type Bounds,
  type UiNode,
} from './ui'

const APP_ID = 'com.arka.app'
export const APP_ACTIVITY = 'com.arka.app/.MainActivity'

function candidates(): string[] {
  const list: string[] = []
  if (process.env.ADB_PATH) list.push(process.env.ADB_PATH)
  list.push('adb')
  const local = process.env.LOCALAPPDATA
  if (local) list.push(join(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe'))
  for (const key of ['ANDROID_HOME', 'ANDROID_SDK_ROOT']) {
    const sdk = process.env[key]
    if (sdk) list.push(join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'))
  }
  return list
}

let cachedAdb: string | null = null

export function adbBinary(): string {
  if (cachedAdb) return cachedAdb
  for (const candidate of candidates()) {
    try {
      execFileSync(candidate, ['version'], { stdio: 'ignore' })
      cachedAdb = candidate
      return cachedAdb
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'adb not found. Set ADB_PATH or install Android platform-tools (adb must be on PATH).',
  )
}

export interface DeviceInfo {
  serial: string
  model: string
  android: string
  width: number
  height: number
}

export interface WaitOptions {
  timeout?: number
  interval?: number
  message?: string
}

export class AndroidDevice {
  readonly adb: string
  readonly serial?: string
  private screen = { width: 1080, height: 2400 }
  private recording = false
  private recordingPath = '/data/local/tmp/arka-e2e.mp4'

  constructor(serial?: string) {
    this.adb = adbBinary()
    this.serial = serial
  }

  // ------------------------------------------------------------ raw adb

  private base(extra: string[]): string[] {
    return this.serial ? ['-s', this.serial, ...extra] : extra
  }

  /** Run adb capturing stdout as a Buffer (binary safe). */
  raw(extra: string[], timeout = 60_000): Buffer {
    return execFileSync(this.adb, this.base(extra), {
      maxBuffer: 64 * 1024 * 1024,
      timeout,
    })
  }

  /** Run adb capturing stdout as UTF-8 text. */
  rawText(extra: string[], timeout = 60_000): string {
    return this.raw(extra, timeout).toString('utf8')
  }

  /** Run a command inside the device shell. Single string = one shell command. */
  shell(command: string, timeout = 60_000): string {
    return this.rawText(['shell', command], timeout)
  }

  // ------------------------------------------------------------ lifecycle

  info(): DeviceInfo {
    const serial = this.serial ?? this.rawText(['get-serialno']).trim()
    const model = this.shell('getprop ro.product.model').trim()
    const android = this.shell('getprop ro.build.version.release').trim()
    const size = /Physical size:\s*(\d+)x(\d+)/.exec(this.shell('wm size'))
    if (size) {
      this.screen = { width: +size[1], height: +size[2] }
    }
    return { serial, model, android, ...this.screen }
  }

  screenSize(): { width: number; height: number } {
    return this.screen
  }

  isInstalled(): boolean {
    try {
      return this.shell(`pm path ${APP_ID}`).includes('package:')
    } catch {
      return false
    }
  }

  clearData(): void {
    this.shell(`pm clear ${APP_ID}`)
  }

  forceStop(): void {
    this.shell(`am force-stop ${APP_ID}`)
  }

  installApk(apkPath: string): void {
    const abs = resolve(apkPath)
    if (!existsSync(abs)) throw new Error(`APK not found: ${abs}`)
    this.raw(['install', '-r', abs], 240_000)
  }

  launch(): void {
    this.shell(`am start -W -n ${APP_ACTIVITY}`)
  }

  currentFocus(): string {
    return this.shell('dumpsys window | grep -E "mCurrentFocus|mFocusedApp"')
  }

  isAppForeground(): boolean {
    try {
      return this.currentFocus().includes(APP_ID)
    } catch {
      return false
    }
  }

  screenAwake(): boolean {
    return /mWakefulness=Awake/.test(this.shell('dumpsys power | grep mWakefulness'))
  }

  wake(): void {
    if (!this.screenAwake()) {
      this.shell('input keyevent KEYCODE_WAKEUP')
    }
  }

  /** Wake + dismiss a keyguard if it is a simple swipe (no secure PIN/pattern). */
  unlock(): void {
    this.wake()
    const showing = this.shell('dumpsys window | grep -E "mDreamingLockscreen|isStatusBarKeyguard"')
    if (showing.trim().length > 0) {
      this.shell(`input swipe ${Math.round(this.screen.width / 2)} ${Math.round(this.screen.height * 0.8)} ${Math.round(this.screen.width / 2)} ${Math.round(this.screen.height * 0.2)}`)
    }
  }

  // ------------------------------------------------------------ observation

  async dump(retries = 3): Promise<UiNode> {
    let lastError: unknown
    for (let i = 0; i < retries; i++) {
      try {
        let xml = this.rawText(['exec-out', 'uiautomator', 'dump', '/dev/tty'], 30_000)
        const start = xml.indexOf('<hierarchy')
        if (start === -1) throw new Error('uiautomator dump returned no <hierarchy>')
        xml = xml.slice(start)
        const root = parseUi(xml)
        if (root.children.length === 0) throw new Error('uiautomator dump produced an empty tree')
        return root
      } catch (e) {
        lastError = e
        await sleep(600)
      }
    }
    throw new Error(`uiautomator dump failed after ${retries} attempts: ${String(lastError)}`)
  }

  /** Poll the UI tree until `pred` finds a node. */
  async waitFor(
    pred: (root: UiNode, device: AndroidDevice) => UiNode | null | undefined,
    opts: WaitOptions = {},
  ): Promise<UiNode> {
    const timeout = opts.timeout ?? 15_000
    const interval = opts.interval ?? 700
    const deadline = Date.now() + timeout
    let last: UiNode | undefined
    for (;;) {
      try {
        const root = await this.dump()
        last = root
        const node = pred(root, this)
        if (node) return node
      } catch {
        /* transient dump failure — keep polling */
      }
      if (Date.now() > deadline) {
        throw new Error(opts.message ?? `Timed out after ${timeout}ms waiting for UI condition`)
      }
      await sleep(interval)
    }
  }

  async waitForText(text: string, opts: WaitOptions = {}): Promise<UiNode> {
    return this.waitFor((root) => pickBest(byText(root, text), this.screen.height), {
      message: `Timed out waiting for text "${text}"`,
      ...opts,
    })
  }

  async waitForTextContains(text: string, opts: WaitOptions = {}): Promise<UiNode> {
    return this.waitFor((root) => pickBest(byTextContains(root, text), this.screen.height), {
      message: `Timed out waiting for text containing "${text}"`,
      ...opts,
    })
  }

  async waitForDesc(desc: string, opts: WaitOptions = {}): Promise<UiNode> {
    return this.waitFor((root) => pickBest(byDesc(root, desc), this.screen.height), {
      message: `Timed out waiting for content-desc "${desc}"`,
      ...opts,
    })
  }

  async hasText(text: string): Promise<boolean> {
    const root = await this.dump()
    return pickBest(byText(root, text), this.screen.height) !== null
  }

  async hasDesc(desc: string): Promise<boolean> {
    const root = await this.dump()
    return pickBest(byDesc(root, desc), this.screen.height) !== null
  }

  async textOfAll(): Promise<string[]> {
    const root = await this.dump()
    const out: string[] = []
    const walk = (n: UiNode) => {
      if (n.text) out.push(n.text)
      n.children.forEach(walk)
    }
    root.children.forEach(walk)
    return out
  }

  // ------------------------------------------------------------ interaction

  tapAt(x: number, y: number): void {
    const cx = Math.min(Math.max(x, 1), this.screen.width - 1)
    const cy = Math.min(Math.max(y, 1), this.screen.height - 1)
    this.shell(`input tap ${cx} ${cy}`)
  }

  /** Tap a node (resolving the nearest clickable ancestor), retrying while UI settles. */
  async tapNode(node: UiNode): Promise<void> {
    const target = clickableAncestor(node) ?? node
    const { x, y } = center(target)
    this.tapAt(x, y)
    await sleep(500)
  }

  async tapText(text: string, opts: WaitOptions = {}): Promise<void> {
    const node = await this.waitForText(text, opts)
    await this.tapNode(node)
  }

  async tapTextContains(text: string, opts: WaitOptions = {}): Promise<void> {
    const node = await this.waitForTextContains(text, opts)
    await this.tapNode(node)
  }

  async tapDesc(desc: string, opts: WaitOptions = {}): Promise<void> {
    const node = await this.waitForDesc(desc, opts)
    await this.tapNode(node)
  }

  /** Tap the first match of a content-desc substring (icons have dynamic labels). */
  async tapDescContains(desc: string, opts: WaitOptions = {}): Promise<void> {
    const node = await this.waitFor(
      (root) => pickBest(byDescContains(root, desc), this.screen.height),
      { message: `Timed out waiting for content-desc containing "${desc}"`, ...opts },
    )
    await this.tapNode(node)
  }

  /** Type into the focused field. ASCII only; spaces become %s for `input text`. */
  typeText(text: string): void {
    const escaped = text.replace(/'/g, '').replace(/ /g, '%s')
    this.shell(`input text '${escaped}'`)
    this.hideKeyboard()
  }

  async focusAndType(hintText: string, value: string, opts: WaitOptions = {}): Promise<void> {
    await this.tapText(hintText, opts)
    await sleep(700)
    this.typeText(value)
  }

  hideKeyboard(): void {
    try {
      this.shell('input keyevent KEYCODE_ESCAPE')
    } catch {
      /* noop */
    }
  }

  back(): void {
    this.shell('input keyevent KEYCODE_BACK')
  }

  home(): void {
    this.shell('input keyevent KEYCODE_HOME')
  }

  swipe(from: { x: number; y: number }, to: { x: number; y: number }, durationMs = 300): void {
    this.shell(`input swipe ${from.x} ${from.y} ${to.x} ${to.y} ${durationMs}`)
  }

  scrollDown(): void {
    const { width, height } = this.screen
    this.swipe(
      { x: Math.round(width / 2), y: Math.round(height * 0.75) },
      { x: Math.round(width / 2), y: Math.round(height * 0.3) },
    )
  }

  scrollUp(): void {
    const { width, height } = this.screen
    this.swipe(
      { x: Math.round(width / 2), y: Math.round(height * 0.3) },
      { x: Math.round(width / 2), y: Math.round(height * 0.75) },
    )
  }

  /** Scroll until the given text appears (up to `maxSwipes`). */
  async scrollToText(text: string, maxSwipes = 6): Promise<UiNode | null> {
    for (let i = 0; i <= maxSwipes; i++) {
      const root = await this.dump()
      const node = pickBest(byText(root, text), this.screen.height)
      if (node) return node
      this.scrollDown()
      await sleep(500)
    }
    return null
  }

  // ------------------------------------------------------------ artifacts

  screenshot(path: string): string {
    const abs = resolve(path)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, this.raw(['exec-out', 'screencap', '-p'], 30_000))
    return abs
  }

  startRecording(name: string): void {
    this.recordingPath = `/data/local/tmp/arka-e2e-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`
    try {
      this.shell(`rm -f ${this.recordingPath}`)
      // Background the recorder so the adb shell call returns immediately.
      this.shell(
        `screenrecord --size ${Math.min(this.screen.width, 720)}x${Math.round((this.screen.height / this.screen.width) * Math.min(this.screen.width, 720))} --bit-rate 2000000 --time-limit 120 ${this.recordingPath} >/dev/null 2>&1 &`,
      )
      this.recording = true
    } catch {
      this.recording = false
    }
  }

  stopRecording(destination: string): string | null {
    if (!this.recording) return null
    this.recording = false
    try {
      this.shell('pkill -INT screenrecord')
    } catch {
      /* noop */
    }
    try {
      const abs = resolve(destination)
      mkdirSync(dirname(abs), { recursive: true })
      this.raw(['pull', this.recordingPath, abs], 60_000)
      if (existsSync(abs)) return abs
      // `adb pull <remote> <local>` to a non-existent dir keeps the remote name.
      const fallback = join(dirname(abs), this.recordingPath.split('/').pop() as string)
      if (existsSync(fallback)) {
        return fallback
      }
      return null
    } catch {
      return null
    } finally {
      try {
        this.shell(`rm -f ${this.recordingPath}`)
      } catch {
        /* noop */
      }
    }
  }

  deleteFile(path: string): void {
    try {
      rmSync(path, { force: true })
    } catch {
      /* noop */
    }
  }

  pressKey(keycode: string): void {
    this.shell(`input keyevent ${keycode}`)
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function runAdbQuick(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(adbBinary(), args, { encoding: 'utf8' })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}
