/*
==========================================================
Plugins By © Amane Ofc — Alight Motion Premium Sender V2
==========================================================
*/

import axios from 'axios';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    // --- TAMBAHAN LOGIKA BYPASS PREMIUM ---
    let chat = global.db.data.chats[m.chat] || {};
    let user = global.db.data.users[m.sender] || {};
    let isPremium = user.premium;
    let amMode = chat.am_mode;

    // Jika AM Mode mati DAN user bukan premium, tolak aksesnya
    if (!amMode && !isPremium) {
        return m.reply(`❌ *Akses Ditolak!*\n\nFitur ini khusus pengguna *Premium*. \nMintalah owner bot untuk mengaktifkan *AM Mode* (Ketik: *${usedPrefix}ammode on*) agar fitur ini gratis digunakan di grup ini!`);
    }
    // ----------------------------------------

    // Toleransi penulisan akseskey global di base kamu
    const akseskey = global.theresav || global.therasav || "hammprem";

    if (!text) {
        return m.reply(`📧 *Format Salah kak!*\n\nKetik: *${usedPrefix + command} <email_kamu>*\n\nContoh:\n*${usedPrefix + command} emailkamu@gmail.com*`);
    }

    // Filter validasi format email asli
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text.trim())) {
        return m.reply('❌ *Error:* Format email yang kamu masukkan tidak valid kak!');
    }

    const email = text.trim();

    // Trigger animasi reaksi loading proses
    await conn.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

    try {
        // Eksekusi penembakan API premium yang baru
        const url = `https://ndxhs.my.id/alightmotion/send?akseskey=${akseskey}&email=${encodeURIComponent(email)}`;
        const { data } = await axios.get(url);

        // Validasi respon berdasarkan struktur JSON: { status: true, message: "..." }
        if (data && data.status === true) {
            
            // 📑 LAYOUT PANDUAN STEP-BY-STEP SESUAI FLOW API
            let captionGuide = `🎉  *───「 ＡＬＩＧＨＴ  ＭＯＴＩＯＮ 」───*\n` +
                               `⚡ _${data.message || "Link verifikasi berhasil dikirim!"}_\n` +
                               `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                               ` ◦ *Target Email:* \`${data.data?.email || email}\`\n` +
                               ` ◦ *Tipe Akses:* \`${data.data?.type || "need_link"}\`\n\n` +
                               `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                               `📋 *LANGKAH AKTIVASI (WAJIB DIIKUTI):*\n\n` +
                               `1️⃣ *Cek Kotak Masuk / Folder Spam:*\n` +
                               `   Buka aplikasi Gmail kamu. Jika tidak ada di kotak masuk utama, langsung cek di **Folder Spam** kak! Cari email terbaru dari *Alight Motion*.\n\n` +
                               `2️⃣ *Tekan Tombol Login:*\n` +
                               `   Buka email tersebut, di dalamnya akan ada tombol bertuliskan **"Login"** atau **"Log in to Alight Motion"**. Silakan diklik/tekan tombol tersebut.\n\n` +
                               `3️⃣ *Salin Tautan / Link Akhir:*\n` +
                               `   Setelah tombol ditekan dan browser terbuka, **Salin/Copy seluruh tautan (URL)** yang muncul di address bar browser kamu itu kak.\n\n` +
                               `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                               `💡 _Selesai disalin? Simpan dulu link-nya, nanti kita lanjutin langkah berikutnya ke bot!_\n` +
                               `_Engine System by Amane Ofc_`;

            await m.reply(captionGuide);
            await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
        } else {
            throw new Error(data?.message || "Gagal mendapatkan respon sukses dari server.");
        }

    } catch (e) {
        console.error(e);
        await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ *Gagal Mengirim Premium:* ${e.response?.data?.message || e.message}`);
    }
};

handler.help = ["ampremium <email>"];
handler.tags = ["premium", "tools"];
handler.command = /^(ampremium|sendam|alightpremium|alightmotion)$/i;
// handler.premium = true; // Dihapus karena validasi premium dilakukan manual di atas!
export default handler;
