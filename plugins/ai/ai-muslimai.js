let oota = async (m, {
    conn,
    text
}) => {
    try {
        const res = await fetch(`https://api.ootaizumi.web.id/ai/muslim-ai?text=${text ? text : "assalamualaikum"}`);

        const response = await res.json();
        if (!response?.message) return m.reply("❌ Gomene gada response message!");

        m.reply(response?.message);
    } catch (e) {
        m.reply("❌ Gomene Error Mungkin lu kebanyakan request!");
    }
}

oota.help = oota.command = ["muslim-ai"]
oota.tags = ["ai"];
/* ============================================================
 * DISABLED - endpoint mati
 * Alasan: api.ootaizumi.web.id/ai/muslim-ai -> HTTP 404
 * "The deployment could not be found on Vercel." (3/3 percobaan)
 * Host resolve, tapi deployment Vercel-nya sudah dihapus.
 * Diperbaiki 2026-10-04. Hapus baris ini setelah endpoint
 * diganti dengan API yang hidup.
 * ============================================================ */
oota.disabled = true

export default oota
