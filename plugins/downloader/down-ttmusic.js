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

    const regex = /https?:\/\/(?:www\.|vt\.|vm\.|m\.)?tiktok\.com\/[^\s]+/i
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

    if (!data?.music) {
      return m.reply('❌ Audio tidak ditemukan.')
    }

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: data.music },
        mimetype: 'audio/mpeg',
        fileName: `${data.title || 'tiktok'}.mp3`,
        ptt: false
      },
      { quoted: m }
    )
  } catch (e) {
    console.error(e)
    m.reply('❌ Gagal memproses audio TikTok.')
  }
}

handler.help = ['ttmp3', 'tiktokmp3']
handler.tags = ['downloader']
handler.command = /^(ttmp3|tiktokmp3)$/i
handler.limit = true

export default handler
