// plugins/allmenu.mjs
/*
📌 All Menu — Bot Theme
🏷️ Type: Plugin ESM
*/

import { promises as fsPromises } from 'fs'
import fs from 'fs'
import path from 'path'
import os, { tmpdir } from 'os'
import moment from 'moment-timezone'
import fetch from 'node-fetch'
import sharp from 'sharp'
import { exec as _exec } from 'child_process'
import { promisify } from 'util'
import { prepareWAMessageMedia } from '@rexxhayanasi/elaina-baileys'

const exec = promisify(_exec)
const { generateWAMessageFromContent, proto } = (await import('@rexxhayanasi/elaina-baileys')).default

// ===============================
// AUDIO CONVERTER HELPER (DARI REFERENSI)
// ===============================
async function toPTT(filePath) {
  const id = Date.now()

  const input = path.join(tmpdir(), `${id}.mp3`)
  const output = path.join(tmpdir(), `${id}.ogg`)

  // Baca file lokal sebagai buffer (pengganti fetch)
  const buffer = await fsPromises.readFile(filePath)

  await fsPromises.writeFile(input, buffer)

  await exec(
    `ffmpeg -y -i "${input}" -vn -c:a libopus -b:a 128k "${output}"`
  )

  const result = await fsPromises.readFile(output)

  await fsPromises.unlink(input).catch(() => {})
  await fsPromises.unlink(output).catch(() => {})

  return result
}

// ===============================
// STYLES (smallcaps)
// ===============================
const Styles = (text, style = 1) => {
  const xStr = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('')
  const yStr = Object.freeze({
    1: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ1234567890'
  })
  const replacer = []
  xStr.map((v, i) => replacer.push({ original: v, convert: yStr[style].split('')[i] }))
  const str = text.toLowerCase().split('')
  const output = []
  str.map(v => {
    const find = replacer.find(x => x.original == v)
    find ? output.push(find.convert) : output.push(v)
  })
  return output.join('')
}

// ===============================
// LOADING ANIMASI
// ===============================
async function loadingBot(conn, m) {
  const msg = await conn.sendMessage(m.chat, {
    text: `🌸 _*Membangunkan ${global.namebot || 'Bot'}...*_`
  }, { quoted: m })

  const frames = [
    { percent: 15,  text: 'mencari kacang...' },
    { percent: 35,  text: 'membaca pikiran user...' },
    { percent: 60,  text: 'mengumpulkan plugin...' },
    { percent: 85,  text: 'menyusun kategori...' },
    { percent: 100, text: 'menu siap ditampilkan!' }
  ]

  for (const frame of frames) {
    const fill = Math.floor(frame.percent / 10)
    const bar = '■'.repeat(fill) + '□'.repeat(10 - fill)

    await new Promise(r => setTimeout(r, 400))

    await conn.relayMessage(m.chat, {
      protocolMessage: {
        key: msg.key,
        type: 14,
        editedMessage: {
          conversation: `🌸 *${global.namebot || 'Bot'} Loading* [${bar}] ${frame.percent}%\n> _${frame.text}_`
        }
      }
    }, {})
  }

  return msg
}

// ===============================
// THUMBNAIL HELPERS
// ===============================
const THUMB_URL = 'https://raw.githubusercontent.com/rafzzzaza/uploader/main/1789426423060-366.jpg'
const CREDITS_URL = 'https://github.com/rafzzzaza'

async function getThumbBuffer(url) {
  try {
    const res = await fetch(url)
    const raw = Buffer.from(await res.arrayBuffer())
    return await sharp(raw)
      .resize(1280, 720, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch {
    return Buffer.alloc(0)
  }
}

async function createHQThumb(conn, thumb) {
  try {
    if (!thumb.length) return null
    const { imageMessage } = await prepareWAMessageMedia(
      { image: thumb },
      {
        upload: conn.waUploadToServer,
        mediaTypeOverride: 'thumbnail-link'
      }
    )
    imageMessage.width = 1280
    imageMessage.height = 720
    return imageMessage
  } catch {
    return null
  }
}

// ===============================
// MAIN HANDLER
// ===============================
let handler = async (m, { conn, usedPrefix: _p }) => {
  let tags = {}

  const defaultMenu = {
    before: `こんにちは、お姉さん %name 🌸

私は *${global.namebot || 'Bot'}* — bot WhatsApp yang siap bantu apapun: cari data, buka plugin, dengerin cerita kamu. 
乂  *S T A T I S T I C* 乂
╭── ︿︿︿︿︿ ︿︿︿︿︿ ︿︿︿︿︿
┊ ‹‹ *ɴᴀᴍᴇ* :: %name
┊•⁀➷ °... ᴡᴀᴋᴜ ᴡᴀᴋᴜ ...
╰─── ︶︶︶︶ ♡⃕  ⌇
 . ┊⿻ [ *ʀᴜɴᴛɪᴍᴇ* :: %muptime]
 . ┊⿻ [ *ᴘʀᴇғɪx* :: <%p>]
 . ┊⿻ [ *ᴅᴀᴛᴀʙᴀsᴇ* :: %totalreg]
 . ┊⿻ [ *ᴅᴀᴛᴇ* :: %date]
 . ┊⿻ [ *ᴘʟᴀᴛғᴏʀᴍ* :: %platform]
 . ┊⿻ [ *ʟɪʙʀᴀʀʏ* :: @rexxhayanasi/elaina-baileys]
  . ┊⿻ [ *ᴄʀᴇᴀᴛᴏʀ* :: ${global.author || 'Owner'} ]
 . ╰─────────╮

Ada error atau mau upgrade premium? Hubungi owner ya~ 🥜
%readmore
`.trimStart(),
    header: '❖━━━━━━[ *%category* ]━━━━━━❖\n╔═━───╍━╍╍┄',
    body: '╠➺ %cmd %islimit %isPremium',
    footer: '╚═─━╍╍━╍╾',
    after: `${global.namebot || 'Bot'} 𝐌𝐃 ${global.version || 'v6.0'}`
  }

  try {
    // ====== INFO USER ======
    let name = m.pushName || conn.getName(m.sender)
    let d = new Date(new Date + 3600000)
    let locale = 'id'

    let date = d.toLocaleDateString(locale, {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    })
    let time = d.toLocaleTimeString(locale, { timeZone: 'Asia/Jakarta' })
    time = time.replace(/[.]/g, ':')

    // ====== FIX RUNTIME & UPTIME ======
    let _muptime = process.uptime() * 1000
    let _uptime = os.uptime() * 1000

    let totalreg = Object.keys(global.db.data.users).length
    let platform = os.platform()
    let muptime = clockString(_muptime)
    let uptime = clockString(_uptime)

    // ====== AMBIL SEMUA PLUGIN ======
    let help = Object.values(global.plugins)
      .filter(plugin => !plugin.disabled)
      .map(plugin => ({
        help: Array.isArray(plugin.tags) ? plugin.help : [plugin.help],
        tags: Array.isArray(plugin.tags) ? plugin.tags : [plugin.tags],
        prefix: 'customPrefix' in plugin,
        limit: plugin.limit,
        premium: plugin.premium,
        enabled: !plugin.disabled
      }))

    for (let plugin of help)
      if (plugin && 'tags' in plugin)
        for (let tag of plugin.tags)
          if (!(tag in tags) && tag) tags[tag] = tag

    conn.menu = conn.menu ? conn.menu : {}

    let before = conn.menu.before || defaultMenu.before
    let header = conn.menu.header || defaultMenu.header
    let body = conn.menu.body || defaultMenu.body
    let footer = conn.menu.footer || defaultMenu.footer
    let after = conn.menu.after || defaultMenu.after

    let _text = [
      before,
      ...Object.keys(tags).map(tag => {
        return header.replace(/%category/g, tags[tag].toUpperCase()) + '\n' + [
          ...help
            .filter(menu => menu.tags && menu.tags.includes(tag) && menu.help)
            .map(menu => menu.help.map(help =>
              body.replace(/%cmd/g, menu.prefix ? help : '%p' + help)
                .replace(/%islimit/g, menu.limit ? '(Ⓛ)' : '')
                .replace(/%isPremium/g, menu.premium ? '(Ⓟ)' : '')
                .trim()
            ).join('\n')),
          footer
        ].join('\n')
      }),
      after
    ].join('\n')

    let text = typeof conn.menu == 'string' ? conn.menu : typeof conn.menu == 'object' ? _text : ''

    let replace = {
      '%': '%',
      p: _p, uptime, muptime,
      me: conn.getName(conn.user.jid),
      name, date, time, platform, _p, totalreg,
      readmore: readMore
    }

    text = text.replace(new RegExp(`%(${Object.keys(replace).sort((a, b) => b.length - a.length).join('|')})`, 'g'),
      (_, name) => '' + replace[name])

    // ====== LOADING ANIMASI ======
    await loadingBot(conn, m)

    // ====== MATCHED LINK PREVIEW ======
    const thumb = await getThumbBuffer(THUMB_URL)
    const highQualityThumbnail = await createHQThumb(conn, thumb)
    const invisible = '\u200B'.repeat(400)

    await conn.sendMessage(m.chat, {
      text: `${CREDITS_URL}${invisible}\n${Styles(text)}`,
      linkPreview: {
        'matched-text': CREDITS_URL,
        matchedText: CREDITS_URL,
        canonicalUrl: CREDITS_URL,
        title: `「 🌸 ${global.namebot || 'Bot'} 𝐌𝐃 • 𝐌𝐞𝐧𝐮 」`,
        description: `Waku waku! Semua fitur ${global.namebot || 'Bot'} ada di sini 🥜`,
        previewType: 0,
        jpegThumbnail: thumb,
        highQualityThumbnail,
        thumbnailUrl: THUMB_URL,
        linkPreviewMetadata: {
          linkMediaDuration: 0,
          socialMediaPostType: 4
        }
      },
      favicon: { url: THUMB_URL }
    }, { quoted: global.fmeta || m })

    // ====== VN AUDIO ======
    let audioPath = './vn/menuall.mp3'
    if (fs.existsSync(audioPath)) {
      try {
        const ptt = await toPTT(audioPath)

        await conn.sendMessage(
          m.chat,
          {
            audio: ptt,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: global.links?.newsletter?.jid || '120363432093486679@newsletter',
                newsletterName: global.namebot || 'Bot',
                serverMessageId: 1
              }
            }
          },
          { quoted: m }
        )
      } catch (err) {
        console.error('[Audio Error]', err.message)
      }
    }

  } catch (e) {
    conn.reply(m.chat, 'Maaf, menu sedang error 🥲', m)
    throw e
  }
}

handler.command = /^(allmenu)$/i
handler.daftar = false

export default handler

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)

function clockString(ms) {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}
