let handler = async (m, { conn, args, usedPrefix, command }) => {
  let who

  if (m.mentionedJid?.length) {
    who = m.mentionedJid[0]
  } else if (m.quoted) {
    who = m.quoted.sender
  } else if (args[1]) {
    let nomor = args[1].replace(/[^0-9]/g, '')
    if (nomor.length < 10) throw 'Nomor tidak valid'
    who = nomor + '@s.whatsapp.net'
  } else {
    throw `Siapa yang ingin diubah status premium-nya?\n\nContoh:\n${usedPrefix + command} 30 @tag\n${usedPrefix + command} 30 628xxxx`
  }

  if (typeof who !== 'string') throw 'Target tidak valid'

  if (!global.db.data.users[who]) {
    global.db.data.users[who] = {
      name: await conn.getName(who) || 'Unknown',
      limit: 10,
      exp: 0,
      level: 0,
      register: false,
      premium: false,
      premiumTime: 0
    }
  }

  let user = global.db.data.users[who]

  switch (command) {
    case 'addprem':
    case 'tambahprem':
    case '+prem': {
      if (!args[0]) throw `Mau berapa hari??`

      if (args[0].toLowerCase() === 'permanen') {
        user.premium = true
        user.premiumTime = Infinity

        let teks =
`✅ *Success*

👤 User : @${who.split('@')[0]}
⭐ Status : Premium Permanen
📅 Tanggal : ${new Date().toLocaleDateString()}`

        // hanya mengirim pesan ke tempat command dijalankan (misal: di grup)
        await conn.sendMessage(m.chat, { text: teks, mentions: [who] }, { quoted: m })
      } else {
        if (isNaN(args[0])) throw `⚠️ hanya angka!\n\nContoh:\n${usedPrefix + command} 30 628xxxx`

        let hari = parseInt(args[0])
        let ms = 86400000 * hari
        let now = Date.now()

        if (user.premiumTime && user.premiumTime > now) {
          user.premiumTime += ms
        } else {
          user.premiumTime = now + ms
        }

        user.premium = true

        let tanggalBerakhir = new Date(user.premiumTime).toLocaleDateString()

        let teks =
`✅ *Success*

👤 User : @${who.split('@')[0]}
🕒 Durasi : ${hari} Hari
📅 Mulai : ${new Date(now).toLocaleDateString()}
📅 Berakhir : ${tanggalBerakhir}`

        // hanya mengirim pesan ke tempat command dijalankan
        await conn.sendMessage(m.chat, { text: teks, mentions: [who] }, { quoted: m })
      }
      break
    }

    case 'delprem':
    case 'hapusprem':
    case '-prem': {
      user.premium = false
      user.premiumTime = 0

      let teks =
`⚠️ *Success*

👤 User : @${who.split('@')[0]}
Status premium dihapus pada ${new Date().toLocaleDateString()}.`

      // hanya mengirim pesan ke tempat command dijalankan
      await conn.sendMessage(m.chat, { text: teks, mentions: [who] }, { quoted: m })
      break
    }

    default:
      throw `Command tidak valid. Gunakan addprem atau delprem.`
  }
}

handler.help = ['addprem <hari> <@tag/nomor>']
handler.tags = ['owner']
handler.command = /^(add|tambah|\+)prem$/i
handler.owner = true

export default handler
