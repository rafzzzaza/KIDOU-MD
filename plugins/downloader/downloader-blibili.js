/**
 * 📺 Bilibili Downloader
 * 📦 Tipe : Plugin ESM
 * 🔧 Metode : yt-dlp (self-hosted, tanpa API pihak ketiga)
 *
 * Domain bilibili.tv sudah mati, dan nekolabs.my.id (scraper sebelumnya)
 * juga tidak ada lagi. yt-dlp sudah punya extractor BiliBili yang menangani
 * video + audio terpisah lalu otomatis merge.
 *
 * Butuh: python -m pip install -U yt-dlp
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const BILI_HOSTS = /(?:^|\.)(?:bilibili\.com|b23\.tv|bilibili\.tv)$/i
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function firstLine(s = '') {
  return String(s).split('\n').map((l) => l.trim()).filter(Boolean)[0] || ''
}

/* ------------------------------------------------------------------ *
 * Validasi URL
 * ------------------------------------------------------------------ */
function normalizeUrl(input) {
  if (!input) return null
  let raw = String(input).trim()

  if (!/^https?:\/\//i.test(raw)) {
    // bisa juga BV id atau av id langsung
    if (/^BV[0-9A-Za-z]{10}$/.test(raw)) return `https://www.bilibili.com/video/${raw}`
    if (/^av\d+$/i.test(raw)) return `https://www.bilibili.com/video/${raw}`
    raw = 'https://' + raw.replace(/^\/+/, '')
  }

  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (!BILI_HOSTS.test(u.hostname)) return null
  return u.toString()
}

async function expandShortUrl(url) {
  if (!/b23\.tv$/i.test(new URL(url).hostname)) return url
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000)
    })
    const final = res.url || url
    return /bilibili\.com/i.test(final) ? final : url
  } catch {
    return url
  }
}

/* ------------------------------------------------------------------ *
 * yt-dlp
 * ------------------------------------------------------------------ */
function runYtDlp(args, timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    const candidates = [
      { cmd: 'python', args: ['-m', 'yt_dlp', ...args] },
      { cmd: 'python3', args: ['-m', 'yt_dlp', ...args] },
      { cmd: 'yt-dlp', args }
    ]
    let i = 0
    let settled = false

    const next = () => {
      if (settled) return
      if (i >= candidates.length) {
        settled = true
        reject(new Error('yt-dlp tidak ditemukan di sistem.'))
        return
      }
      const c = candidates[i++]
      let child
      try {
        child = spawn(c.cmd, c.args, { windowsHide: true })
      } catch {
        return next()
      }
      let out = ''
      let errOut = ''
      const timer = setTimeout(() => {
        try { child.kill() } catch {}
        settled = true
        reject(new Error('yt-dlp timeout.'))
      }, timeoutMs)

      child.stdout?.on('data', (d) => (out += d))
      child.stderr?.on('data', (d) => (errOut += d))

      child.on('error', () => {
        clearTimeout(timer)
        next()
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        if (settled) return
        if (code === 0) {
          settled = true
          resolve({ stdout: out, stderr: errOut })
        } else if (/No module named/i.test(errOut)) {
          next()
        } else {
          settled = true
          reject(new Error(firstLine(errOut) || `yt-dlp exit ${code}`))
        }
      })
    }

    next()
  })
}

async function fetchViaYtDlp(url) {
  // 1) metadata dulu supaya caption-nya enak dibaca
  const { stdout } = await runYtDlp([
    '--no-warnings', '--ignore-config',
    '--dump-single-json', '--no-playlist', '--skip-download',
    url
  ])
  const raw = JSON.parse(String(stdout).trim())

  const meta = {
    title: raw.title || 'Bilibili',
    description: raw.description || '',
    uploader: raw.uploader || raw.channel || '',
    duration: raw.duration ?? null
  }

  // 2) download format terbaik yang <=720p, PAKSA H.264
  //
  // Bilibili menyajikan video sebagai AV1 / HEVC di banyak video, dan
  // WhatsApp tidak bisa memutar keduanya (av01 menghasilkan file yang
  // tidak bisa diputar di app). Jadi H.264 diprioritaskan; kalau tidak
  // ada, ambil yang terbaik lalu re-encode ke H.264 pakai ffmpeg.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-'))
  const outTpl = path.join(tmpDir, '%(id)s.%(ext)s')

  const H264_FORMATS = [
    'bestvideo[height<=720][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=720][vcodec^=avc1]',
    'best[height<=720][vcodec^=avc1]',
    'bestvideo[height<=720]+bestaudio/best[height<=720]/best'
  ]

  let downloaded = false
  let lastErr = null

  for (const fmt of H264_FORMATS) {
    try {
      await runYtDlp([
        '--no-warnings', '--ignore-config', '--no-playlist',
        '--format', fmt,
        '--merge-output-format', 'mp4',
        '--user-agent', UA,
        '--referer', 'https://www.bilibili.com/',
        '-o', outTpl,
        url
      ])
      downloaded = true
      break
    } catch (e) {
      lastErr = e
      // bersihkan sisa file sebelum coba format lain
      try {
        for (const f of fs.readdirSync(tmpDir)) {
          fs.unlinkSync(path.join(tmpDir, f))
        }
      } catch {}
    }
  }

  if (!downloaded) throw lastErr || new Error('Gagal mengunduh video.')

  try {
    const files = fs.readdirSync(tmpDir)
    if (!files.length) throw new Error('Tidak ada file yang terunduh.')

    // pilih file terbesar (hasil merge)
    let best = null
    let bestSize = -1
    for (const f of files) {
      const full = path.join(tmpDir, f)
      let size = 0
      try { size = fs.statSync(full).size } catch {}
      if (size > bestSize) {
        bestSize = size
        best = full
      }
    }
    if (!best || bestSize <= 0) throw new Error('File hasil unduhan kosong.')

    let buffer = fs.readFileSync(best)
    if (!buffer.length) throw new Error('Buffer video kosong.')

    // kalau codec-nya bukan H.264 (AV1/HEVC), re-encode supaya bisa diputar
    if (!buffer.includes(Buffer.from('avc1')) &&
        (buffer.includes(Buffer.from('av01')) || buffer.includes(Buffer.from('hvc1')) ||
         buffer.includes(Buffer.from('hev1')))) {
      const fixed = await transcodeToH264(best, tmpDir)
      if (fixed) buffer = fixed
    }

    return { ...meta, buffer }
  } finally {
    try {
      for (const f of fs.readdirSync(tmpDir)) {
        fs.unlinkSync(path.join(tmpDir, f))
      }
      fs.rmdirSync(tmpDir)
    } catch {}
  }
}

/**
 * Re-encode AV1/HEVC -> H.264 supaya bisa diputar di WhatsApp.
 * Kalau ffmpeg tidak ada, kembalikan null supaya file asli tetap dikirim.
 */
async function transcodeToH264(srcPath, tmpDir) {
  const out = path.join(tmpDir, 'h264.mp4')

  const ok = await new Promise((resolve) => {
    let child
    try {
      child = spawn('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', srcPath,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
        '-pix_fmt', 'yuv420p',   // syaratWA, tanpa ini playback hitam
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        out
      ], { windowsHide: true })
    } catch {
      return resolve(false)
    }
    const timer = setTimeout(() => {
      try { child.kill() } catch {}
      resolve(false)
    }, 240_000)

    child.on('error', () => { clearTimeout(timer); resolve(false) })
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0) })
  })

  if (!ok) return null
  try {
    const buf = fs.readFileSync(out)
    return buf.length ? buf : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * handler
 * ------------------------------------------------------------------ */
let handler = async (m, { conn, usedPrefix, command }) => {
  const input = m.text?.trim().split(/\s+/).slice(1).join(' ')

  if (!input) {
    const p = usedPrefix || '.'
    return m.reply(
      `*Bilibili Downloader*\n\n` +
      `Contoh:\n` +
      `  ${p}${command} https://www.bilibili.com/video/BV1xx411c7mD\n` +
      `  ${p}${command} BV1xx411c7mD\n` +
      `  ${p}${command} https://b23.tv/xxxxxxx`
    )
  }

  let url = normalizeUrl(input)
  if (!url) return m.reply('❌ URL Bilibili tidak valid.')

  url = await expandShortUrl(url)

  await m.react('⏳')

  try {
    const result = await fetchViaYtDlp(url)

    const fmtDur = result.duration
      ? `${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')}`
      : '?'

    const lines = [`🎬 *${result.title}*`]
    if (result.uploader) lines.push(`👤 ${result.uploader}`)
    lines.push(`⏱️ ${fmtDur}`)
    if (result.description) {
      const desc = result.description.replace(/\s+/g, ' ').slice(0, 200)
      lines.push(`📝 ${desc}`)
    }

    await conn.sendMessage(
      m.chat,
      { video: result.buffer, caption: lines.join('\n'), mimetype: 'video/mp4' },
      { quoted: m }
    )

    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    const msg = e.message || String(e)
    if (/yt-dlp tidak ditemukan/i.test(msg)) {
      return m.reply(
        `❌ yt-dlp belum terpasang.\n\nPasang dengan:\n\`\`\`\npython -m pip install -U yt-dlp\n\`\`\``
      )
    }
    if (/deleted|geo-restricted|private|not available|unavailable/i.test(msg)) {
      return m.reply(`❌ Video tidak tersedia.\n\n> ${msg.slice(0, 200)}`)
    }
    return m.reply(`❌ Gagal mengunduh.\n\n> ${msg.slice(0, 250)}`)
  }
}

handler.help = ['bilibili <url|BV-id>']
handler.tags = ['downloader']
handler.command = /^(bili|blibli|bilibili)$/i
handler.limit = true
handler.register = true

export default handler