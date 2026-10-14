/**
 * TC-08..09 — Settings screen: AI provider list and Command & Distro section.
 */
import { test, expectTextVisible, expectContains } from '../helpers/fixtures'

test.describe('Fitur: Pengaturan', () => {
  test('TC-08 daftar provider AI tampil', async ({ device }) => {
    await device.tapText('Pengaturan')
    await expectTextVisible(device, 'AI Providers')

    for (const provider of [
      'OpenAI',
      'Anthropic',
      'Google AI',
      'Groq',
      'OpenRouter',
      'Ollama (Local)',
      'Custom',
    ]) {
      await expectTextVisible(device, provider)
    }

    await expectContains(device, 'Belum dikonfigurasi')
    await expectContains(device, 'run_command: Alpine')
  })

  test('TC-09 seksi Command & Distro tampil', async ({ device }) => {
    await device.tapText('Pengaturan')

    await expectTextVisible(device, 'Command & Distro')
    await expectTextVisible(device, 'Tes distro')
    await expectTextVisible(device, 'Hapus rootfs')
    await expectTextVisible(device, 'Impor .tar.gz')
    await expectContains(device, 'URL rootfs')
  })
})
