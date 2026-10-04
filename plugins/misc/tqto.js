import sharp from 'sharp'
import { prepareWAMessageMedia } from '@rexxhayanasi/elaina-baileys'

const THUMB_URL = global.images?.ratio_16_9?.url || 'https://github.com/rafzzzaza/gambar/blob/main/menu.png?raw=true'
const URL = global.links?.github || 'https://github.com'

let handler = async (m, { conn }) => {
  const caption = `
╭━━━〔 ✦ PROJECT CREDITS ✦ 〕━━━⬣

> "Open Source is built by people,
> not by code."

◈ Founder
• rafzzzaza

◈ Base
• Kurumi MD 

◈ Library
• Rexxhayanasi/elaina-baileys

◈ Contributors
• ryyn dev rin-md
• Nugraha
• Andik
• Hilman
• Kano
• kaaofc
• Joybee
• rafzzzaza

◈ Infrastructure
• API Providers
• VPS Providers
• Testers

◈ Special Thanks
• All Supporters
• All Users
• My Family
• Everyone who helped this project grow.

━━━━━━━━━━━━━━━━━━━━━━

*"Every line of code has a story.
Thanks for being part of it."* ❤️
`

  const thumb = await getThumbUrl(THUMB_URL)
  const highQualityThumbnail = await createHighQualityThumbnail(conn, thumb)
  const invisible = '\u200B'.repeat(400)

  await conn.sendMessage(
    m.chat,
    {
      text: `${URL}${invisible}

${caption}`,
      linkPreview: {
        'matched-text': URL,
        matchedText: URL,
        canonicalUrl: URL,
            title: `「 ${global.namebot || 'Bot'} 𝐌𝐃 • 𝐂𝐫𝐞𝐝𝐢𝐭𝐬 」`,
        description: 'Special Thanks & Contributors',
        previewType: 0,
        jpegThumbnail: thumb,
        highQualityThumbnail,
        thumbnailUrl: THUMB_URL,
        linkPreviewMetadata: {
          linkMediaDuration: 0,
          socialMediaPostType: 4
        }
      },
      favicon: {
        url: THUMB_URL
      }
    },
    {
      quoted: global.fmeta || m
    }
  )
}

handler.help = ['tqto']
handler.tags = ['info']
handler.command = ['tqto', 'thanks', 'credits']

export default handler

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

