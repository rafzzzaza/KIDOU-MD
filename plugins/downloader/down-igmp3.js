import axios from 'axios'
import cheerio from 'cheerio'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) throw `Contoh:\n${usedPrefix + command} https://www.instagram.com/reel/xxxxx/`

  await m.react('🕒')

  try {
    let { data } = await axios.post(
      'https://reelsvideo.io/reel/',
      new URLSearchParams({
        id: text,
        locale: 'id',
        'cf-turnstile-response': '',
        tt: 'a66b23d8bfa4878536d788ac3d33d1a6',
        ts: Math.floor(Date.now() / 1000)
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'HX-Request': 'true',
          'HX-Trigger': 'main-form',
          'HX-Target': 'target',
          'HX-Current-URL': 'https://reelsvideo.io/id',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://reelsvideo.io/id'
        },
        timeout: 15000
      }
    )

    const $ = cheerio.load(data)
    const mp3Link = $('a.type_audio').attr('href')

    if (!mp3Link) throw new Error('Audio tidak tersedia di reel ini.')

    await conn.sendMessage(m.chat, {
      audio: { url: mp3Link },
      mimetype: 'audio/mpeg',
      caption: `✅ Success • ${global.namebot || 'Bot'}`
    }, { quoted: m })

    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    m.reply(typeof e === 'string' ? e : `❌ Gagal mengambil audio Instagram: ${e.message || 'Error'}`)
  }
}

handler.help = ['igaudio', 'igmp3']
handler.tags = ['downloader']
handler.command = /^(igaudio|igmp3)$/i
handler.limit = true

export default handler
