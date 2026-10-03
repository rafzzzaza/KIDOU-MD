# Dokumentasi KIDOU MD (Asanagi AI)

## 1. Arsitektur Bot

### File Core
- **`main.js`**: Entry point utama bot. Menangani:
  - Inisialisasi koneksi Baileys
  - Loading database (LowDB)
  - Sistem pairing (QR/Phone)
  - Hot reload plugin system
  - Auto reset limit harian
  - Jadibot restore

- **`handler.js`**: Message handler. Menangani:
  - Processing semua pesan masuk
  - Plugin execution engine
  - Middleware (blacklist, premium, admin only)
  - Group events (welcome, bye, promote, demote)
  - Anti-bug & anti-spam
  - Database user/chat management

- **`config.js`**: Pusat konfigurasi terpusat:
  - `global.namebot`, `global.author`, `global.owner`
  - `global.links.*` (github, whatsapp channel, newsletter JID)
  - `global.msg.*` (welcome, bye, error, akses)
  - `global.images.*` (banner, thumbnail)
  - Payment config, API keys, panel config

- **`index.js`**: Worker manager (restart system)

### Folder Struktur
- **`lib/`**: Helper functions
  - `simple.js`: Extend Baileys API
  - `database.js`: Database schema manager
  - `welcome.js`: Welcome card generator
  - `uploader.js`, `uploadImage.js`: File upload utilities
  - `converter/`: Audio/video/sticker converter
  - `scrape/`: Web scraper modules

- **`plugins/`**: Fitur modular (hot reload)
  - `_system/`: Core plugin (menu, antispam, role)
  - `ai/`: AI features (GPT, Gemini, image gen)
  - `downloader/`: Media downloader (YT, TikTok, IG, dll)
  - `game/`: Game interaktif
  - `group/`: Group management
  - `tools/`: Utility tools
  - `maker/`: Image/sticker maker
  - `rpg/`: RPG economy system

---

## 2. Sistem Konfigurasi

### Cara Mengubah Identitas Bot
Edit file `config.js`:

```javascript
global.namebot = 'Bot Kamu'
global.author = 'Nama Kamu'
global.owner = [
  ['62812345678', 'Owner1', true],
  ['62887654321', 'Owner2', false]
]
```

### Variabel Global Tersedia

#### Identitas & Info
- `global.namebot` - Nama bot
- `global.author` - Nama author
- `global.owner` - Array owner `[[nomor, nama, isDev]]`
- `global.ownerNumber` - Nomor owner utama
- `global.ownerName` - Nama owner utama

#### Link & Social Media
- `global.links.github` - Link Github
- `global.links.githubRepo` - Link Repository
- `global.links.whatsappChannel` - Link WhatsApp Channel
- `global.links.newsletter.jid` - Newsletter JID
- `global.links.newsletter.name` - Newsletter Name
- `global.links.officialGroup` - Link Grup Official
- `global.links.backupGroup` - JID Grup Backup

#### Pesan Sistem
- `global.msg.wait` - "Tunggu..."
- `global.msg.error` - "Terjadi error"
- `global.msg.success` - "Berhasil"
- `global.msg.owner` - Pesan akses owner only
- `global.msg.premium` - Pesan akses premium only
- `global.msg.group` - Pesan akses group only
- `global.msg.admin` - Pesan akses admin only
- `global.msg.welcome` - Template welcome message
- `global.msg.bye` - Template goodbye message

#### Media & Assets
- `global.images.ratio_16_9.url` - Banner 16:9
- `global.images.ratio_1_1.url` - Thumbnail 1:1

#### Config Lainnya
- `global.APIs` - API endpoints
- `global.panel` - Panel hosting config
- `global.pakasir` - Payment gateway config
- `global.rpg.emoticon()` - Emoji mapper untuk RPG

---

## 3. Sistem Plugin

### Struktur Plugin Standar

```javascript
let handler = async (m, { conn, text, usedPrefix, command, args, isOwner, isAdmin, isPrems }) => {
    // Validasi input
    if (!text) return m.reply(`Contoh: ${usedPrefix + command} <input>`)
    
    // Proses fitur
    await m.reply(global.msg.wait)
    
    try {
        // Logic utama
        let result = await someFunction(text)
        await m.reply(result)
    } catch (e) {
        await m.reply(global.msg.error)
        console.error(e)
    }
}

// Metadata
handler.help = ['commandname <arg>']
handler.tags = ['kategori']
handler.command = /^(cmd1|cmd2|alias)$/i

// Middleware (optional)
handler.owner = false       // Hanya owner
handler.rowner = false      // Hanya real owner (developer)
handler.admin = false       // Hanya admin grup
handler.botAdmin = false    // Bot harus admin
handler.group = false       // Hanya di grup
handler.private = false     // Hanya di private chat
handler.premium = false     // Hanya user premium
handler.limit = true        // Pakai limit (true/false/angka)
handler.register = false    // Harus daftar dulu

export default handler
```

### Parameter Handler

#### Parameter Utama (`m`)
- `m.sender` - JID pengirim
- `m.chat` - JID chat
- `m.text` - Teks pesan
- `m.isGroup` - Boolean grup
- `m.quoted` - Pesan yang direply
- `m.reply(text)` - Reply pesan

#### Extra Parameters
- `conn` - Instance Baileys
- `text` - Input setelah command
- `usedPrefix` - Prefix yang dipakai (`.`, `!`, `/`)
- `command` - Command yang dipanggil
- `args` - Array argumen
- `isOwner` - Boolean owner
- `isAdmin` - Boolean admin grup
- `isBotAdmin` - Boolean bot admin
- `isPrems` - Boolean premium user
- `groupMetadata` - Metadata grup (jika di grup)
- `participants` - List member grup

### Hook Khusus

#### `handler.before`
Dijalankan sebelum command diproses (untuk middleware custom):
```javascript
handler.before = async (m, { conn }) => {
    // Custom logic
    if (kondisi) return true // Skip eksekusi command
}
```

#### `handler.all`
Dijalankan di setiap pesan masuk (tanpa perlu command):
```javascript
handler.all = async (m, { conn }) => {
    // Logic untuk setiap pesan
}
```

#### `handler.after`
Dijalankan setelah command selesai:
```javascript
handler.after = async (m, { conn }) => {
    // Cleanup atau logging
}
```

---

## 4. Database System

### Struktur Database (`database.json`)

```javascript
{
  "users": {
    "62812345678@s.whatsapp.net": {
      "exp": 100,
      "level": 1,
      "money": 5000,
      "limit": 50,
      "premiumTime": 0,
      "lastclaim": 0,
      "registered": true,
      "name": "User",
      "age": 18
    }
  },
  "chats": {
    "62812345678-1234567890@g.us": {
      "welcome": true,
      "detect": true,
      "antiLink": false,
      "isBanned": false,
      "adminOnly": false
    }
  },
  "stats": {},
  "settings": {},
  "blacklistUser": {}
}
```

### Mengakses Database

```javascript
// User data
let user = global.db.data.users[m.sender]
user.exp += 10
user.money += 1000

// Chat data
let chat = global.db.data.chats[m.chat]
chat.welcome = true

// Auto save setiap 2 detik (sudah dihandle di main.js)
```

---

## 5. Helper Functions di `lib/simple.js`

### Extend Baileys API

```javascript
// Kirim pesan dengan mention
conn.reply(chatId, text, quoted, { mentions: ['628xxx@s.whatsapp.net'] })

// Download media
let media = await m.download()

// Send button
await conn.sendButton(chatId, text, footer, buttons, quoted)

// Send list
await conn.sendList(chatId, title, text, footer, buttonText, sections, quoted)

// Get profile picture
let pp = await conn.profilePictureUrl(jid, 'image')

// Serialize message
m = smsg(conn, m)
```

---

## 6. Cara Menambah Fitur Baru

### Langkah-langkah:

1. **Buat file plugin baru** di `plugins/kategori/namafitur.js`

2. **Tulis handler:**
```javascript
let handler = async (m, { conn, text }) => {
    if (!text) return m.reply('Masukkan input!')
    await m.reply(`Hasilnya: ${text.toUpperCase()}`)
}
handler.help = ['uppercase <text>']
handler.tags = ['tools']
handler.command = /^(uppercase|upper)$/i
export default handler
```

3. **Save file** - Bot otomatis detect & reload plugin baru

4. **Test command:** `.uppercase halo`

### Tips Best Practice:

- Gunakan `global.*` untuk config (jangan hardcode)
- Gunakan `try-catch` untuk error handling
- Gunakan `global.msg.wait` dan `global.msg.error`
- Tambahkan validasi input
- Tambahkan middleware sesuai kebutuhan (owner, group, premium)
- Test di grup dan private chat

---

## 7. Maintenance & Troubleshooting

### Cara Menjalankan Bot

```bash
npm start
```

### Pairing Mode
Bot akan otomatis minta input nomor jika belum pernah pairing.

### Reset Database
Hapus `database.json` lalu restart bot.

### Reload Plugin Manual
Ketik: `.reload` (owner only)

### Lint & Format Code
```bash
npm run lint
npm run format
```

### Error Umum

**Error: Cannot find module**
- Jalankan `npm install`

**Error: ENOENT sessions/creds.json**
- Hapus folder `sessions/` lalu scan ulang

**Plugin tidak jalan**
- Check syntax error di console
- Pastikan export default handler
- Check middleware (owner, group, dll)

**Database corrupted**
- Backup `database.json`
- Hapus file lama & restart bot

---

## 8. Keamanan & Best Practice

### Jangan Commit Ke Github:
- `sessions/`
- `database.json`
- `config.js` (jika ada data sensitif)
- `.env` (jika pakai)

### Edit `.gitignore`:
```
sessions/
database.json
node_modules/
*.log
.env
```

### Ganti API Key & Credentials
Edit `config.js` bagian:
- `global.pakasir` (payment gateway)
- `global.panel` (hosting panel)
- `global.APIs` (API endpoints)

---

## 9. Kontribusi & Credits

Bot ini berbasis open source dan bebas dimodifikasi sesuai kebutuhan.

Jika kamu menambahkan fitur baru atau memperbaiki bug, dokumentasikan di file ini agar mudah di-maintain oleh developer lain.

---

**Dibuat dengan ❤️ oleh komunitas WhatsApp Bot Indonesia**
