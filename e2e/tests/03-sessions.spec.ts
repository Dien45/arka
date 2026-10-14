/**
 * TC-05..07 — Session management via the drawer: create, rename, delete.
 *
 * The "New Session" action button and the session row title are both rendered
 * as "Sesi Baru" in the default (Indonesian) locale; that is fine because the
 * empty state only exposes the button.
 */
import { test, expectTextVisible, expectDescVisible } from '../helpers/fixtures'
import { flatten, type UiNode } from '../helpers/ui'
import type { AndroidDevice } from '../helpers/device'
import { openDrawer, closeDrawer } from '../helpers/journey'

function editTextOf(root: UiNode): UiNode | null {
  return flatten(root).find((n) => n.cls.includes('EditText')) ?? null
}

async function createSession(device: AndroidDevice): Promise<void> {
  await openDrawer(device)
  await device.tapText('Sesi Baru')
  await expectTextVisible(device, 'Tanyakan sesuatu tentang kode...')
}

test.describe('Fitur: Manajemen sesi (drawer)', () => {
  test('TC-05 membuat sesi baru dari drawer', async ({ device }) => {
    await createSession(device)

    // Sesi baru muncul di drawer beserta penghitung pesannya.
    await openDrawer(device)
    await expectTextVisible(device, '0 msg')
    await expectDescVisible(device, 'Rename')
    await expectDescVisible(device, 'Delete')

    await closeDrawer(device)
  })

  test('TC-06 mengganti nama sesi', async ({ device }) => {
    await createSession(device)

    await openDrawer(device)
    await device.tapDesc('Rename')

    // Judul dialog (hardcoded "Rename").
    await expectTextVisible(device, 'Rename')

    const field = await device.waitFor((root) => editTextOf(root), {
      message: 'Field rename tidak muncul',
    })
    await device.tapNode(field)
    await device.pressKey('KEYCODE_MOVE_END')
    for (let i = 0; i < 24; i++) device.pressKey('KEYCODE_DEL')
    device.typeText('E2E-Rename')
    await device.tapText('Simpan')

    await expectTextVisible(device, 'E2E-Rename')
    await closeDrawer(device)
  })

  test('TC-07 menghapus sesi melalui dialog konfirmasi', async ({ device }) => {
    await createSession(device)

    await openDrawer(device)
    await device.tapDesc('Delete')

    // Dialog konfirmasi: judul "Hapus" + tombol konfirmasi "Hapus".
    await expectTextVisible(device, 'Hapus')
    await device.tapText('Hapus')

    await expectTextVisible(device, 'Belum ada sesi. Mulai chat baru!')
    await closeDrawer(device)
  })
})
