import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@rexxhayanasi/elaina-baileys'
import sharp from 'sharp'

const THUMB_URL = 'https://raw.githubusercontent.com/rafzzzaza/uploader/main/1789256195642-922.jpg'
const URL = 'https://whatsapp.com/channel/0029VbDvzjlDzgTJY34zxT1H'

let handler = async (m, { conn }) => {
  const text = `🌸 *INFO SCRIPT ${global.namebot || "Bot"}*

Waku waku~! 👀✨

❏ Lagi cari script bot WhatsApp yang keren?

❏ Script *${global.namebot || "Bot"}* tersedia dan selalu mendapatkan update terbaru melalui Channel WhatsApp.

❏ Di channel tersedia:
• Update fitur terbaru 🚀
• Informasi script 📜
• Perbaikan bug 🔧
• Pengumuman penting 📢

❏ Tekan tombol di bawah untuk melihat informasi lebih lanjut yaa~ 🌸

✨ Arigatou sudah mampir! `

  // 1. Ambil & proses gambar HD
  const thumb = await getThumbUrl(THUMB_URL)
  const hdImage = await createHighQualityThumbnail(conn, thumb)

  // Jika gagal ambil gambar, batalkan pengiriman pesan
  if (!hdImage) return m.reply('Waduh, Bot gagal mengambil gambar thumbnail-nya 🤧')

  const msg = generateWAMessageFromContent(
    m.chat,
    proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            // 2. MASUKKAN GAMBAR KE HEADER
            header: {
              title: `「 ${global.namebot || 'Bot'} 𝐌𝐃 • 𝐒𝐜𝐫𝐢𝐩𝐭 」\n`, 
              hasMediaAttachment: true,
              imageMessage: hdImage // Menggunakan hasil generate HD kamu!
            },
            body: {
              text: text
            },
            footer: {
              text: `🩷 Bot • ${global.namebot || "Bot"}`
            },
            // 3. SETTING TOMBOL
            nativeFlowMessage: {
              buttons: [
                {
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: '🌸 Channel WhatsApp',
                    url: URL,
                    merchant_url: URL
                  })
                }
              ]
            }
          }
        }
      }
    }),
    {
      userJid: m.sender,
      quoted: m
    }
  )

  await conn.relayMessage(
    m.chat,
    msg.message,
    {
      messageId: msg.key.id
    }
  )
}

handler.help = ['sc', 'script']
handler.tags = ['info']
handler.command = /^(sc|script)$/i

export default handler

// --- Helper Functions ---
async function getThumbUrl(url) {
  try {
    const res = await fetch(url)
    const raw = Buffer.from(await res.arrayBuffer())

    return await sharp(raw)
      .resize(1280, 720, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch {
    return Buffer.alloc(0)
  }
}

async function createHighQualityThumbnail(conn, thumb) {
  try {
    if (!thumb.length) return null

    const { imageMessage } = await prepareWAMessageMedia(
      { image: thumb },
      {
        upload: conn.waUploadToServer
      }
    )

    imageMessage.width = 1280
    imageMessage.height = 720

    return imageMessage
  } catch {
    return null
  }
}


