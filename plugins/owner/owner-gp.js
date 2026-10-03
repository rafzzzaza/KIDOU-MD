import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

const THUMB_PATH = './media/code.jpeg'
const THUMB_URL = 'https://raw.githubusercontent.com/rafzzzaza/uploader/main/1784349730786-952.jpg'

async function getThumbnail() {
  try {
    return fs.readFileSync(THUMB_PATH)
  } catch {
    const res = await fetch(THUMB_URL)

    if (!res.ok) {
      throw new Error(`Gagal mengambil thumbnail: ${res.status}`)
    }

    return Buffer.from(await res.arrayBuffer())
  }
}

// ==========================================
// SCAN SEMUA PLUGIN
// ==========================================

function getAllPlugins(root) {
  const results = []

  function scan(folder) {
    let files

    try {
      files = fs.readdirSync(folder, {
        withFileTypes: true
      })
    } catch {
      return
    }

    for (const entry of files) {
      const fullPath = path.join(folder, entry.name)

      if (entry.isDirectory()) {
        scan(fullPath)
        continue
      }

      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.js')) continue

      const relative = path
        .relative(root, fullPath)
        .split(path.sep)
        .join('/')

      results.push({
        file: fullPath,
        relative,
        name: entry.name.replace(/\.js$/i, ''),
        nameLower: entry.name
          .replace(/\.js$/i, '')
          .toLowerCase()
      })
    }
  }

  scan(root)

  return results
}

// ==========================================
// AUTO FIND PLUGIN
// ==========================================

function findPlugin(root, target) {
  const plugins = getAllPlugins(root)

  const cleanTarget = target
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.js$/i, '')
    .toLowerCase()

  // ------------------------------------------
  // 1. Coba exact path
  // Contoh: info/main-menu
  // ------------------------------------------

  let found = plugins.find(plugin => {
    const relative = plugin.relative
      .replace(/\.js$/i, '')
      .toLowerCase()

    return relative === cleanTarget
  })

  if (found) return found

  // ------------------------------------------
  // 2. Coba nama file saja
  // Contoh: main-menu
  // Akan menemukan:
  // plugins/info/main-menu.js
  // plugins/menu/main-menu.js
  // plugins/main-menu.js
  // ------------------------------------------

  const sameName = plugins.filter(
    plugin =>
      plugin.nameLower === cleanTarget
  )

  if (sameName.length === 1) {
    return sameName[0]
  }

  // ------------------------------------------
  // 3. Kalau ada banyak nama sama,
  // prioritaskan root plugin
  // ------------------------------------------

  if (sameName.length > 1) {
    const rootPlugin = sameName.find(
      plugin =>
        !plugin.relative.includes('/')
    )

    if (rootPlugin) {
      return rootPlugin
    }

    // Ambil yang pertama kalau memang
    // namanya duplicate di subfolder
    return sameName[0]
  }

  return null
}

// ==========================================
// HANDLER
// ==========================================

let handler = async (m, {
  conn,
  usedPrefix,
  command,
  text
}) => {

  if (!text) {
    throw (
      `uhm.. where the text?\n\n` +
      `example:\n` +
      `${usedPrefix + command} main-menu\n\n` +
      `atau:\n` +
      `${usedPrefix + command} info/main-menu`
    )
  }

  const pluginsRoot = path.resolve(
    process.cwd(),
    'plugins'
  )

  if (!fs.existsSync(pluginsRoot)) {
    return m.reply(
      '❌ Folder plugins tidak ditemukan.'
    )
  }

  // ==========================================
  // AUTO DETECT
  // ==========================================

  const plugin = findPlugin(
    pluginsRoot,
    text
  )

  // ==========================================
  // NOT FOUND
  // ==========================================

  if (!plugin) {
    const allPlugins = getAllPlugins(
      pluginsRoot
    )

    return m.reply(
      `*🗃️ PLUGIN NOT FOUND!*\n` +
      `==================================\n\n` +
      `🔎 Search : ${text}\n\n` +
      `📂 Plugin tersedia:\n\n` +
      allPlugins
        .map(v => `• ${v.relative}`)
        .join('\n')
    )
  }

  // ==========================================
  // READ SOURCE
  // ==========================================

  let source

  try {
    source = fs.readFileSync(
      plugin.file,
      'utf8'
    )
  } catch (e) {
    return m.reply(
      `❌ Gagal membaca plugin:\n${e.message}`
    )
  }

  if (!source.trim()) {
    return m.reply(
      '❌ Plugin kosong.'
    )
  }

  // ==========================================
  // THUMBNAIL
  // ==========================================

  let thumb = null

  try {
    thumb = await getThumbnail()
  } catch {}

  // ==========================================
  // MESSAGE
  // ==========================================

  const message = {
    caption:
`📂 *Plugin Source*

📄 File : plugins/${plugin.relative}
📦 Type : JavaScript (ESM)

🔎 Search : ${text}

Silakan gunakan tombol di bawah untuk menyalin source code.`,

    footer: wm,

    nativeFlow: [
      {
        text: '📋 Salin Source Code',
        copy: source
      },
      {
        text: '🏠 Menu',
        id: '.menu'
      },
      {
        text: '👑 Owner',
        id: '.owner'
      }
    ]
  }

  if (thumb) {
    message.image = thumb
  }

  await conn.sendMessage(
    m.chat,
    message,
    {
      quoted: m
    }
  )
}

// ==========================================
// CONFIG
// ==========================================

handler.help = [
  'getplugin <nama>',
  'gp <nama>'
]

handler.tags = ['owner']

handler.command = /^(getplugin|gp)$/i

handler.owner = true

export default handler
