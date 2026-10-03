let handler = async (m, { conn, text }) => {
    text = m.quoted?.text || text
    if (!text) return m.reply('Reply / masukkan teks')

    await m.react('🕒')

    try {
        const url = `https://aqul-brat.hf.space?text=${encodeURIComponent(text)}`

        await conn.sendSticker(
            m.chat,
            url,
            m,
            {
                packname: global.stickpack || global.namebot,
                packpublish: global.stickauth || global.author
            }
        )

        await m.react('✅')
    } catch (e) {
        console.error(e)
        await m.react('❌')
        m.reply('Gagal membuat sticker.')
    }
}

handler.help = ['brat <text>']
handler.tags = ['sticker']
handler.command = /^brat$/i
handler.limit = true
handler.group = true

export default handler
