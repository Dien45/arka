/**
 * TC-03..04 — Primary navigation across the six bottom-bar destinations.
 */
import { test, expectTextVisible, expectContains } from '../helpers/fixtures'
import { openDrawer, closeDrawer } from '../helpers/journey'

test.describe('Fitur: Navigasi utama (bottom bar)', () => {
  test('TC-03 berpindah ke setiap tab lalu kembali ke Chat', async ({ device }) => {
    await device.tapText('Pengaturan')
    await expectContains(device, 'AI Providers')

    await device.tapText('File')
    await expectTextVisible(device, 'Workspace')

    await device.tapText('PRD')
    await expectTextVisible(device, 'PRD Generator')

    await device.tapText('Skill')
    await expectTextVisible(device, 'Skill Store')

    await device.tapText('GitHub')
    await expectTextVisible(device, 'Hubungkan akun')

    await device.tapText('Chat')
    await expectTextVisible(device, 'Halo! Saya Arka')
  })

  test('TC-04 drawer dibuka dari tombol Menu dan menampilkan status sesi kosong', async ({
    device,
  }) => {
    await openDrawer(device)
    await expectTextVisible(device, 'Sesi')
    await expectTextVisible(device, 'Belum ada sesi. Mulai chat baru!')

    await closeDrawer(device)
    await expectTextVisible(device, 'Halo! Saya Arka')
  })
})
