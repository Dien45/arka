# Runtime Distro (proot + Alpine) — Panduan Android

> Status: **implementasi selesai, menunggu uji di perangkat nyata**
> Kode: `app/src/main/java/com/arka/app/core/DistroManager.kt`, `ExecRunner.kt`,
> `ui/DistroSettings.kt`, task Gradle `downloadProotBinaries`.

## 1. Masalahnya

`run_command` di Android tanpa root hanya mendapat shell `toybox` (`/system/bin/sh`).
Itu cukup untuk `ls`, `cat`, `grep`, tapi **tidak** untuk pekerjaan coding nyata:
tidak ada `apk`, `npm`, `pip`, `git`, `python3`, atau compiler.

Solusi yang dipakai Termux/Andronix/UserLAnd: jalankan distro Linux asli di dalam
sandbox aplikasi memakai **proot** (emulasi `chroot` berbasis `ptrace`, **tanpa root**).

```
Android app (uid 10xxx)
└── libproot.so            (nativeLibraryDir — satu-satunya folder yang boleh di-exec)
    ├── libproot-loader.so (loader untuk menjalankan binary dari folder no-exec)
    ├── libtalloc.so / libandroid-shmem.so
    └── -r <filesDir>/distro/alpine   ← rootfs Alpine minirootfs (±3,6 MB)
             └── /root/workspace      ← bind ke workspace sesi chat
```

## 2. Dua kendala platform (dan cara mengatasinya)

| Kendala | Penanganan di Arka |
|---|---|
| Sejak Android 10 (targetSdk 29+) SELinux **melarang exec file dari folder data aplikasi** — ini yang memaksa Termux tetap di targetSdk 28 | Binary proot dibundel **di dalam APK** sebagai `jniLibs` (`lib*.so`) → diekstrak ke `nativeLibraryDir` yang boleh dieksekusi. Manifest memakai `android:extractNativeLibs="true"` + `packaging.jniLibs.useLegacyPackaging = true`. |
| Alpine mengeksekusi `/bin/busybox` dkk. dari rootfs yang ada di folder data (no-exec) | proot menjalankan binary lewat **loader** (`PROOT_LOADER=` …/libproot-loader.so`) yang men-*map* ELF langsung, jadi rootfs tetap bisa berisi distro lengkap. |
| `proot` Termux ditautkan ke SONAME `libtalloc.so.2`, sedangkan Android hanya mengekstrak file bernama `lib*.so` | Saat pertama dipakai, Arka membuat **symlink** `filesDir/proot-libs/libtalloc.so.2 → nativeLibraryDir/libtalloc.so` lalu menaruh folder itu di `LD_LIBRARY_PATH`. |

## 3. Dari mana binary-nya?

Task Gradle **`downloadProotBinaries`** (dijalankan otomatis sebelum `preBuild`)
mengunduh paket Termux resmi dari mirror, lalu mengekstrak `data.tar.xz`:

| Paket | Isi yang diambil | Nama di jniLibs |
|---|---|---|
| `proot_5.1.107.96_<arch>.deb` | `usr/bin/proot`, `usr/libexec/proot/loader` | `libproot.so`, `libproot-loader.so` |
| `libtalloc_2.5.0_<arch>.deb` | `usr/lib/libtalloc.so.2.5.0` | `libtalloc.so` |
| `libandroid-shmem_0.7_<arch>.deb` | `usr/lib/libandroid-shmem.so` | `libandroid-shmem.so` |

ABI: `arm64-v8a` (aarch64), `armeabi-v7a` (arm), `x86_64`, `x86` (i686).
Mirror: `packages-cf.termux.dev` → `mirrors.tuna.tsinghua.edu.cn` → `mirrors.ustc.edu.cn` → `mirrors.bfsu.edu.cn`.

Konsekuensi yang disengaja:

- **Repo tetap bersih** — tidak ada binary pihak ketiga yang di-commit.
- **Build tetap jalan saat offline**: kalau unduhan gagal, build sukses tanpa dukungan
  proot dan aplikasi otomatis memakai shell Android (`-Pproot.skip=true` untuk melewati
  sepenuhnya).
- Versi proot dipin di `buildSrc/src/main/kotlin/arka/ProotBinaries.kt`, jadi hasilnya
  reproducible.

## 4. Memasang distro di aplikasi

1. Settings → **Command & Distro** → backend **Alpine (proot)**.
2. Tap **Unduh & pasang (±3,6 MB)** — rootfs Alpine v3.20 diunduh dari
   `dl-cdn.alpinelinux.org` (ada daftar mirror cadangan otomatis) lalu diekstrak ke
   `filesDir/distro/alpine` (aman: entri dengan path traversal ditolak).
   Alternatif offline: **Impor .tar.gz** (mis. hasil `docker export` / minirootfs Alpine).
3. Tap **Tes distro** → menjalankan `cat /etc/alpine-release; uname -a; id; ls /root/workspace`.
   Output muncul langsung di layar — cara tercepat memverifikasi proot benar-benar hidup.
4. Di dalam chat, minta AI: _"pasang python3 pakai apk, lalu jalankan script-nya"_.
   Setiap `run_command` tetap wajib approval di UI.

## 5. Keamanan

- **Approval gate** untuk `run_command` tidak berubah: 5 tool sensitif tetap butuh
  tap Izinkan/Tolak (lihat `Actions.kt`/`ChatController`).
- **Allowlist** opsional (`Settings → Allowlist command`) membatasi prefix perintah.
- **Timeout** 15s (native) / 60s (proot), **output cap** 200 KB, proses dibunuh saat timeout.
- Distro berjalan di dalam sandbox UID aplikasi — tanpa root, tanpa akses ke data app lain.
- Rootfs hanya berisi apa yang kamu install sendiri; `/root/workspace` adalah bind ke folder
  workspace sesi, jadi file AI dan file shell memang satu tempat.

## 6. Batasan yang diketahui

- Sebagian perangkat/kernel ARM64 butuh `PROOT_NO_SECCOMP=1` (default aktif; tombol di
  Settings kalau proot langsung crash).
- Perintah yang butuh root/NET_ADMIN/device (mount, iptables, akses `/sys` tertentu) tidak
  akan jalan — tetap tanpa root.
- Performa: proot memakai `ptrace`, jadi build berat lebih lambat dari perangkat asli.
- Belum ada uji otomatis di CI (butuh perangkat/emulator). Diagnostik di Settings adalah
  jalur verifikasi utama untuk rilis berikutnya.
- Distribusi binary proot tunduk pada **GPL-2.0** (proot) dan **LGPL** (talloc); binary
  diunduh saat build, bukan disertakan dalam repo ini. Sertakan berkas lisensi bila kamu
  mendistribusikan ulang APK secara komersial.

## 7. Troubleshooting

| Gejala | Kemungkinan penyebab | Tindakan |
|---|---|---|
| "Binary proot belum ada di APK ini" | Task `downloadProotBinaries` gagal saat build (offline) | Build ulang dengan jaringan; cek log `[proot]`; atau tetap pakai backend native |
| "Distro proot belum siap" padahal rootfs terpasang | `libproot.so` / loader tidak ada di APK | Cek `ls android/app/build/generated/prootJniLibs/<abi>/` setelah build |
| `proot: Cannot open loader` / crash seketika | loader tidak bisa di-exec atau symlink libtalloc gagal | Buat ulang lewat tombol Tes distro, aktifkan `PROOT_NO_SECCOMP`, pastikan `extractNativeLibs="true"` |
| Perintah Alpine bilang `not found` | paket belum di-install di distro | Minta AI: `apk add --no-cache <paket>` |
| File AI tidak terlihat di distro | `bindWorkspace` dimatikan | Aktifkan "Bind folder sesi ke /root/workspace" |
