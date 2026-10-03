import {
    readdirSync,
    existsSync,
    rmSync
} from 'fs';

import {
    join
} from 'path';

import pino from 'pino';

import {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    Browsers
} from '@rexxhayanasi/elaina-baileys';

import {
    makeWASocket
} from './simple.js';

const SESSIONS_DIR = './sessions/jadibot';

global.jadibotConns =
    global.jadibotConns || new Map();


/* ============================================================
 * NORMALIZE NOMOR
 * ============================================================ */

function normalizeNumber(rawNumber) {
    let number = String(rawNumber || '')
        .replace(/[^0-9]/g, '');

    if (number.startsWith('0')) {
        number =
            '62' + number.slice(1);
    }

    return number;
}


/* ============================================================
 * TRACK SENT MESSAGE
 * ============================================================ */

function trackSentMessages(conn) {
    conn.sentMessageIds =
        new Set();

    const originalSendMessage =
        conn.sendMessage.bind(conn);

    conn.sendMessage =
        async (...args) => {

            const result =
                await originalSendMessage(...args);

            if (result?.key?.id) {

                conn.sentMessageIds.add(
                    result.key.id
                );

                setTimeout(() => {

                    conn.sentMessageIds?.delete(
                        result.key.id
                    );

                }, 15000);
            }

            return result;
        };

    return conn;
}


/* ============================================================
 * BUILD SUB CONNECTION
 * ============================================================ */

async function buildSubConn(sessionPath) {

    const {
        state,
        saveCreds
    } =
        await useMultiFileAuthState(
            sessionPath
        );

    const {
        version
    } =
        await fetchLatestBaileysVersion();

    const handlerModule =
        await import('../handler.js');


    const subConn =
        trackSentMessages(
            makeWASocket({

                version,

                logger:
                    pino({
                        level: 'silent'
                    }),

                printQRInTerminal:
                    false,

                browser:
                    Browsers.ubuntu('Edge'),

                auth: {

                    creds:
                        state.creds,

                    keys:
                        makeCacheableSignalKeyStore(
                            state.keys,

                            pino()
                                .child({
                                    level: 'silent',
                                    stream: 'store'
                                })
                        )
                },

                generateHighQualityLinkPreview:
                    true,

                connectTimeoutMs:
                    60000,

                defaultQueryTimeoutMs:
                    0,

                syncFullHistory:
                    false,

                shouldSyncHistoryMessage:
                    () => false,

                markOnlineOnConnect:
                    true,

                keepAliveIntervalMs:
                    30000,

                retryRequestDelayMs:
                    250,

                maxMsgRetryCount:
                    5,

                shouldIgnoreJid:
                    () => false
            })
        );


    /* ========================================================
     * SIMPAN CREDENTIALS
     * ======================================================== */

    subConn.ev.on(
        'creds.update',
        saveCreds
    );


    /* ========================================================
     * HANDLER UTAMA
     * ======================================================== */

    if (
        typeof handlerModule.handler ===
        'function'
    ) {

        subConn.handler =
            handlerModule.handler.bind(
                subConn
            );

        subConn.ev.on(
            'messages.upsert',
            subConn.handler
        );
    }


    /* ========================================================
     * GROUP PARTICIPANTS
     * ======================================================== */

    if (
        typeof handlerModule.participantsUpdate ===
        'function'
    ) {

        subConn.participantsUpdate =
            handlerModule.participantsUpdate.bind(
                subConn
            );

        subConn.ev.on(
            'group-participants.update',
            subConn.participantsUpdate
        );
    }


    /* ========================================================
     * GROUP UPDATE
     * ======================================================== */

    if (
        typeof handlerModule.groupsUpdate ===
        'function'
    ) {

        subConn.groupsUpdate =
            handlerModule.groupsUpdate.bind(
                subConn
            );

        subConn.ev.on(
            'groups.update',
            subConn.groupsUpdate
        );
    }


    /* ========================================================
     * DELETE MESSAGE
     * ======================================================== */

    if (
        typeof handlerModule.deleteUpdate ===
        'function'
    ) {

        subConn.onDelete =
            handlerModule.deleteUpdate.bind(
                subConn
            );

        subConn.ev.on(
            'message.delete',
            subConn.onDelete
        );
    }


    /*
     * Simpan authState supaya
     * bisa dipakai di luar.
     */

    subConn.authState =
        state;

    subConn.saveCreds =
        saveCreds;


    return subConn;
}


/* ============================================================
 * CONNECT SUB BOT
 * ============================================================ */

async function connectSubBot({
    number,
    sessionPath,
    mainConn,
    notifyChat,
    needsPairing = false
}) {

    /*
     * Kalau sudah ada koneksi lama,
     * tutup terlebih dahulu.
     */

    const oldConn =
        global.jadibotConns.get(
            number
        );

    if (oldConn) {

        try {
            oldConn.ev.removeAllListeners();
        } catch {}

        try {
            oldConn.ws?.close();
        } catch {}

        global.jadibotConns.delete(
            number
        );
    }


    const subConn =
        await buildSubConn(
            sessionPath
        );


    global.jadibotConns.set(
        number,
        subConn
    );


    let pairingRequested =
        false;


    /* ========================================================
     * CONNECTION UPDATE
     * ======================================================== */

    subConn.ev.on(
        'connection.update',
        async update => {

            const {
                connection,
                lastDisconnect
            } = update;


            /* ================================================
             * CONNECTING
             * ================================================ */

            if (
                connection ===
                'connecting'
            ) {

                console.log(
                    `[JADIBOT] ${number} connecting...`
                );
            }


            /* ================================================
             * REQUEST PAIRING CODE
             * ================================================ */

            if (
                needsPairing &&
                !subConn.authState.creds.registered &&
                !pairingRequested
            ) {

                pairingRequested =
                    true;


                setTimeout(
                    async () => {

                        try {

                            let code =
                                await subConn.requestPairingCode(
                                    number
                                );


                            code =
                                code
                                    ?.match(
                                        /.{1,4}/g
                                    )
                                    ?.join('-') ||
                                code;


                            console.log(
                                `[JADIBOT] Pairing ${number}: ${code}`
                            );


                            if (
                                notifyChat &&
                                mainConn
                            ) {

                                await mainConn
                                    .sendMessage(
                                        notifyChat,
                                        {
                                            text:
                                                `🔑 *KODE PAIRING JADIBOT*\n\n` +
                                                `Nomor: *${number}*\n\n` +
                                                `Kode:\n` +
                                                `*${code}*\n\n` +
                                                `Buka WhatsApp > Perangkat Tertaut > ` +
                                                `Tautkan dengan nomor telepon, ` +
                                                `lalu masukkan kode di atas.`
                                        }
                                    )
                                    .catch(() => {});
                            }

                        } catch (e) {

                            console.error(
                                `[JADIBOT] Gagal request pairing ${number}:`,
                                e
                            );


                            global.jadibotConns.delete(
                                number
                            );


                            try {

                                rmSync(
                                    sessionPath,
                                    {
                                        recursive:
                                            true,
                                        force:
                                            true
                                    }
                                );

                            } catch {}


                            if (
                                notifyChat &&
                                mainConn
                            ) {

                                await mainConn
                                    .sendMessage(
                                        notifyChat,
                                        {
                                            text:
                                                `❌ Gagal membuat kode pairing untuk *${number}*.\n` +
                                                `Silakan coba lagi.`
                                        }
                                    )
                                    .catch(() => {});
                            }
                        }

                    },
                    2500
                );
            }


            /* ================================================
             * OPEN
             * ================================================ */

            if (
                connection ===
                'open'
            ) {

                global.jadibotConns.set(
                    number,
                    subConn
                );


                console.log(
                    `[JADIBOT] ${number} berhasil terhubung`
                );


                /*
                 * hanya kirim notifikasi
                 * ketika proses pairing baru.
                 */

                if (
                    notifyChat &&
                    mainConn
                ) {

                    await mainConn
                        .sendMessage(
                            notifyChat,
                            {
                                text:
                                    `✅ *JADIBOT BERHASIL!*\n\n` +
                                    `Nomor *${number}* sekarang aktif sebagai sub-bot 🎉`
                            }
                        )
                        .catch(() => {});
                }
            }


            /* ================================================
             * CLOSE
             * ================================================ */

            if (
                connection ===
                'close'
            ) {

                const statusCode =
                    lastDisconnect
                        ?.error
                        ?.output
                        ?.statusCode;


                console.log(
                    `[JADIBOT] ${number} disconnected (${statusCode || 'unknown'})`
                );


                global.jadibotConns.delete(
                    number
                );


                /* ============================================
                 * LOGGED OUT
                 * ============================================ */

                if (
                    statusCode ===
                    DisconnectReason.loggedOut
                ) {

                    try {

                        rmSync(
                            sessionPath,
                            {
                                recursive:
                                    true,
                                force:
                                    true
                            }
                        );

                    } catch {}


                    console.log(
                        `[JADIBOT] ${number} logout, session dihapus`
                    );


                    if (
                        notifyChat &&
                        mainConn
                    ) {

                        await mainConn
                            .sendMessage(
                                notifyChat,
                                {
                                    text:
                                        `🔌 Sub-bot *${number}* logout.\n` +
                                        `Session sudah dihapus.`
                                }
                            )
                            .catch(() => {});
                    }


                    return;
                }


                /* ============================================
                 * AUTO RECONNECT
                 * ============================================ */

                console.log(
                    `[JADIBOT] ${number} mencoba reconnect...`
                );


                setTimeout(
                    () => {

                        connectSubBot({
                            number,
                            sessionPath,
                            mainConn,
                            notifyChat:
                                null,
                            needsPairing:
                                false
                        })
                            .catch(e => {

                                console.error(
                                    `[JADIBOT] Reconnect ${number} gagal:`,
                                    e
                                );

                            });

                    },
                    3000
                );
            }
        }
    );


    return subConn;
}


/* ============================================================
 * START SUB BOT
 * ============================================================ */

export async function startSubBot(
    m,
    mainConn,
    rawNumber
) {

    const number =
        normalizeNumber(
            rawNumber
        );


    if (
        !number ||
        number.length < 7 ||
        number.length > 15
    ) {

        return m.reply(
            `❌ *Format nomor salah!*\n\n` +
            `Contoh:\n` +
            `*.jadibot 628123456789*`
        );
    }


    if (
        global.jadibotConns.has(
            number
        )
    ) {

        return m.reply(
            `⚠️ Nomor *${number}* sudah menjadi sub-bot.`
        );
    }


    const sessionPath =
        join(
            SESSIONS_DIR,
            number
        );


    await m.reply(
        `⏳ *Membuat sesi jadibot...*\n\n` +
        `Nomor: *${number}*\n\n` +
        `Tunggu sebentar sampai kode pairing dikirim.`
    );


    try {

        await connectSubBot({
            number,
            sessionPath,
            mainConn,
            notifyChat:
                m.chat,
            needsPairing:
                true
        });

    } catch (e) {

        console.error(
            `[JADIBOT] Start ${number} gagal:`,
            e
        );


        global.jadibotConns.delete(
            number
        );


        try {

            rmSync(
                sessionPath,
                {
                    recursive:
                        true,
                    force:
                        true
                }
            );

        } catch {}


        return m.reply(
            `❌ Gagal membuat sesi jadibot.\n\n` +
            `Error: ${e.message || e}`
        );
    }
}


/* ============================================================
 * STOP SUB BOT
 * ============================================================ */

export async function stopSubBot(
    rawNumber
) {

    const number =
        normalizeNumber(
            rawNumber
        );


    const subConn =
        global.jadibotConns.get(
            number
        );


    if (!subConn) {
        return false;
    }


    try {
        subConn.ev.removeAllListeners();
    } catch {}


    try {
        subConn.ws?.close();
    } catch {}


    try {
        subConn.end?.();
    } catch {}


    global.jadibotConns.delete(
        number
    );


    try {

        rmSync(
            join(
                SESSIONS_DIR,
                number
            ),
            {
                recursive:
                    true,
                force:
                    true
            }
        );

    } catch {}


    console.log(
        `[JADIBOT] ${number} dihentikan`
    );


    return true;
}


/* ============================================================
 * RESTORE SUB BOT
 * ============================================================ */

export async function restoreSubBots(
    mainConn
) {

    if (
        !existsSync(
            SESSIONS_DIR
        )
    ) {

        return;
    }


    const folders =
        readdirSync(
            SESSIONS_DIR,
            {
                withFileTypes:
                    true
            }
        )
            .filter(
                d =>
                    d.isDirectory()
            );


    if (
        !folders.length
    ) {

        console.log(
            '[JADIBOT] Tidak ada session untuk direstore.'
        );

        return;
    }


    console.log(
        `[JADIBOT] Menemukan ${folders.length} session.`
    );


    for (
        const folder
        of folders
    ) {

        const number =
            folder.name;


        const sessionPath =
            join(
                SESSIONS_DIR,
                number
            );


        const credsFile =
            join(
                sessionPath,
                'creds.json'
            );


        if (
            !existsSync(
                credsFile
            )
        ) {

            console.log(
                `[JADIBOT] Skip ${number}, creds.json tidak ada.`
            );

            continue;
        }


        /*
         * Jangan restore dua kali.
         */

        if (
            global.jadibotConns.has(
                number
            )
        ) {

            continue;
        }


        try {

            await connectSubBot({
                number,
                sessionPath,
                mainConn,
                notifyChat:
                    null,
                needsPairing:
                    false
            });


            console.log(
                `[JADIBOT] Restore session ${number}`
            );

        } catch (e) {

            console.error(
                `[JADIBOT] Gagal restore ${number}:`,
                e
            );
        }


        /*
         * Jeda antar koneksi.
         */

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    1000
                )
        );
    }
}


/* ============================================================
 * GET SUB BOT
 * ============================================================ */

export function getSubBot(
    rawNumber
) {

    const number =
        normalizeNumber(
            rawNumber
        );

    return global.jadibotConns.get(
        number
    );
}


/* ============================================================
 * CEK SUB BOT
 * ============================================================ */

export function hasSubBot(
    rawNumber
) {

    const number =
        normalizeNumber(
            rawNumber
        );

    return global.jadibotConns.has(
        number
    );
}


/* ============================================================
 * LIST SUB BOT
 * ============================================================ */

export function getSubBots() {

    return Array.from(
        global.jadibotConns.entries()
    );
}


/* ============================================================
 * JUMLAH SUB BOT
 * ============================================================ */

export function getSubBotCount() {

    return global.jadibotConns.size;
}
