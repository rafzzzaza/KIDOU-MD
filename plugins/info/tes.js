let handler = async (m, { conn }) => {

  let BotQuotes = [
    'Waku waku~ Bot datang! ✨',
    'Hehe~ Bot dipanggil ya? (≧▽≦)',
    'Bot tahu kamu manggil Bot~ ',
    'Chi chi~ Bot siap membantu!',
    'Ada yang bisa dibantu? 😌',
    'Bot suka membantu sesama ✨',
    'Eh? Ada misi baru buat Bot? 👀',
    'Waku waku intensifies!! ✨'
  ]

  let text = BotQuotes[Math.floor(Math.random() * BotQuotes.length)]

  await conn.sendMessage(
    m.chat,
    {
      text
    },
    {
      quoted: {
        key: {
          fromMe: false,
          participant: '0@s.whatsapp.net',
          remoteJid: 'status@broadcast'
        },
        message: {
           conversation: `🌸 ${global.namebot || "Bot"} 🌸`
        }
      }
    }
  )
}

handler.customPrefix = /^(Bot|bot|tes|test)$/i
handler.command = new RegExp

export default handler


