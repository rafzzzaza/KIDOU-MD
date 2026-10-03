/*
 * CUSTOM NAME
 * Type    : Plugin ESM
 * Creator : rafzzzaza
 */

import { generateWAMessageFromContent, proto } from '@rexxhayanasi/elaina-baileys'

function toSansBold(str) {
  const map = {
    A: '𝗔', B: '𝗕', C: '𝗖', D: '𝗗', E: '𝗘', F: '𝗙', G: '𝗚', H: '𝗛', I: '𝗜', J: '𝗝', K: '𝗞', L: '𝗟', M: '𝗠',
    N: '𝗡', O: '𝗢', P: '𝗣', Q: '𝗤', R: '𝗥', S: '𝗦', T: '𝗧', U: '𝗨', V: '𝗩', W: '𝗪', X: '𝗫', Y: '𝗬', Z: '𝗭',
    a: '𝗮', b: '𝗯', c: '𝗰', d: '𝗱', e: '𝗲', f: '𝗳', g: '𝗴', h: '𝗵', i: '𝗶', j: '𝗷', k: '𝗸', l: '𝗹', m: '𝗺',
    n: '𝗻', o: '𝗼', p: '𝗽', q: '𝗾', r: '𝗿', s: '𝘀', t: '𝘁', u: '𝘂', v: '𝘃', w: '𝘄', x: '𝘅', y: '𝘆', z: '𝘇'
  }
  return str.split('').map(c => map[c] || c).join('')
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) return m.reply(`🌸 *CUSTOM NAME*\n\n` +
    `Cara penggunaan:\n` +
    `*${usedPrefix + command}* ${global.ownerName || 'Owner'}`)

  let name = text.trim()
  
  let list = [
    `${name}x${global.namebot || 'Bot'}`,
    `${name}x 𝖋𝖙 𝘼𝙎𝙉`,
    `—${name}x𝘼𝙎𝙉`,
    `${toSansBold(name)} メ 𝘼𝙎𝙉`
  ]

  let buttons = list.map((item) => ({
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({
      display_text: item,
      copy_code: item
    })
  }))

  let textResult = `1. ➤ \`${list[0]}\`\n2. ➤ \`${list[1]}\`\n3. ➤ \`${list[2]}\`\n4. ➤ \`${list[3]}\`\n\n*Klik untuk menyalin teks!*`

  let msg = generateWAMessageFromContent(m.chat, proto.Message.fromObject({
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ${global.namebot || 'Bot'} • 𝐂𝐮𝐬𝐭𝐨𝐦 𝐍𝐚𝐦𝐞 」\n`,
          body: { text: textResult },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: {
            buttons: buttons
          }
        }
      }
    }
  }), { userJid: m.sender, quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

handler.help = ['customname', 'cn']
handler.tags = ['tools']
handler.command = /^(customname|cn)$/i

export default handler
