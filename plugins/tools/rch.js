import axios from 'axios'

const RCH_API_URL = 'https://api.nexadev.my.id/api/rch'
const RCH_API_KEY = 'GateKey22'

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const rchLink = args[0]
    let rchEmojiRaw = args.slice(1).join(' ').trim()

    if (!rchLink || !rchEmojiRaw) {
        return m.reply(
            `Formatnya kurang nih~ 📋\n\n` +
            `*${usedPrefix + command} <link_pesan_channel> <emoji1,emoji2>*\n\n` +
            `Contoh:\n` +
            `*${usedPrefix + command} https://whatsapp.com/channel/xxx/5 😭,🔥*`
        )
    }

    if (!rchLink.includes('whatsapp.com/channel/')) {
        return m.reply(
            'Link channel-nya ga valid nih~ (｡•́︿•̀｡) harus link WhatsApp Channel ya 🌸'
        )
    }

    const rchLinkClean = rchLink
        .split('?')[0]
        .replace(/\/+$/, '')

    const rchSlashCount = (rchLinkClean.match(/\//g) || []).length

    if (rchSlashCount < 5) {
        return m.reply(
            'Kyaa~ itu link *profil* channel, bukan link *pesan* channel nih~ (｡•́︿•̀｡)\n\n' +
            'Buka pesan di channel-nya, lalu ambil link pesannya (ada angka di belakang, misal .../141) ya 🌸'
        )
    }

    if (rchSlashCount !== 5) {
        return m.reply(
            'Link pesan channel-nya ga valid nih~ (｡•́︿•̀｡) coba cek lagi ya 🌸'
        )
    }

    if (!rchEmojiRaw.includes(',')) {
        const rchEmojiChars = Array.from(rchEmojiRaw)
            .filter(ch => ch.trim().length > 0)

        rchEmojiRaw = rchEmojiChars.join(',')
    }

    const rchEmojis = rchEmojiRaw
        .split(',')
        .map(e => e.trim())
        .filter(Boolean)

    if (!rchEmojis.length) {
        return m.reply('Emoji-nya mana kak~ 😅🌸')
    }

    if (rchEmojis.length > 4) {
        return m.reply('Maksimal 4 emoji aja ya kak~ 🌸')
    }

    await conn.sendMessage(m.chat, {
        react: {
            text: '🕒',
            key: m.key
        }
    })

    try {
        const rchApiUrl =
            `${RCH_API_URL}` +
            `?key=${encodeURIComponent(RCH_API_KEY)}` +
            `&url=${encodeURIComponent(rchLink)}` +
            `&reaction=${encodeURIComponent(rchEmojis.join(','))}`

        const { data: rchResult } = await axios.get(rchApiUrl, {
            timeout: 30000
        })

        if (rchResult && rchResult.status === false) {
            throw new Error(
                rchResult.message || 'RCH API mengembalikan status gagal'
            )
        }

        await conn.sendMessage(m.chat, {
            react: {
                text: '✅',
                key: m.key
            }
        })

        await m.reply(
            `— *RCH DONE* —\n\n` +
            `✎ link : ${rchLink}\n` +
            `✎ react : ${rchEmojis.join(', ')}\n` +
            `✎ status : *Sukses*`
        )

    } catch (rchErr) {
        console.error(
            '[rch-error]',
            rchErr.response?.data || rchErr.message
        )

        await conn.sendMessage(m.chat, {
            react: {
                text: '❌',
                key: m.key
            }
        })

        await m.reply(
            `— *RCH GAGAL* —\n\n` +
            `✎ link : ${rchLink}\n` +
            `✎ react : ${rchEmojis.join(', ')}\n` +
            `✎ status : *Gagal, coba lagi ya~*`
        )
    }
}

handler.help = ['rch <link_pesan_channel> <emoji>']
handler.tags = ['tools']
handler.command = /^(rch)$/i

export default handler
