/**
 * Instagram Downloader (reels / posts / IGTV / carousel)
 * Type   : Plugins ESM
 * Method : yt-dlp (self-hosted, no third-party API required)
 *
 * Fallback chain:
 *   1. yt-dlp  -> handles reels, posts, IGTV, carousels
 *   2. public JSON API  -> only if yt-dlp is unavailable on the host
 *
 * yt-dlp is invoked as `python -m yt_dlp`. Install with:
 *   python -m pip install -U yt-dlp
 */
import { spawn } from 'node:child_process'

const IG_HOSTS = /(?:^|\.)(?:instagram\.com|instagr\.am|ddinstagram\.com)$/i

/* ------------------------------------------------------------------ *
 * Validasi URL
 * ------------------------------------------------------------------ */
function normalizeUrl(input) {
  if (!input) return null
  let raw = String(input).trim()

  // kadang user paste tanpa protocol
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '')

  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }

  if (!IG_HOSTS.test(u.hostname)) return null

  // harus punya path media yang recognizable
  if (!/\/(p|reel|reels|tv|share)\//i.test(u.pathname)) return null

  // buang tracking query supaya yt-dlp dapat permalink canonical
  u.search = ''
  u.hash = ''
  return u.toString()
}

function firstLine(s = '') {
  return String(s).split('\n').map((l) => l.trim()).filter(Boolean)[0] || ''
}

// yt-dlp --dump-single-json bisa emit objek beruntai; ambil yang pertama valid
function firstJson(stdout) {
  const s = String(stdout).trim()
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {}
  const end = s.lastIndexOf('}')
  if (end > 0) {
    try {
      return JSON.parse(s.slice(0, end + 1))
    } catch {}
  }
  return null
}

/* ------------------------------------------------------------------ *
 * yt-dlp
 * ------------------------------------------------------------------ */
function runYtDlp(args, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    // coba "python -m yt_dlp", lalu "python3", lalu binary di PATH
    const candidates = [
      { cmd: 'python', args: ['-m', 'yt_dlp', ...args] },
      { cmd: 'python3', args: ['-m', 'yt_dlp', ...args] },
      { cmd: 'yt-dlp', args }
    ]

    let index = 0
    let settled = false

    const tryNext = () => {
      if (settled) return
      if (index >= candidates.length) {
        settled = true
        reject(new Error('yt-dlp tidak ditemukan di sistem.'))
        return
      }
      const c = candidates[index++]
      let child
      try {
        child = spawn(c.cmd, c.args, { windowsHide: true })
      } catch {
        tryNext()
        return
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
        tryNext()
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        if (settled) return
        if (code === 0) {
          settled = true
          resolve({ stdout: out, stderr: errOut })
        } else if (/No module named/i.test(errOut)) {
          tryNext()
        } else {
          settled = true
          reject(new Error(firstLine(errOut) || `yt-dlp exit ${code}`))
        }
      })
    }

    tryNext()
  })
}

function pickThumb(e) {
  if (!e?.thumbnails?.length) return null
  return e.thumbnails[e.thumbnails.length - 1]?.url || null
}

/**
 * Instagram via yt-dlp selalu mengembalikan DASH split streams:
 *   - track video: ext=mp4, vcodec=<h264|vp09>, acodec=none
 *   - track audio: ext=m4a, vcodec=none,  acodec=mp4a...
 * Audio dan video TIDAK pernah dalam satu URL, jadi kita pilih satu
 * track video (video+audio preferred, else video saja) dan satu track audio.
 */
function classifyFormats(e) {
  const out = { video: null, audio: null }
  if (!Array.isArray(e.formats) || !e.formats.length) return out

  // hanya format yang punya URL direct (bukan manifest yg perlu di-resolve)
  const usable = e.formats.filter((f) => f && f.url)
  if (!usable.length) return out

  const hasVideoTrack = (f) => /\.(mp4|mov|webm)$/i.test(f.url) && !/audio|m4a/i.test(f.url)
  const hasAudioTrack = (f) => /\.(m4a|mp3|aac|opus|weba)$/i.test(f.url)

  // --- video track ---
  //yt-dlp untuk IG memberi 2 kelompok:
  //  a) progressive mp4 (id=1,2,3) -> vcodec/acodec undefined, SUDAH contain audio
  //  b) DASH video-only (vcodec=vp09/h264, acodec=none) -> silent, perlu audio terpisah
  const videoFormats = usable.filter((f) => {
    if (hasAudioTrack(f)) return false
    if (f.vcodec === 'none') return false
    return f.vcodec || f.ext === 'mp4' || hasVideoTrack(f)
  })

  if (videoFormats.length) {
    // yang progressive/muxed: codec tidak dispesifikasikan tapi ada audio di dalamnya
    const muxed = videoFormats.find(
      (f) => f.ext === 'mp4' && (!f.vcodec || f.vcodec === 'none') && (!f.acodec || f.acodec === 'none')
    )

    const pool = muxed ? [muxed] : videoFormats
    const sorted = pool.slice().sort((a, b) => {
      // progressive biasanya paling bagus; bandingkan height sebagai fallback
      if (!muxed) return (a.height || 0) - (b.height || 0)
      return 0
    })

    if (muxed) {
      out.video = muxed
      out.videoIsMuxed = true
    } else {
      // pilih resolusi tertinggi <= 720p supaya file tidak terlalu besar
      const under = sorted.filter((f) => (f.height || 0) > 0 && (f.height || 0) <= 720)
      out.video = (under[under.length - 1] || sorted[sorted.length - 1])
    }
  }

  // --- audio track (DASH m4a) ---
  const audioFormats = usable.filter(
    (f) => hasAudioTrack(f) || (f.acodec && f.acodec !== 'none' && (f.vcodec === 'none' || !f.vcodec))
  )
  if (audioFormats.length) {
    const sorted = audioFormats.slice().sort((a, b) => (a.abr || a.tbr || 0) - (b.abr || b.tbr || 0))
    out.audio = sorted[sorted.length - 1]
  }

  return out
}

async function viaYtDlp(url) {
  const { stdout } = await runYtDlp([
    '--no-warnings',
    '--ignore-config',
    '--dump-single-json',
    '--no-playlist',
    url
  ])

  const raw = firstJson(stdout)
  if (!raw) throw new Error('Metadata tidak bisa dibaca.')

  const entries = raw._type === 'playlist' && Array.isArray(raw.entries) ? raw.entries : [raw]
  const media = []

  for (const e of entries) {
    if (!e) continue

    const { video, audio, videoIsMuxed } = classifyFormats(e)

    if (video?.url) {
      media.push({
        kind: 'video',
        url: video.url,
        duration: e.duration ?? null,
        height: video.height ?? null
      })
    }

    // hanya kirim audio terpisah kalau video-nya tidak sudah contain audio
    if (audio?.url && !videoIsMuxed) {
      media.push({ kind: 'audio', url: audio.url, duration: e.duration ?? null })
    }

    // tidak ada format sama sekali -> jatuh ke thumbnail (carousel/post foto)
    if (!video?.url && !audio?.url && e.thumbnails?.length) {
      const best = e.thumbnails[e.thumbnails.length - 1]
      if (best?.url) media.push({ kind: 'image', url: best.url, duration: null })
    }
  }

  if (!media.length && raw.thumbnail) {
    media.push({ kind: 'image', url: raw.thumbnail, duration: raw.duration ?? null })
  }

  if (!media.length) throw new Error('Media tidak ditemukan pada link ini.')

  return {
    title: raw.title || raw.description?.slice(0, 60) || 'Instagram',
    author: raw.uploader || raw.channel || '',
    likes: raw.like_count ?? null,
    media
  }
}

/* ------------------------------------------------------------------ *
 * Fallback: API publik
 * ------------------------------------------------------------------ */
const FALLBACK_APIS = [
  (u) => `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(u)}`,
  (u) => `https://api.socialsmediapi.com/download/ig?url=${encodeURIComponent(u)}`
]

function extractApiMedia(data) {
  const out = []
  const push = (u, kind) => {
    if (typeof u === 'string' && /^https?:\/\//i.test(u)) out.push({ kind, url: u, duration: null })
  }
  const walk = (node, depth = 0) => {
    if (!node || depth > 5) return
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1))
    if (typeof node !== 'object') return
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && /^https?:\/\//i.test(v) && /\.(mp4|m4a|mp3|jpg|jpeg|webp)/i.test(v)) {
        push(v, /audio|mp3|m4a/i.test(k) ? 'audio' : /\.(jpg|jpeg|webp)/i.test(v) ? 'image' : 'video')
      } else if (v && typeof v === 'object') {
        walk(v, depth + 1)
      }
    }
  }
  walk(data)
  return [...new Map(out.map((m) => [m.url, m])).values()]
}

async function viaPublicApi(url) {
  const axios = (await import('axios')).default
  let lastErr = null

  for (const build of FALLBACK_APIS) {
    try {
      const { data, status } = await axios.get(build(url), { timeout: 15_000 })
      if (status !== 200 || !data) throw new Error('respons tidak valid')

      const list = extractApiMedia(data)
      if (list.length) {
        return {
          title: data?.data?.title || data?.title || 'Instagram',
          author: data?.data?.author?.username || data?.author || '',
          likes: null,
          media: list
        }
      }
      throw new Error(data?.message || 'media kosong')
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('semua API fallback gagal')
}

/* ------------------------------------------------------------------ *
 * handler
 * ------------------------------------------------------------------ */
let handler = async (m, { conn, command, usedPrefix }) => {
  const prefix = usedPrefix || '.'
  const input = m.text?.trim().split(/\s+/).slice(1).join(' ')

  if (!input) {
    return m.reply(
      `*Instagram Downloader*\n\n` +
      `Contoh:\n` +
      `  ${prefix}${command} https://www.instagram.com/reel/xxxxxxx/\n` +
      `  ${prefix}${command} https://www.instagram.com/p/xxxxxxx/\n\n` +
      `Mendukung reels, posts, IGTV, dan carousel (album).`
    )
  }

  const url = normalizeUrl(input)
  if (!url) return m.reply('❌ URL Instagram tidak valid.')

  await m.react('⏳')

  let result
  try {
    result = await viaYtDlp(url)
  } catch (e1) {
    try {
      result = await viaPublicApi(url)
    } catch {
      await m.react('❌')
      return m.reply(
        `❌ Gagal mengambil media.\n\n` +
        `Masalah: ${e1.message}\n\n` +
        `Pastikan yt-dlp terpasang:\n` +
        `\`\`\`\npython -m pip install -U yt-dlp\n\`\`\``
      )
    }
  }

  const caption = buildCaption(result)

  let sent = 0
  for (const item of result.media) {
    try {
      if (item.kind === 'audio') {
        await conn.sendMessage(m.chat, {
          audio: { url: item.url },
          mimetype: 'audio/mpeg',
          caption
        }, { quoted: m })
      } else if (item.kind === 'image') {
        await conn.sendMessage(m.chat, { image: { url: item.url }, caption }, { quoted: m })
      } else {
        await conn.sendMessage(m.chat, { video: { url: item.url }, caption }, { quoted: m })
      }
      sent++
    } catch (e) {
      console.error('[IGDL] gagal kirim media:', e.message)
    }
  }

  if (!sent) {
    await m.react('❌')
    return m.reply('❌ Media berhasil diambil tapi gagal dikirim ke WhatsApp.')
  }

  await m.react('✅')
}

function buildCaption(r) {
  const bot = global.namebot || 'Bot'
  const lines = [`✅ *Instagram* • ${bot}`]
  if (r.author) lines.push(`◦ ${r.author}`)
  if (r.title && !/^Video by /i.test(r.title)) lines.push(`◦ ${r.title.slice(0, 100)}`)
  if (r.likes) lines.push(`◦ ❤ ${r.likes.toLocaleString('id-ID')}`)
  return lines.join('\n')
}

handler.help = ['igdl <url>', 'ig <url>', 'instagram <url>']
handler.tags = ['downloader']
handler.command = /^(igdl|ig|instagram)$/i
handler.limit = true

export default handler