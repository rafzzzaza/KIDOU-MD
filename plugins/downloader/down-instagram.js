import axios from "axios"

async function igdl(url) {
  try {
    const { data } = await axios.get(`https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`, { timeout: 15000 })
    if (data?.status && data?.data) {
      return Array.isArray(data.data) ? data.data : [data.data]
    }
    throw new Error('Gagal mengambil media Instagram.')
  } catch (err) {
    throw new Error(err.message || 'Instagram downloader error.')
  }
}

let handler = async (m, { conn, args, command }) => {
  try {
    if (!args[0]) return m.reply(`*Example:* .${command} https://www.instagram.com/p/xxxx/`)
    await m.react('⏳')
    
    let mediaUrls = await igdl(args[0])
    if (!mediaUrls || !mediaUrls.length) {
      throw new Error('Media tidak ditemukan.')
    }

    for (let url of mediaUrls) {
      if (!url) continue
      
      // Kirim menggunakan URL langsung daripada buffer untuk menghindari file corrupt / gagal play di WA
      let isVideo = url.includes('.mp4') || url.includes('video') || !url.includes('.jpg')
      
      if (isVideo) {
        await conn.sendMessage(m.chat, { 
          video: { url }, 
          caption: `✅ Success • ${global.namebot || 'Bot'}` 
        }, { quoted: m })
      } else {
        await conn.sendMessage(m.chat, { 
          image: { url }, 
          caption: `✅ Success • ${global.namebot || 'Bot'}` 
        }, { quoted: m })
      }
    }
    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    m.reply(`❌ Error: ${e.message}`)
  }
}

handler.help = ['igdl','ig','instagram']
handler.command = ['igdl','ig','instagram']
handler.tags = ['downloader']
handler.limit = true

export default handler
