let handler = async (m,{conn,args})=>{

let user = global.db.data.users[m.sender]

let type = (args[0]||'').toLowerCase()

if(type !== 'Bot')
return conn.reply(m.chat,'Gunakan:\n.setrpg Bot',m)

if(user.Bot)
return conn.reply(m.chat,'Kamu sudah menjadi Adventurer Bot',m)

user.Bot = true

conn.reply(m.chat,`
🌸 *Bot RPG* ❀

Selamat datang Adventurer!

Sekarang kamu bisa berburu monster dengan:
.huntanya
`,m)

}

handler.help = ['setrpg']
handler.tags = ['rpg']
handler.command = /^(setrpg)$/i
handler.group = true

export default handler

