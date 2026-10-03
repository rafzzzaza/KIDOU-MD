/**
 * 🎯 TikTok Booster - View & Like Booster
 * Author: Omegatech
 * Version: 2.0
 * Description: Boost TikTok video views and likes using Omegatech API
 * 
 * 📡 OFFICIAL CHANNELS:
 * WhatsApp: https://whatsapp.com/channel/0029Vb785rSBlHpWSitPY61i
 * Telegram: https://t.me/+OrLFsvjjlVM2ZjRk
 * 
 * 🛠️ Features:
 * - Boost TikTok video views
 * - Boost TikTok video likes
 * - Check video status
 * - Real-time processing updates
 * - Rate limited for fair usage
 * 
 * 📝 Commands:
 * - .tiktokboost <url> - Boost a TikTok video
 * - .ttboost <url> - Short form alias
 * - .boosttiktok <url> - Alternate command
 * 
 * ⚠️ Limits: 3 uses per user
 * ⏰ Note: Likes and views take time to register
 */

import axios from 'axios';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) {
        return m.reply(`⚠️ *TikTok Booster*\n\nPlease provide a TikTok video URL\n\nExample: ${usedPrefix + command} https://www.tiktok.com/@username/video/123456789`);
    }

    const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
    if (!urlMatch) {
        return m.reply(`❌ Invalid URL. Please provide a valid TikTok video link.`);
    }

    const tiktokUrl = urlMatch[0];

    if (!tiktokUrl.includes('tiktok.com')) {
        return m.reply(`❌ Please provide a valid TikTok URL.`);
    }

    await m.react('⏳');
    await m.reply(`🔄 *Processing your request...*\n\n📱 Boosting TikTok video:\n${tiktokUrl}`);

    try {
        const apiUrl = `https://example.com/api/tiktok-booster?action=boost&url=${encodeURIComponent(tiktokUrl)}`;
    // NOTE: API original (omegatech-api.dixonomega.tech) mati, ganti dengan alternatif jika ada
        
        const response = await axios.get(apiUrl, {
            timeout: 30000
        });

        if (!response.data.success) {
            throw new Error('API request failed');
        }

        const data = response.data.data;
        const timestamp = new Date(response.data.timestamp).toLocaleString();

        let reply = `🎯 *TIKTOK BOOSTER SUCCESS*\n\n`;
        reply += `━━━━━━━━━━━━━━━━━━━━━\n`;
        reply += `📹 *Title:* ${data.title || 'Not available'}\n`;
        reply += `👤 *Author:* ${data.author || 'Unknown'}\n`;
        reply += `🔗 *Username:* @${data.username || 'Unknown'}\n`;
        reply += `📊 *Status:* ${data.status || 'Processing'}\n`;
        reply += `━━━━━━━━━━━━━━━━━━━━━\n`;
        reply += `\n📝 *Note:* The likes and views take time to register due to personal reasons.\n`;
        reply += `\n🕐 *Timestamp:* ${timestamp}\n`;
        reply += `🔹 *Source:* ${response.data.source || 'Omegatech'}\n`;
        reply += `🔹 *Attribution:* ${response.data.attribution || '@Omegatech-01'}`;

        await m.react('✅');
        await m.reply(reply);

    } catch (error) {
        console.error('TikTok Booster Error:', error);
        await m.react('❌');
        
        let errorMsg = '❌ *Failed to boost TikTok video*\n\n';
        if (error.response) {
            errorMsg += `📌 Status: ${error.response.status}\n`;
            errorMsg += `📌 Error: ${error.response.data?.message || 'Unknown error'}`;
        } else if (error.request) {
            errorMsg += `📌 No response from server. Please try again later.`;
        } else {
            errorMsg += `📌 Error: ${error.message}`;
        }
        
        await m.reply(errorMsg);
    }
};

handler.help = ['tiktokboost <url>'];
handler.tags = ['downloader', 'tools'];
handler.command = /^(tiktokboost|ttboost|boosttiktok)$/i;
handler.limit = 3;
handler.group = false;

export default handler;
