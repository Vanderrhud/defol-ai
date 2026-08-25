# 🎨 DEFOL AI — Mobile AI Image Studio

> Studio generator gambar AI mandiri berbasis Web/PWA yang berjalan 100% di sisi klien (Client-Side). Dirancang khusus untuk efisiensi baterai layar HP (Pure AMOLED Black) dan tanpa biaya server backend.

---

## ✨ Fitur Utama

- 🔒 **Zero-Backend & Privasi Penuh:** API Key dan riwayat gambar disimpan langsung di perangkat HP Anda (menggunakan `localStorage` dan `IndexedDB`).
- ⚡ **Multi-Provider Support:** Mendukung OpenRouter, Comet API, dan Custom OpenAI-Compatible endpoint.
- 📐 **Format Rasio Lengkap:** Pilihan rasio fleksibel (`1:1`, `9:16`, `16:9`, `4:5`, `3:4`, `4:3`, `21:9`).
- 🛡️ **Sistem Fail-Safe Parameter:** Mencegah *Error 400* dengan pengiriman parameter cerdas (Auto / Custom quality).
- 🖼️ **Galeri Riwayat Offline (IndexedDB):** Menampung puluhan riwayat gambar tanpa membebani memori, dilengkapi fitur *Bintang Favorit*, *Pakai Ulang Prompt*, dan *Download/Share*.
- ⚙️ **Manajer Model Kustom:** Bebas menambah dan menghapus model AI kustom langsung dari antarmuka.
- 🔋 **AMOLED Black Theme:** Warna murni `#000000` untuk efisiensi baterai maksimal pada layar OLED/AMOLED HP.

---

## 🛠️ Struktur File

```text
defol-ai/
├── assets/
│   └── icons/          # Ikon PWA (icon-192.png, icon-512.png)
├── index.html          # Kerangka UI & Tab System
├── style.css           # Desain AMOLED & Tata Letak Mobile-First
├── script.js           # Mesin Logika Modular (IndexedDB, Storage, API, UI)
├── manifest.json       # Konfigurasi PWA Fullscreen
├── README.md           # Dokumentasi Utama
└── ROADMAP.md          # Rencana Pengembangan
