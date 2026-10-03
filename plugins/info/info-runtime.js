import sharp from 'sharp'

let handler = async (m, { conn }) => {
  if (!global.bootTime) global.bootTime = Date.now()

  async function getThumb(input) {
    try {
      let buffer

      if (Buffer.isBuffer(input)) {
        buffer = input
      } else if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
        let res = await fetch(input)
        buffer = Buffer.from(await res.arrayBuffer())
      } else {
        let res = await fetch('https://u.pone.rs/arpqzmrr.jpg')
        buffer = Buffer.from(await res.arrayBuffer())
      }

      return await sharp(buffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer()
    } catch (e) {
      return Buffer.alloc(0)
    }
  }

  const thumb = await getThumb(global.thumb)

  const runtime = Math.floor((Date.now() - global.bootTime) / 1000)
  const days = Math.floor(runtime / 86400)
  const hours = Math.floor((runtime % 86400) / 3600)
  const minutes = Math.floor((runtime % 3600) / 60)
  const seconds = runtime % 60

  const runtimeText = [
    days ? `${days} Hari` : '',
    hours ? `${hours} Jam` : '',
    minutes ? `${minutes} Menit` : '',
    `${seconds} Detik`
  ].filter(Boolean).join(' ')

  const mode = global.opts && global.opts.self ? 'SELF' : 'PUBLIC'

  const totalUsers = global.db && global.db.data && global.db.data.users
    ? Object.keys(global.db.data.users).length
    : 0

  const totalChats = global.db && global.db.data && global.db.data.chats
    ? Object.keys(global.db.data.chats).length
    : 0

  const start = Date.now()
  const ping = Date.now() - start

  await conn.relayMessage(m.chat, {
    buttonsMessage: {
      locationMessage: {
        degreesLatitude: 0,
        degreesLongitude: 0,
        name: `❀ ${global.namebot || 'Bot'} ᴍᴅ ❀`,
        address: global.ownerName || global.author,
        jpegThumbnail: thumb
      },

      contentText:
`🌸 「 Bot SYSTEM STATUS 」 🌸

🤖 Bot     : ${global.namebot || 'Bot'}
📡 Mode    : ${mode}
⚡ Ping    : ${ping} ms
⏳ Runtime : ${runtimeText}
👥 Users   : ${totalUsers}
💬 Chats   : ${totalChats}
✅ Status  : Online

✨ Bot masih aktif dan siap membantu~`,

      footerText: `❀ ${global.namebot || 'Bot'} ᴍᴅ ❀`,

      buttons: [
        {
          buttonId: '.menu',
          buttonText: {
            displayText: '📋 Menu'
          },
          type: 1
        },
        {
          buttonId: '.owner',
          buttonText: {
            displayText: '👑 Owner'
          },
          type: 1
        }
      ],

      headerType: 6
    }
  }, {})
}

handler.help = ['statusbot', 'botinfo', 'infobot', 'runtime', 'alive']
handler.tags = ['info']
handler.command = /^(statusbot|botinfo|infobot|runtime|alive)$/i

export default handler


