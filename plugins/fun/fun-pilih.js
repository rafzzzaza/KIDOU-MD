import axios from "axios"

let handler = async (m, { conn, text }) => {
    if (!text) {
        return m.reply(
            "Contoh:\n.fakepilih Messi,Ronaldo"
        )
    }

    let [teks1, teks2] = text.split(",")

    if (!teks1 || !teks2) {
        return m.reply(
            "Format salah!\nContoh:\n.fakepilih Messi,Ronaldo"
        )
    }

    try {
        await m.reply("⏳ Membuat gambar...")

        const url = `https://api.synoxcloud.biz.id/canvas/drakehotline?teks1=${encodeURIComponent(teks1.trim())}&teks2=${encodeURIComponent(teks2.trim())}`

        await conn.sendMessage(m.chat, {
            image: { url },
            caption: "✅ Fake Pilih Berhasil"
        }, { quoted: m })

    } catch (e) {
        console.error(e)
        m.reply(`❌ Error: ${e.message}`)
    }
}

handler.help = ["fakepilih <teks1,teks2>"]
handler.tags = ["fun"]
handler.command = /^fakepilih$/i
/* ============================================================
 * DISABLED - endpoint mati
 * Alasan: api.synoxcloud.biz.id/canvas/drakehotline -> hanya
 * mengembalikan HTML landing page Vercel, bukan JSON API (3/3 percobaan).
 * Path API sudah tidak ada; yang tersisa cuma frontend SPA-nya.
 * Diperbaiki 2026-10-04. Hapus baris ini setelah endpoint
 * diganti dengan API yang hidup.
 * ============================================================ */
handler.disabled = true

export default handler
