/*
==========================================================
Plugins By © Amane Ofc — Alight Motion Premium Verifier
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

    // Sinkronisasi akseskey global di base kamu
    const akseskey = global.theresav || global.therasav || "hammprem";

    if (!text) {
        return m.reply(`🔐 *Format Salah kak!*\n\nKetik: *${usedPrefix + command} email | link_url*\n\nContoh:\n*${usedPrefix + command} emailkamu@gmail.com | https://alight-creative.firebaseapp.com/...*`);
    }

    // Memecah teks parameter berdasarkan tanda pipa "|"
    let [email, link] = text.split('|').map(v => v ? v.trim() : '');

    if (!email || !link) {
        return m.reply(`⚠️ *Input Kurang Lengkap kak!*\n\nPastikan memasukkan email dan link tautan yang sudah kamu salin dengan pemisah tanda pipa (\`|\`).\n\n*Contoh:* ${usedPrefix + command} ${email || "email"} | ${link || "link_url"}`);
    }

    // Validasi format email biar aman
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return m.reply('❌ *Error:* Format email yang kamu masukkan tidak valid kak!');
    }

    // Reaksi animasi proses verifikasi dimulai
    await conn.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

    try {
        // Eksekusi penembakan API verifikasi premium yang baru
        const url = `https://ndxhs.my.id/alightmotion/verify?akseskey=${akseskey}&email=${encodeURIComponent(email)}&link=${encodeURIComponent(link)}`;
        const { data } = await axios.get(url);

        // Validasi respon berdasarkan struktur JSON: { status: true, message: "..." }
        if (data && data.status === true) {
            
            // Konversi durasi biar teks report-nya lebih rapi dibaca user
            let rawDuration = data.data?.duration || "";
            let durationText = rawDuration === "1_year" ? "1 Tahun" : rawDuration.replace("_", " ");

            // 📑 LAYOUT NOTIFIKASI AKUN AKTIF PREMIUM
            let captionSuccess = `🎉  *───「 ＡＭ  ＶＥＲＩＦＩＣＡＴＩＯＮ 」───*\n` +
                                 `⚡ _${data.message || "Verifikasi akun berhasil!"}_\n` +
                                 `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                                 ` ◦ *Email Terdaftar:* \`${data.data?.email || email}\`\n` +
                                 ` ◦ *Tipe Sukses:* \`${data.data?.type || "success"}\`\n` +
                                 ` ◦ *Durasi Paket:* \`${durationText}\` ⏳\n\n` +
                                 `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                 `📋 *INFORMASI USER:*\n\n` +
                                 `• Akun Alight Motion kamu sekarang sudah resmi menjadi **PRO / PREMIUM** kak!\n` +
                                 `• Silakan buka aplikasi Alight Motion di HP kamu, lalu log in menggunakan email \`${data.data?.email || email}\` tersebut.\n` +
                                 `• Nikmati semua fitur premium, efek berbayar, dan ekspor video tanpa watermark sepuasnya.\n` +
                                 `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                 `_Engine System by Amane Ofc_`;

            await m.reply(captionSuccess);
            await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
        } else {
            throw new Error(data?.message || "Gagal memverifikasi akun ke server database.");
        }

    } catch (e) {
        console.error(e);
        await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ *Verification Error:* ${e.response?.data?.message || e.message}`);
    }
};

handler.help = ["amverify <email> | <link>"];
handler.tags = ["premium", "tools"];
handler.command = /^(amverify|alightverify|viam|verifyam)$/i;
// handler.premium = true; // Dihapus agar bypass bisa bekerja!
export default handler;
