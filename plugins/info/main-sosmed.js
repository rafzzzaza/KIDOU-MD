import { sendSocialMedia } from '../../lib/sosial.js'

const handler = async (m, { conn }) => {
    await sendSocialMedia(conn, m.chat, m)
}

handler.help = ['sosmed']
handler.tags = ['main']
handler.command = /^(sosmed|socialmedia|socmed)$/i

export default handler
