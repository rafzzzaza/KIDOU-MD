import didyoumean from 'didyoumean'
import similarity from 'similarity'

let handler = m => m

handler.before = async function (m, { match, usedPrefix }) {
  if (!m.text) return

  if ((usedPrefix = (match[0] || '')[0])) {
    let noPrefix = m.text.slice(1).trim()
    if (!noPrefix) return

    let alias = Object.values(global.plugins)
      .filter(v => v.help && !v.disabled)
      .flatMap(v => v.help)

    if (!alias.length) return

    let mean = didyoumean(noPrefix, alias)
    if (!mean) return
    if (noPrefix.toLowerCase() === mean.toLowerCase()) return

    let sim = similarity(noPrefix.toLowerCase(), mean.toLowerCase())
    let percent = Math.round(sim * 100)

    let text = `
૮₍ ˃ ⤙ ˂ ₎ა

	A-asisten bingung sama command itu...

Mungkin maksud kamu:
❀ *${usedPrefix + mean}*

🎯 Kemiripan: *${percent}%*
🥜 Coba ketik lagi yaa~
`.trim()

    await this.sendMessage(
      m.chat,
      {
        text,
        contextInfo: {
          mentionedJid: [m.sender],
          forwardingScore: 999,
          isForwarded: true
        }
      },
      { quoted: m }
    )
  }
}

export default handler
