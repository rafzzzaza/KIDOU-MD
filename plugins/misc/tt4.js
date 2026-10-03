import fetch from 'node-fetch'
import MB from 'baileys-mbuilder'

const AIRich = MB.AIRich || MB.Rich || MB.default?.AIRich

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

/* =======================
   HANDLER
======================= */
let handler = async (m, { text, usedPrefix, command, conn }) => {
  try {
    await m.react('✨')

    const input = m.quoted ? m.quoted.text : text

    if (!input) {
      return m.reply(
        `Contoh:\n` +
        `${usedPrefix + command} https://vt.tiktok.com/xxxx\n` +
        `${usedPrefix + command} elaina edit`
      )
    }

    const regex =
      /(https:\/\/(vt|vm)\.tiktok\.com\/[^\s]+|https:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d+)/

    const url = input.match(regex)?.[0]
    let data

    /* =======================
       GET DATA
    ======================= */
    if (url) {
      const res = await fetchTikTok(url)
      if (!res?.data) return m.reply('❌ Gagal mengambil data TikTok.')
      data = res.data
    } else {
      const video = await searchTikTok(input)
      if (!video) return m.reply(`❌ Hasil tidak ditemukan untuk "${input}"`)

      const res = await fetchTikTok(
        `https://www.tiktok.com/@${video.author.unique_id}/video/${video.video_id}`
      )

      if (!res?.data) return m.reply('❌ Gagal mengambil data hasil search.')
      data = res.data
    }

    const isPhoto = data.images?.length > 0

    const caption = `
🎌 *TikTok Downloader*

👤 Uploader : ${getUploader(data)}
⏱ Durasi    : ${formatDuration(data.duration || 0)}
👁 Views     : ${shortNum(data.play_count)}
❤️ Likes     : ${shortNum(data.digg_count)}
💬 Komentar  : ${shortNum(data.comment_count)}
🔁 Share     : ${shortNum(data.share_count)}

📝 Title:
${data.title || '-'}
`.trim()

    const rich = new AIRich(conn)

    /* =======================
       PHOTO MODE
    ======================= */
    if (isPhoto) {
      rich
        .addText('📸 TikTok Photo')
        .addImage(data.images)
        .addTable([
          ['Info', 'Value'],
          ['Uploader', getUploader(data)],
          ['Total Foto', String(data.images.length)],
          ['Views', shortNum(data.play_count)]
        ])
        .addSuggest(['photo', 'mode'])

      await rich.send(m.chat, { quoted: m })
      return
    }

    /* =======================
       VIDEO MODE (FIX: NO DOUBLE SEND)
    ======================= */
    rich
      .addText('🎌 TikTok Downloader')
      .addVideo({
        url: data.play,
        thumbnail: data.cover,
        duration: data.duration
      })
      .addTable([
        ['Info', 'Value'],
        ['Uploader', getUploader(data)],
        ['Durasi', formatDuration(data.duration)],
        ['Views', shortNum(data.play_count)],
        ['Likes', shortNum(data.digg_count)],
        ['Komentar', shortNum(data.comment_count)],
        ['Share', shortNum(data.share_count)]
      ])
      .addTip(data.title || '-')
      .addSuggest(['downloader', 'video', 'tiktok'])

    await rich.send(m.chat, { quoted: m })

    /* =======================
       MUSIC OPTIONAL
    ======================= */
    if (data.music_info?.play) {
      await conn.sendMessage(
        m.chat,
        {
          audio: { url: data.music_info.play },
          mimetype: 'audio/mpeg',
          fileName: `${data.title || 'tiktok'}.mp3`
        },
        { quoted: m }
      )
    }
  } catch (e) {
    console.error(e)
    m.reply(`❌ Terjadi kesalahan:\n${e.message}`)
  }
}

export default handler

handler.help = ['tt4', 'ttdl4', 'tiktok4']
handler.tags = ['downloader']
handler.command = /^(tt4|ttdl4|tiktok4)$/i
handler.limit = true

/* =======================
   API
======================= */
async function fetchTikTok(url) {
  const res = await fetch(
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`
  )
  return res.json()
}

async function searchTikTok(keyword) {
  const res = await fetch(
    `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(
      keyword
    )}&count=1&cursor=0&web=1&hd=1`
  )

  const json = await res.json()
  return json?.data?.videos?.[0]
}

/* =======================
   HELPERS
======================= */
function getUploader(data) {
  return data.author?.nickname || data.author?.unique_id || '-'
}

function shortNum(num = 0) {
  num = Number(num)
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace('.0', '') + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace('.0', '') + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace('.0', '') + 'K'
  return String(num)
}

function formatDuration(sec = 0) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(Math.floor(sec % 60)).padStart(2, '0')
  return `${m}:${s}`
}
