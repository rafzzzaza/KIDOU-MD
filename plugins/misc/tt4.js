import { tiktokDownload, tiktokSearch } from '../../lib/tiktok.js'

let handler = async (m, { text, usedPrefix, command, conn }) => {
  try {
    const input = m.quoted ? m.quoted.text : text
    if (!input) {
      return m.reply(
        `Contoh:\n` +
        `${usedPrefix + command} https://vt.tiktok.com/xxxx\n` +
        `${usedPrefix + command} elaina edit`
      )
    }

    const regex = /(https:\/\/(vt|vm)\.tiktok\.com\/[^\s]+|https:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d+)/
    let url = input.match(regex)?.[0]
    let data

    if (url) {
      data = await tiktokDownload(url)
    } else {
      let video = await tiktokSearch(input)
      if (video) {
        let videoUrl = video.tiktokUrl || `https://www.tiktok.com/@${video.author?.unique_id}/video/${video.video_id}`
        data = await tiktokDownload(videoUrl)
      }
    }

    if (!data) {
      return m.reply('❌ Gagal mengambil data TikTok.')
    }

    // PHOTO
    if (data.images && data.images.length) {
      for (let i = 0; i < data.images.length; i++) {
        await conn.sendFile(
          m.chat,
          data.images[i],
          '',
          i === 0 ? `🖼️ *TIKTOK PHOTO*\n\n> Judul : ${data.title || '-'}\n> Uploader : ${data.author?.nickname || '-'}` : '',
          m
        )
        await new Promise(res => setTimeout(res, 1000))
      }
      return
    }

    // VIDEO
    if (data.play) {
      await conn.sendFile(
        m.chat,
        data.play,
        'tiktok.mp4',
        `🎬 *TIKTOK VIDEO*\n\n> Judul : ${data.title || '-'}\n> Uploader : ${data.author?.nickname || '-'}\n> Durasi : ${data.duration || 0}s`,
        m
      )
    }

    // AUDIO
    if (data.music) {
      await conn.sendMessage(
        m.chat,
        {
          audio: { url: data.music },
          mimetype: 'audio/mpeg',
          fileName: `${data.title || 'tiktok'}.mp3`
        },
        { quoted: m }
      )
    }

  } catch (e) {
    console.error(e)
    m.reply('❌ Terjadi kesalahan.')
  }
}

handler.help = ['tt4', 'ttdl4', 'tiktok4']
handler.tags = ['downloader']
handler.command = /^(tt4|ttdl4|tiktok4)$/i
handler.limit = true

export default handler