// STICKER WIKI ( search pack sticker)
// type : Plugin ESM 
// Source : https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K
// source Scrape : https://whatsapp.com/channel/0029Vb2mOzL1Hsq0lIEHoR0N/572
import axios from 'axios'
import cheerio from 'cheerio'
import { sticker } from '../../lib/sticker.js'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) throw `Masukkan kata kunci untuk cari stiker!\n\nContoh:\n${usedPrefix + command} blue archive`

  let links = await searchByQuery(text)
  if (!links.length) throw '❌ Tidak ditemukan hasil stiker untuk kata kunci tersebut.'

  let res = await download(links[0])
  if (!res || !res.sticker.length) throw '❌ Tidak ditemukan file stiker yang dapat diunduh.'

  await m.reply(`📦 *${res.title}*\nMengirim 10 stiker...`)

  let packname = 'Kurumi - MD'
  let author = 'By Hilman'

  for (let url of res.sticker.slice(0, 10)) {
    try {
      let imgBuffer = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).then(res => res.data)

      let stiker = await sticker(imgBuffer, false, packname, author)
      if (stiker) await conn.sendFile(m.chat, stiker, 'sticker.webp', '', m)
    } catch (e) {
      console.error('❌ Gagal stiker:', url)
    }
  }
}

handler.help = ['stikwiki <kata kunci>']
handler.tags = ['sticker']
handler.command = /^stikwiki$/i
handler.limit = true

export default handler

// === SCRAPER ===

async function searchByQuery(query) {
  const url = "https://stickers.wiki/_actions/searchTags/"
  try {
    const { data } = await axios.post(url, { query }, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        Origin: "https://stickers.wiki",
        Referer: "https://stickers.wiki/id/telegram/search/",
      },
      timeout: 20000,
    })

    if (!Array.isArray(data) || data.length < 3) return []

    // Respons-nya format "devalue": data[0] = daftar indeks ke object pack,
    // lalu tiap object { i, s, n, ... } memakai INTEGER sebagai pointer ke
    // elemen lain di array yang sama. Jadi slug ada di data[obj.s], BUKAN
    // di data[idx + 1].
    const indices = data[0]
    if (!Array.isArray(indices)) return []

    const deref = (v) =>
      typeof v === 'number' && v >= 0 && v < data.length ? data[v] : v

    const slugs = new Set()

    indices.forEach((idx) => {
      if (typeof idx !== 'number' || idx < 0 || idx >= data.length) return
      const item = data[idx]
      if (!item || typeof item !== 'object') return

      const slug = deref(item.s)
      if (typeof slug === 'string' && /^[a-z0-9][a-z0-9_-]{2,}$/i.test(slug)) {
        slugs.add(slug)
      }
    })

    const links = []
    slugs.forEach((slug) => {
      links.push(`https://stickers.wiki/id/telegram/${slug}/`)
    })

    return links
  } catch (err) {
    console.error("Search Error:", err.message)
    return []
  }
}

async function download(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      timeout: 25000,
      // sticker.wiki redirect ke /404/ kalau slug tidak ada; tanpa ini
      // axios lempar sebelum sempat membaca halaman
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    })

    const html = typeof data === 'string' ? data : String(data)
    const $ = cheerio.load(html)
    const title =
      $("h1.line-clamp-2.w-full.text-center.text-2xl.font-semibold").text().trim() ||
      $('h1').first().text().trim() ||
      'Sticker Pack'

    const sticker = []
    // ambil semua ld+json di halaman, tidak cuma yang di dalam sticker-dialog
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html())
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const it of items) {
          if (it && typeof it.contentUrl === 'string' && /\.webp$/i.test(it.contentUrl)) {
            sticker.push(it.contentUrl)
          }
        }
      } catch {}
    })

    // fallback: regex polos kalau format ld+json berubah
    if (!sticker.length) {
      const matches = html.match(/https:\/\/assets\.stickers\.wiki\/img\/[a-f0-9]+\.webp/gi)
      if (matches) sticker.push(...[...new Set(matches)])
    }

    return { title, sticker: [...new Set(sticker)] }
  } catch (err) {
    console.error("Download Error:", err.message)
    return null
  }
}
