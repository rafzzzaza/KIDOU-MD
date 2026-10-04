import { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { ffmpeg } from './converter.js'
import fluent_ffmpeg from './ffmpeg-path.js'
import { ffmpegPath } from './ffmpeg-path.js'
import { spawn } from 'child_process'
import uploadFile from './uploadFile.js'
import uploadImage from './uploadImage.js'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'
import fetch from 'node-fetch'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tmp = path.join(__dirname, '../tmp')
/**
 * Image to Sticker
 * @param {Buffer} img Image Buffer
 * @param {String} url Image URL
 */
function sticker2(img, url) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        if (url) {
          let res = await fetch(url)
          if (res.status !== 200) throw await res.text()
          img = await res.buffer()
        }
        let inp = path.join(tmp, +new Date + '.jpeg')
        await fs.promises.writeFile(inp, img)
        let ff = spawn(ffmpegPath, [
          '-y',
          '-i', inp,
          '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1',
          '-f', 'png',
          '-'
        ])
        ff.on('error', reject)
        ff.on('close', async () => {
          await fs.promises.unlink(inp).catch(() => {})
        })
        let bufs = []
        const support = global.support || {}
        let _spawnprocess = 'convert'
        let _spawnargs = ['png:-', 'webp:-']
        if (support.gm) {
          _spawnprocess = 'gm'
          _spawnargs = ['convert', 'png:-', 'webp:-']
        } else if (support.magick) {
          _spawnprocess = 'magick'
          _spawnargs = ['convert', 'png:-', 'webp:-']
        }
        let im = spawn(_spawnprocess, _spawnargs)
        im.on('error', e => console.error('[sticker2] converter error:', e?.message || e))
        im.stdout.on('data', chunk => bufs.push(chunk))
        ff.stdout.pipe(im.stdin)
        im.on('exit', () => {
          resolve(Buffer.concat(bufs))
        })
      } catch (e) {
        reject(e)
      }
    })()
  })
}

async function canvas(code, type = 'png', quality = 0.92) {
  let res = await fetch('https://nurutomo.herokuapp.com/api/canvas?' + queryURL({
    type,
    quality
  }), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': code.length
    },
    signal: AbortSignal.timeout(8000),
    body: code
  })
  let image = await res.buffer()
  return image
}

function queryURL(queries) {
  return new URLSearchParams(Object.entries(queries))
}

/**
 * Image to Sticker
 * @param {Buffer} img Image Buffer
 * @param {String} url Image URL
 */
async function sticker1(img, url) {
  url = url ? url : await uploadImage(img)
  let {
    mime
  } = url ? { mime: 'image/jpeg' } : await fileTypeFromBuffer(img)
  let sc = `let im = await loadImg('data:${mime};base64,'+(await window.loadToDataURI('${url}')))
c.width = c.height = 512
let max = Math.max(im.width, im.height)
let w = 512 * im.width / max
let h = 512 * im.height / max
ctx.drawImage(im, 256 - w / 2, 256 - h / 2, w, h)
`
  return await canvas(sc, 'webp')
}

/**
 * Image/Video to Sticker
 * @param {Buffer} img Image/Video Buffer
 * @param {String} url Image/Video URL
 * @param {String} packname EXIF Packname
 * @param {String} author EXIF Author
 */
const XTEAM_API = 'https://api.xteam.xyz/sticker/wm'

// api.xteam.xyz tidak bisa dihubungi (koneksi ditolak) sejak 2026, dan
// fungsi ini selalu dipanggil pertama sehingga setiap request sempat
// menunggu timeout + upload sia-sia sebelum jatuh ke ffmpeg. Sekarang
// dicek sekali dan dinonaktifkan permanen kalau memang tidak hidup.
let xteamUsable = null
let xteamCheckedAt = 0
const XTEAM_TTL = 10 * 60 * 1000

async function xteamAvailable() {
  const now = Date.now()
  if (xteamUsable !== null && now - xteamCheckedAt < XTEAM_TTL) return xteamUsable
  xteamCheckedAt = now
  try {
    const ctl = AbortSignal.timeout(4000)
    const res = await fetch(XTEAM_API, { signal: ctl, method: 'HEAD' }).catch(() => null)
    xteamUsable = !!res && res.status < 500
  } catch {
    xteamUsable = false
  }
  return xteamUsable
}

async function sticker3(img, url, packname, author) {
  // kalau API-nya tidak hidup, jangan buang waktu cek tiap request
  if (!(await xteamAvailable())) throw new Error('xteam API unavailable')

  url = url ? url : await uploadFile(img)
  const res = await fetch(
    XTEAM_API + '?' + new URLSearchParams({ url, packname, author }),
    { signal: AbortSignal.timeout(15000) }
  )
  if (!res.ok) throw new Error('xteam ' + res.status)
  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) throw new Error('xteam empty')
  return buf
}

/**
 * Image to Sticker
 * @param {Buffer} img Image/Video Buffer
 * @param {String} url Image/Video URL
 */
async function sticker4(img, url) {
  if (url) {
    let res = await fetch(url)
    if (res.status !== 200) throw await res.text()
    img = await res.buffer()
  }
  return await ffmpeg(img, [
    '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1'
  ], 'jpeg', 'webp')
}

/**
 * Convert using fluent-ffmpeg
 * @param {string} img 
 * @param {string} url 
 */
function sticker6(img, url) {
  return new Promise((resolve, reject) => {
    (async () => {
      if (url) {
        let res = await fetch(url)
        if (res.status !== 200) throw await res.text()
        img = await res.buffer()
      }
      const type = await fileTypeFromBuffer(img) || {
        mime: 'application/octet-stream',
        ext: 'bin'
      }
      if (type.ext == 'bin') return reject(img)
      const tmp = path.join(__dirname, `../tmp/${+ new Date()}.${type.ext}`)
      const out = path.join(tmp + '.webp')
      await fs.promises.writeFile(tmp, img)
      // https://github.com/MhankBarBar/termux-wabot/blob/main/index.js#L313#L368
      let Fffmpeg = /video/i.test(type.mime) ? fluent_ffmpeg(tmp).inputFormat(type.ext) : fluent_ffmpeg(tmp).input(tmp)
      Fffmpeg
        .on('error', function (err) {
          console.error(err)
          fs.promises.unlink(tmp).catch(() => {})
          reject(img)
        })
        .on('end', async function () {
          fs.promises.unlink(tmp).catch(() => {})
          resolve(await fs.promises.readFile(out))
        })
        .addOutputOptions([
          `-vcodec`, `libwebp`, `-vf`,
          `scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`
        ])
        .toFormat('webp')
        .save(out)
    })().catch(reject)
  })
}
/**
 * Add WhatsApp JSON Exif Metadata
 * Taken from https://github.com/pedroslopez/whatsapp-web.js/pull/527/files
 * @param {Buffer} webpSticker 
 * @param {String} packname 
 * @param {String} author 
 * @param {String} categories 
 * @param {Object} extra 
 * @returns 
 */
async function addExif(webpSticker, packname, author, categories = [''], extra = {}) {
  const img = new webp.Image();
  const stickerPackId = crypto.randomBytes(32).toString('hex');
  const json = { 'sticker-pack-id': stickerPackId, 'sticker-pack-name': packname, 'sticker-pack-publisher': author, 'emojis': categories, ...extra };
  let exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  let jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  let exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  await img.load(webpSticker)
  img.exif = exif
  return await img.save(null)
}

/**
 * Image/Video to Sticker
 * @param {Buffer} img Image/Video Buffer
 * @param {String} url Image/Video URL
 * @param {...String} 
*/
async function sticker(img, url, ...args) {
  let lastError, stiker
  // FFmpeg lokal sekarang selalu ikut terpasang lewat paket npm, jadi jalur itu
  // dicoba lebih dulu. API luar yang sudah tidak hidup (xteam, nututomo)
  // dipindah ke akhir rantai supaya tidak menambah detik hanya untuk gagal.
  for (let func of [
    global.support.ffmpeg && sticker6,
    global.support.ffmpeg && global.support.ffmpegWebp && sticker4,
    global.support.ffmpeg && (global.support.convert || global.support.magick || global.support.gm) && sticker2,
    sticker3,
    sticker1
  ].filter(f => f)) {
    try {
      stiker = await func(img, url, ...args)
      if (stiker instanceof Buffer && stiker.length > 0) {
        try {
          return await addExif(stiker, ...args)
        } catch (e) {
          console.error(e)
          return stiker
        }
      }
      if (stiker.includes('html')) continue
      throw stiker.toString()
    } catch (err) {
      lastError = err
      continue
    }
  }
  console.error(lastError)
  return false
}

const support = {
  ffmpeg: true,
  ffprobe: true,
  ffmpegWebp: true,
  convert: true,
  magick: false,
  gm: false,
  find: false
}

export {
  sticker,
  sticker1,
  sticker2,
  sticker3,
  sticker4,
  sticker6,
  addExif,
  support
}
