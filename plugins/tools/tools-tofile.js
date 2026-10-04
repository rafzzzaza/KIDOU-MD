/**
 *
 * Convert text to file
 * Sumber: https://whatsapp.com/channel/0029VbBoflt4dTnNWXV4zC09
 * Creator: jarr
 *
 * #no delete!
 *
 */

import fs from "fs"
import path from "path"

const BASE_DIR = path.join(process.cwd(), "data", "tofile")
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true })

const MIME_MAP = {
  js: "application/javascript",
  mjs: "application/javascript",
  cjs: "application/javascript",
  ts: "application/typescript",

  json: "application/json",
  yml: "text/yaml",
  yaml: "text/yaml",
  env: "text/plain",

  txt: "text/plain",
  md: "text/markdown",
  log: "text/plain",
  csv: "text/csv",

  html: "text/html",
  css: "text/css",
  xml: "application/xml",
  sql: "application/sql",

  db: "application/octet-stream",
  sqlite: "application/octet-stream",
  sqlite3: "application/octet-stream",
  bin: "application/octet-stream",
  dat: "application/octet-stream",

  pdf: "application/pdf"
}

/**
 * Nama file berasal dari input user, jadi tidak boleh dipercaya apa adanya.
 * Hasil basename() menjadi satu-satunya nama yang diterima, lalu path hasil
 * resolve dicek ulang agar tetap di dalam BASE_DIR. Tanpa ini, `tofile
 * ../../../../.env` akan menimpa file di luar folder tujuan.
 */
function parseFileName(raw) {
  const input = String(raw || "").trim()

  if (!input) return { error: "❌ Nama file wajib diisi" }
  if (input.length > 128) return { error: "❌ Nama file terlalu panjang" }
  if (/\s/.test(input)) {
    return { error: "❌ Nama file tidak boleh mengandung spasi" }
  }

  const fileName = path.basename(input)

  if (fileName !== input || !fileName || fileName === "." || fileName === "..") {
    return { error: "❌ Nama file tidak valid" }
  }
  if (/[/\\]/.test(fileName)) return { error: "❌ Nama file tidak valid" }

  const ext = fileName.split(".").pop().toLowerCase()
  const mime = MIME_MAP[ext]
  if (!mime) {
    return {
      error:
        `❌ Ekstensi .${ext} tidak didukung\n\n` +
        `Gunakan salah satu:\n${Object.keys(MIME_MAP).join(", ")}`
    }
  }

  const filePath = path.resolve(BASE_DIR, fileName)
  const root = path.resolve(BASE_DIR) + path.sep
  if (!filePath.startsWith(root)) {
    return { error: "❌ Nama file tidak valid" }
  }

  return { fileName, filePath, mime }
}

let handler = async (m, { conn, text, usedPrefix, command, isBan }) => {
  if (isBan) return

  if (!m.quoted)
    return m.reply(
      `Contoh:\n${usedPrefix + command} namafile.js (reply teks / dokumen)\n\n` +
      `Format didukung:\n` +
      Object.keys(MIME_MAP).join(", ")
    )

  if (!text)
    return m.reply("❌ Nama file wajib diisi")

  const { fileName, filePath, mime, error } = parseFileName(text)
  if (error) return m.reply(error)

  try {
    if (m.quoted.text) {
      await fs.promises.writeFile(filePath, m.quoted.text)
    } else if (m.quoted.message?.documentMessage) {
      const buffer = await m.quoted.download()
      await fs.promises.writeFile(filePath, buffer)
    } else {
      return m.reply("❌ Reply harus berupa teks atau dokumen")
    }

    const data = await fs.promises.readFile(filePath)

    await conn.sendMessage(
      m.chat,
      {
        document: data,
        fileName,
        mimetype: mime,
        caption: "✅ Success convert *tofile!*"
      },
      { quoted: m }
    )

    await fs.promises.unlink(filePath)
  } catch (e) {
    console.error(e)
    await fs.promises.unlink(filePath).catch(() => {})
    m.reply("⚠️ Gagal membuat file")
  }
}

handler.help = ["tofile <namafile.ext>"]
handler.tags = ["tools"]
handler.command = /^tofile$/i
handler.limit = true
// Menulis/membaca file di disk hanya untuk owner. Tanpa gate ini, siapa pun
// yang bisa memanggil command bisa menimpa file bot lewat path traversal.
handler.owner = true

export default handler