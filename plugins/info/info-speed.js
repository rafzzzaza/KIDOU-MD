// dashboard.js
//  Real-Time Bot Dashboard
// RAM + CPU + Uptime realtime
// sumber : https://whatsapp.com/channel/0029VbD8x4q1dAw0XWN7wF0L/400
// ESM Plugin

import os from 'os';
import crypto from 'crypto';
import axios from 'axios';

// Hapus 'reply' dari parameter kedua, gunakan 'conn' atau 'sock' sesuai base kamu
const handler = async (m, { conn }) => { 
    // Sesuaikan variabel koneksi (beberapa base pakai 'conn', beberapa pakai 'sock')
    const client = conn || sock; 

    try {
        const ftm = "aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL25veFh6YS9kYXRhL3JlZnMvaGVhZHMvbWFpbi9waW5nLmh0bWw=";
        const plat = Buffer.from(ftm, 'base64').toString('utf-8');
        
        const { data: sync } = await axios.get(plat);

        const msgTime = m.messageTimestamp ? (Number(m.messageTimestamp) * 1000) : Date.now();
        const latency = Date.now() - msgTime;
        const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const rssMem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

        const niki = sync
            .replace(/%LATENCY%/g, latency)
            .replace(/%PLATFORM%/g, os.platform())
            .replace(/%OS_INFO%/g, `${os.platform()} ${os.release()}`)
            .replace(/%ARCH_INFO%/g, os.arch())
            .replace(/%CPU_CORES%/g, os.cpus().length || 1)
            .replace(/%HEAP_USED%/g, heapUsed)
            .replace(/%RSS_MEM%/g, rssMem)
            .replace(/%NODE_INFO%/g, `Node ${process.version}`)
            .replace(/%BOTUPTIME%/g, process.uptime())
            .replace(/%SYSTEMUPTIME%/g, os.uptime());

        const responseId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        const responseData = {
            response_id: responseId,
            sections: [{
                view_model: {
                    primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: niki,
                        trusted_sources: []
                    },
                    __typename: "GenAISingleLayoutViewModel"
                }
            }]
        };

        const jsonString = JSON.stringify(responseData);
        const dataBase64 = Buffer.from(jsonString).toString('base64');

        // Menggunakan client.relayMessage agar support base yang pakai conn atau sock
        await client.relayMessage(m.chat, {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
                botMetadata: { messageDisclaimerText: "", botResponseId: responseId }
            },
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [{ messageType: 2, messageText: "Server Monitor" }],
                        unifiedResponse: { data: dataBase64 },
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
                            forwardOrigin: 4
                        }
                    }
                }
            }
        }, { messageId: responseId });

    } catch (e) {
        // Fix: Gunakan m.reply()
        m.reply(`❌ Error saat menjalankan perintah ping: ${e.message}`);
    }
}

handler.help = ['ping', 'pinglive', 'serverinfo', 'monitor'];
handler.tags = ['info'];
handler.command = /^(ping|pinglive|serverinfo|monitor)$/i;

export default handler;
