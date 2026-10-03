import { ElainaTLS } from '@elainaa/tls'

let handler = async (m, { text }) => {
  if (!text) {
    return m.reply("Contoh:\n.source https://xxxx")
  }

  try {
    const client = new ElainaTLS()
    const url = text.trim()

    m.reply("wait...")

    const res = await client.fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
        "Accept": "text/html",
        "Referer": "https://google.com"
      }
    })

    if (res.status !== 200) {
      return m.reply("❌ Gagal fetch, status: " + res.status)
    }

    let html = res.body || ""

    if (html.length > 4000) {
      html = html.slice(0, 4000) + "\n\n...[HTML dipotong]"
    }

    await m.reply(
      `✅ *SCRAPE SOURCE SUCCESS*\n` +
      `🌐 URL: ${url}\n` +
      `📡 Status: ${res.status}\n` +
      `🍪 Cookies: ${client.getCookieString() || "-"}\n\n` +
      html
    )

  } catch (e) {
    m.reply("❌ Error:\n" + e.message)
  }
}

handler.help = ['source <url>']
handler.tags = ['tools']
handler.command = /^source$/i
handler.owner = true
handler.limit = false

export default handler
