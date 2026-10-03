let handler = async (m, { conn }) => {

let user = global.db.data.users[m.sender]
let e = global.rpg.emoticon

let text = `
🌸 *Bot RPG BANK* ❀

${e('money')} Money : ${user.money}
${e('bank')} Bank  : ${user.bank}
💳 ATM : ${user.atm > 0 ? '✔️' : '❌'}

Gunakan:
.deposit jumlah
.withdraw jumlah
.buyatm
.upgradeatm
`.trim()

conn.reply(m.chat, text, global.fstatus)

}

handler.help = ['bank']
handler.tags = ['rpg']
handler.command = /^(bank)$/i
handler.group = true

export default handler

