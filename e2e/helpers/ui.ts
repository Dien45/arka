/**
 * Minimal uiautomator XML parser + query helpers.
 *
 * The Android app is a native Jetpack Compose app, so Playwright's browser
 * engine cannot drive it directly. Instead we read the device accessibility
 * tree (`adb shell uiautomator dump`) and turn it into a queryable tree.
 *
 * Compose exposes `text` and `content-desc` for every semantics node, and the
 * clickable node is usually an *ancestor* of the text node — so query helpers
 * can resolve the nearest clickable ancestor for taps.
 */

export interface Bounds {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface UiNode {
  index: number
  text: string
  desc: string
  id: string
  cls: string
  pkg: string
  clickable: boolean
  longClickable: boolean
  scrollable: boolean
  enabled: boolean
  selected: boolean
  checked: boolean
  focused: boolean
  password: boolean
  bounds: Bounds
  parent: UiNode | null
  children: UiNode[]
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
}

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16))
    }
    if (code.startsWith('#')) {
      return String.fromCodePoint(parseInt(code.slice(1), 10))
    }
    return ENTITIES[code] ?? match
  })
}

function parseBounds(raw: string): Bounds {
  const m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(raw)
  if (!m) return { x1: 0, y1: 0, x2: 0, y2: 0 }
  return { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] }
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([a-zA-Z0-9_:-]+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) out[m[1]] = decodeEntities(m[2])
  return out
}

function makeNode(attrs: Record<string, string>): UiNode {
  return {
    index: Number(attrs.index ?? 0),
    text: attrs.text ?? '',
    desc: attrs['content-desc'] ?? '',
    id: attrs['resource-id'] ?? '',
    cls: attrs.class ?? '',
    pkg: attrs.package ?? '',
    clickable: attrs.clickable === 'true',
    longClickable: attrs['long-clickable'] === 'true',
    scrollable: attrs.scrollable === 'true',
    enabled: attrs.enabled !== 'false',
    selected: attrs.selected === 'true',
    checked: attrs.checked === 'true',
    focused: attrs.focused === 'true',
    password: attrs.password === 'true',
    bounds: parseBounds(attrs.bounds ?? ''),
    parent: null,
    children: [],
  }
}

/** Parse the `<hierarchy>` XML returned by `uiautomator dump`. */
export function parseUi(xml: string): UiNode {
  const root = makeNode({ class: 'root', bounds: '[0,0][0,0]' })
  const stack: UiNode[] = [root]
  const tagRe = /<(\/?)(node|hierarchy)\b([^>]*?)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(xml)) !== null) {
    const closing = m[1] === '/'
    const tag = m[2]
    const selfClosing = m[4] === '/'
    const attrs = m[3] ?? ''

    if (closing) {
      if (stack.length > 1) stack.pop()
      continue
    }
    if (tag === 'hierarchy') {
      // Attributes of <hierarchy> define the virtual root.
      const h = parseAttrs(attrs)
      if (h.bounds) root.bounds = parseBounds(h.bounds)
      continue
    }
    const node = makeNode(parseAttrs(attrs))
    const parent = stack[stack.length - 1]
    node.parent = parent
    parent.children.push(node)
    if (!selfClosing) stack.push(node)
  }
  return root
}

export function isVisible(node: UiNode, screenHeight = 2400): boolean {
  const { y1, y2, x1, x2 } = node.bounds
  return x2 > x1 && y2 > y1 && y1 < screenHeight && y2 > 0 && x2 > 0
}

export function center(node: UiNode): { x: number; y: number } {
  return {
    x: Math.round((node.bounds.x1 + node.bounds.x2) / 2),
    y: Math.round((node.bounds.y1 + node.bounds.y2) / 2),
  }
}

export function clickableAncestor(node: UiNode): UiNode | null {
  let cur: UiNode | null = node
  while (cur) {
    if (cur.clickable) return cur
    cur = cur.parent
  }
  return null
}

export function flatten(root: UiNode): UiNode[] {
  const out: UiNode[] = []
  const walk = (n: UiNode) => {
    for (const c of n.children) {
      out.push(c)
      walk(c)
    }
  }
  walk(root)
  return out
}

export function findAll(root: UiNode, pred: (n: UiNode) => boolean): UiNode[] {
  return flatten(root).filter(pred)
}

export function hasTextValue(n: UiNode): boolean {
  return n.text.length > 0 || n.desc.length > 0
}

export function byText(root: UiNode, text: string): UiNode[] {
  return findAll(root, (n) => n.text === text)
}

export function byTextContains(root: UiNode, text: string): UiNode[] {
  const needle = text.toLowerCase()
  return findAll(root, (n) => n.text.toLowerCase().includes(needle))
}

export function byDesc(root: UiNode, desc: string): UiNode[] {
  return findAll(root, (n) => n.desc === desc)
}

export function byDescContains(root: UiNode, desc: string): UiNode[] {
  const needle = desc.toLowerCase()
  return findAll(root, (n) => n.desc.toLowerCase().includes(needle))
}

/** Prefer the deepest node, and when several match, prefer a clickable/visible one. */
export function pickBest(nodes: UiNode[], screenHeight = 2400): UiNode | null {
  const candidates = nodes.filter((n) => isVisible(n, screenHeight))
  const pool = candidates.length ? candidates : nodes
  if (!pool.length) return null
  const clickable = pool.filter((n) => n.clickable)
  const chosen = clickable.length ? clickable : pool
  // Deepest node = most specific match.
  return chosen.reduce((best, n) => (depth(n) > depth(best) ? n : best))
}

function depth(n: UiNode): number {
  let d = 0
  let cur: UiNode | null = n
  while (cur) {
    d++
    cur = cur.parent
  }
  return d
}
