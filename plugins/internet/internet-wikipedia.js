let handler = async (m, { text }) => {
  if (!text) return m.reply('Masukkan kata kunci')

  let url = 'https://api-faa.my.id/faa/Wikipedia-search?q=' + encodeURIComponent(text)

  let res = await fetch(url)
  if (!res.ok) return m.reply('Gagal mengambil data')

  let data = await res.json()
  if (!data?.result?.status) return m.reply('Tidak ditemukan')

  let r = data.result

  let hasil = `📚 *WIKIPEDIA*\n\n`
  hasil += `📌 *Judul:* ${r.title}\n`
  hasil += `🔗 *Link:* ${r.url}\n\n`
  hasil += `📝 *Ringkasan:*\n${r.summary.trim()}`

  if (r.search_results?.length) {
    hasil += `\n\n🔍 *Hasil Terkait:*`
    r.search_results.slice(0, 3).forEach((v, i) => {
      hasil += `\n${i + 1}. ${v.title}\n   ${v.snippet}`
    })
  }

  m.reply(hasil)
}

handler.help = ['wiki', 'wikipedia']
handler.tags = ['internet']
handler.command = /^(wiki|wikipedia|wikiid)$/i

export default handler
