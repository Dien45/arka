/**
 * TC-01..02 — App launch & first-run state.
 *
 * The app resets to its default language (Indonesian) after `pm clear`, so all
 * assertions here use the ID strings from core/I18n.kt.
 */
import { test, expectTextVisible, expectDescVisible, expectContains } from '../helpers/fixtures'

test.describe('Fitur: Peluncuran aplikasi (first-run)', () => {
  test('TC-01 sapaan, deskripsi, disclaimer, prompt cepat & navigasi bawah tampil', async ({
    device,
  }) => {
    await expectTextVisible(device, 'Halo! Saya Arka')
    await expectContains(device, 'Coding agent siap membantu')
    await expectTextVisible(device, 'Arka bisa membuat kesalahan. Periksa informasi penting.')

    for (const label of ['Chat', 'File', 'PRD', 'GitHub', 'Skill', 'Pengaturan']) {
      await expectTextVisible(device, label)
    }

    for (const prompt of [
      'Buat project React baru',
      'Debug kode ini',
      'Jelaskan kode',
      'Optimasi performa',
    ]) {
      await expectTextVisible(device, prompt)
    }
  })

  test('TC-02 composer, mode Build, model default & drawer tersedia', async ({ device }) => {
    await expectTextVisible(device, 'Tanyakan sesuatu tentang kode...')
    await expectContains(device, 'Build')
    await expectContains(device, 'gpt-4o')
    await expectDescVisible(device, 'Menu')
    await expectDescVisible(device, 'Send')
    await expectDescVisible(device, 'Lampirkan file')
  })
})
