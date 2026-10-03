/**
 * Spotify Track Downloader / Player
 * Type   : Plugins ESM
 *
 * Rantai sumber (otomatis fallback):
 *   1. yt-dlp           -> track penuh, tanpa API key
 *   2. Spotify preview  -> MP3 30 detik dari CDN resmi Spotify (p.scdn.co)
 *
 * Metadata diambil dari embed page Spotify (tanpa API key, tanpa login).
 * Cookie / session tidak diperlukan.
 *
 * Butuh yt-dlp terpasang:
 *   python -m pip install -U yt-dlp
 */
import { spawn } from 'node:child_process'
import axios from 'axios'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function firstLine(s = '') {
  return String(s).split('\n').map((l) => l.trim()).filter(Boolean)[0] || ''
}

/* ------------------------------------------------------------------ *
 * yt-dlp
 * ------------------------------------------------------------------ */
function runYtDlp(args, timeoutMs = 90_000) {
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
        reject(new Error('yt-dlp tidak ditemukan'))
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
        reject(new Error('timeout'))
      }, timeoutMs)
      child.stdout?.on('data', (d) => (out += d))
      child.stderr?.on('data', (d) => (errOut += d))
      child.on('error', () => { clearTimeout(timer); next() })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (settled) return
        if (code === 0) { settled = true; resolve(out) }
        else if (/No module named/i.test(errOut)) next()
        else { settled = true; reject(new Error(firstLine(errOut) || `exit ${code}`)) }
      })
    }
    next()
  })
}

function pickAudioUrl(raw) {
  const fmts = Array.isArray(raw.formats) ? raw.formats : []
  const withUrl = fmts.filter((f) => f && f.url)

  // prefer track audio-only (m4a/mp3)
  const audio = withUrl.find(
    (f) =>
      /\.(m4a|mp3|aac|opus|weba)$/i.test(f.url) ||
      (f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
  )
  if (audio) return audio.url

  // fallback progressive mp4/mp3
  const prog = withUrl.find((f) => /\.(mp3|mp4)$/i.test(f.url))
  if (prog) return prog.url

  return raw.url && /\.(m4a|mp3|mp4)$/i.test(raw.url) ? raw.url : null
}

async function viaYtDlp(trackUrl) {
  const stdout = await runYtDlp([
    '--no-warnings',
    '--ignore-config',
    '--dump-single-json',
    '--no-playlist',
    trackUrl
  ])

  let raw
  try {
    raw = JSON.parse(String(stdout).trim())
  } catch {
    throw new Error('metadata tidak terbaca')
  }

  const url = pickAudioUrl(raw)
  if (!url) throw new Error('audio tidak ditemukan')

  return {
    title: raw.title || 'Spotify Track',
    artist: raw.uploader || raw.artist || raw.channel || '',
    thumbnail: raw.thumbnail || null,
    url,
    full: true
  }
}

/* ------------------------------------------------------------------ *
 * Spotify embed page (metadata + preview mp3)
 * ------------------------------------------------------------------ */
function trackIdFrom(input) {
  if (!input) return null
  const m = String(input).match(/([A-Za-z0-9]{22})/)
  return m ? m[1] : null
}

async function viaEmbed(trackId) {
  const res = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, {
    headers: { 'User-Agent': UA },
    timeout: 25_000
  })
  // axios bisa mengembalikan payload sebagai objek (JSON) atau string HTML
  // yang sudah di-escape. Keduanya harus bisa di-parse.
  const raw = res.data
  let html = ''
  if (typeof raw === 'string') {
    html = raw
  } else if (raw && typeof raw === 'object') {
    html = JSON.stringify(raw)
  }

  const preview =
    html.match(/"audioPreview":\s*\{\s*"url":\s*"([^"]+)"/)?.[1] ||
    html.match(/"audioPreview":\s*\{?\\?"url\\?":\s*\\?"([^"\\]+)/)?.[1] ||
    html.match(/p\.scdn\.co\/mp3-preview\/[A-Za-z0-9]+/)?.[0] ||
    null

  if (!preview) throw new Error('preview tidak tersedia')

  const cleanTitle =
    html.match(/<title>([^<]*)<\/title>/i)?.[1] ||
    html.match(/"name":\s*"([^"]+)"/)?.[1] ||
    html.match(/\\"name\\":\s*\\"([^"\\]+)\\"/)?.[1] ||
    ''
  const title = cleanTitle.replace(/^Spotify Embed:\s*/i, '').trim() || 'Spotify Track'

  const thumb =
    html.match(/"imageUrl":\s*"([^"]+)"/)?.[1] ||
    html.match(/"imageUrl":\s*\\?"([^"\\]+)/)?.[1] ||
    html.match(/i\.scdn\.co\/image\/[A-Za-z0-9]+/)?.[0] ||
    null

  const artist =
    html.match(/"subtitle":\s*"([^"]+)"/)?.[1] ||
    html.match(/"subtitle":\s*\\?"([^"\\]+)/)?.[1] ||
    ''

  const fullUrl = preview.startsWith('http') ? preview : `https://${preview}`

  return { title, artist, thumbnail: thumb, url: fullUrl, full: false }
}

/* ------------------------------------------------------------------ *
 * handler
 * ------------------------------------------------------------------ */
let handler = async (m, { conn, text, usedPrefix, command }) => {
  const prefix = usedPrefix || '.'

  if (!text) {
    return m.reply(
      `*Spotify Downloader*\n\n` +
      `Contoh:\n` +
      `  ${prefix}${command} <judul lagu>\n` +
      `  ${prefix}${command} https://open.spotify.com/track/xxxxxxxxxxxxxxxxxxxxxx\n\n` +
      `Kalau yang diberikan link Spotify,Exact track-nya diputar. ` +
      `Kalau judul, bot cari dulu lewat yt-dlp.`
    )
  }

  await m.react('🕒')

  const input = String(text).trim()
  const hasSpotifyLink = /spotify\.com\/track\/|spotify:track:/i.test(input)

  // judul lagu (bukan link) -> cari dulu track-nya
  let resolved = null
  if (!hasSpotifyLink) {
    try {
      const stdout = await runYtDlp([
        '--no-warnings', '--ignore-config',
        '--flat-playlist', '--print-json',
        `ytsearch1:${input} official audio`
      ])
      const j = JSON.parse(firstLine(stdout))
      if (j?.id) resolved = { title: j.title, id: j.id }
    } catch {
      /* fallthrough ke pesan error */
    }
    if (!resolved) {
      await m.react('❌')
      return m.reply(`❌ Lagu tidak ditemukan: *${input}*`)
    }
  }

  const trackId = hasSpotifyLink
    ? trackIdFrom(input)
    : (resolved?.id && trackIdFrom(resolved.id))

  if (!trackId) {
    await m.react('❌')
    return m.reply('❌ ID track Spotify tidak valid.')
  }

  const canonical = `https://open.spotify.com/track/${trackId}`
  let result
  let full = true

  try {
    result = await viaYtDlp(canonical)
  } catch (ytdlpErr) {
      // Spotify DRM ditolak yt-dlp -> pakai preview resmi Spotify
      try {
        result = await viaEmbed(trackId)
        full = false
      } catch (embedErr) {
        console.error('[SPOTIFYPLAY] yt-dlp gagal:', ytdlpErr.message)
        console.error('[SPOTIFYPLAY] embed gagal:', embedErr.message)
        await m.react('❌')
        return m.reply(
          `❌ Gagal mengambil lagu.\n\n` +
          `yt-dlp: ${ytdlpErr.message}\n` +
          `embed: ${embedErr.message}\n\n` +
          `Spotify tidak menyediakan preview untuk track ini.`
        )
      }
    }

  try {
    await conn.sendMessage(m.chat, {
      audio: { url: result.url },
      mimetype: 'audio/mpeg',
      fileName: `${(result.title || 'spotify').replace(/[^\w\s-]/g, '').slice(0, 60)}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: result.title || 'Spotify Track',
          body: result.artist || '',
          thumbnailUrl: result.thumbnail || undefined,
          sourceUrl: canonical,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: m })

    if (!full) await m.reply('⚠️ Full track tidak tersedia (Spotify DRM). Yang diputar *preview 30 detik*.')

    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    return m.reply(`❌ Gagal mengirim audio: ${e.message}`)
  }
}

handler.help = ['spotifyplay <judul|link>']
handler.tags = ['downloader', 'music']
handler.command = /^(spotifyplay|spotifydl2)$/i
handler.limit = true

export default handler