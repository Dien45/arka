/**
 * TC-10 — Chat composer input.
 *
 * We only assert that typing echoes into the composer; we never press Send so
 * the suite stays offline and deterministic (no provider is configured).
 */
import { test, expectTextVisible } from '../helpers/fixtures'

test.describe('Fitur: Input chat', () => {
  test('TC-10 mengetik di composer menampilkan teks yang diketik', async ({ device }) => {
    await expectTextVisible(device, 'Tanyakan sesuatu tentang kode...')

    await device.focusAndType('Tanyakan sesuatu tentang kode...', 'TestE2E')
    await expectTextVisible(device, 'TestE2E')
  })
})
