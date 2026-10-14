/**
 * Journey helpers shared by the specs.
 *
 * The navigation drawer is a Material3 `ModalNavigationDrawer`. Its scrim
 * carries the semantics `Tutup menu navigasi` (Indonesian default locale) and
 * is the reliable way to dismiss the drawer — `KEYCODE_BACK` is NOT handled by
 * the drawer in this build, so it exits the app instead of closing it.
 */
import { sleep, type AndroidDevice } from './device'

/** Open the drawer, retrying if the first tap does not register. */
export async function openDrawer(device: AndroidDevice): Promise<void> {
  if (await device.hasText('Sesi')) return
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await device.tapDesc('Menu', { timeout: 6_000 })
    } catch {
      /* the Menu button may be hidden behind the drawer — handled by the check below */
    }
    await sleep(500)
    if (await device.hasText('Sesi')) return
  }
  throw new Error('Drawer tidak terbuka setelah beberapa percobaan')
}

/** Dismiss the drawer by tapping the scrim. */
export async function closeDrawer(device: AndroidDevice): Promise<void> {
  try {
    await device.tapDesc('Tutup menu navigasi', { timeout: 6_000 })
  } catch {
    device.back()
  }
  await sleep(300)
}
