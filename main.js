import fs from 'fs';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { format } from 'util';
import { parentPort } from 'worker_threads';
import path, { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import { createRequire } from 'module';
import { ffmpegPath, ffprobePath, usingBundledFfmpeg, resolveFromPath, isWindowsSystemBinary } from './lib/ffmpeg-path.js';

import chalk from 'chalk';
import pino from 'pino';
import syntaxerror from 'syntax-error';
import { Low, JSONFile } from 'lowdb';

import { makeWASocket, protoType, serialize } from './lib/simple.js';
import {
    useMultiFileAuthState,
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} from '@rexxhayanasi/elaina-baileys';

/* ============================================================
 * JADIBOT LIBRARY
 * ============================================================ */
import {
    startSubBot, stopSubBot, restoreSubBots, getSubBot,
    hasSubBot, getSubBots, getSubBotCount
} from './lib/jadibot.js';

/* ============================================================
 * GLOBAL PATH
 * ============================================================ */
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
    return rmPrefix
        ? (/file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL)
        : pathToFileURL(pathURL).toString();
};

global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true));
};

global.__require = function require(dir = import.meta.url) {
    return createRequire(dir);
};

const __dirname = global.__dirname(import.meta.url);

/* ============================================================
 * GLOBAL
 * ============================================================ */
global.opts = global.opts || {};
global.prefix = global.prefix || /^[./#!]/;
global.stopped = false;

/* ============================================================
 * ENVIRONMENT (.env) - HARUS sebelum config.js
 * ============================================================ */
try {
    const { loadEnv } = await import('./lib/env.js');
    loadEnv('.env');
} catch (e) {
    console.log('Gagal memuat .env:', e.message);
}

/* ============================================================
 * CONFIG
 * ============================================================ */
try {
    if (fs.existsSync('./config.js')) {
        await import('./config.js');
        console.log('Config loaded');
    } else {
        console.log('config.js tidak ditemukan! Membuat default...');
        fs.writeFileSync('./config.js', `
global.owner = ['6283873043770'];
global.anticall = true;
`);
    }
} catch (e) {
    console.log('Error loading config:', e.message);
}

/* ============================================================
 * BAILEYS PROTOTYPE
 * ============================================================ */
protoType();
serialize();

/* ============================================================
 * DATABASE
 * ============================================================ */
global.db = new Low(new JSONFile('database.json'));

global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) {
        return new Promise(resolve => {
            const timer = setInterval(async () => {
                if (!global.db.READ) {
                    clearInterval(timer);
                    resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
                }
            }, 1000);
        });
    }

    if (global.db.data !== null) return;

    global.db.READ = true;
    await global.db.read().catch(console.error);
    global.db.READ = null;

    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        ...(global.db.data || {})
    };
};

await global.loadDatabase();

/* ============================================================
 * DATABASE REPAIR
 * ============================================================ */
console.log('Repairing database...');
let repaired = 0;

for (const id in global.db.data.users) {
    const user = global.db.data.users[id];
    if (!user) continue;

    if (!Number.isFinite(user.exp)) { user.exp = 0; repaired++; }
    if (!Number.isFinite(user.level)) { user.level = 0; repaired++; }
    if (!Number.isFinite(user.money)) { user.money = 0; repaired++; }
    if (!Number.isFinite(user.limit)) { user.limit = 50; repaired++; }

    user.premiumTime ??= 0;
    user.lastclaim ??= 0;
    user.lastWarn ??= 0;
}

console.log(`Repair selesai (${repaired} field diperbaiki)`);

/* ============================================================
 * MAIN AUTH
 * ============================================================ */
if (fs.existsSync('./sessions/creds.json')) {
    try {
        const creds = JSON.parse(fs.readFileSync('./sessions/creds.json', 'utf-8'));
        if (!creds || !creds.registered) {
            console.log(chalk.yellow('Sesi belum terdaftar / baru, mereset folder sessions...'));
            fs.rmSync('./sessions', { recursive: true, force: true });
        }
    } catch {
        fs.rmSync('./sessions', { recursive: true, force: true });
    }
}

const { state, saveCreds } = await useMultiFileAuthState('sessions');
const { version } = await fetchLatestBaileysVersion();

/* ============================================================
 * CONNECTION OPTIONS
 * ============================================================ */
const connectionOptions = {
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    printQRInTerminal: false
};

/* ============================================================
 * MAIN CONNECTION
 * ============================================================ */
global.conn = makeWASocket(connectionOptions);

/* ============================================================
 * PAIRING FUNCTION
 * ============================================================ */
global.pairingRequested = false;
global.pairingInputShown = false;
global.requestPairing = async function() {
    if (global.pairingRequested || global.conn?.authState?.creds?.registered) return;
    if (global.pairingInputShown) return;
    global.pairingInputShown = true;

    const readline = await import('node:readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = q => new Promise(resolve => rl.question(q, resolve));

    try {
        console.log(chalk.cyan(`\n╭────────「 ${global.namebot || 'Bot'} 」────────╮`));
        console.log(chalk.cyan('│  🔐 MANUAL PAIRING MODE'));
        console.log(chalk.cyan('│  Nomor tidak diambil dari config.js'));
        console.log(chalk.cyan('╰─────────────────────────────╯'));
        let phoneNumber = String(await ask(chalk.yellow('📱 Masukkan nomor WhatsApp: ')))
            .replace(/\D/g, '').replace(/^0+/, '');
        if (!phoneNumber || phoneNumber.length < 8) {
            console.log(chalk.red('❌ Nomor tidak valid. Jalankan ulang bot.'));
            rl.close();
            global.pairingInputShown = false;
            return;
        }
        global.pairingRequested = true;
        console.log(chalk.blue(`\n⏳ Generating pairing code untuk +${phoneNumber}...`));
        let code = await global.conn.requestPairingCode(phoneNumber , 'KIDOUMD1');
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(chalk.black(chalk.bgGreen(' PAIRING CODE ')) + ' ' + chalk.white(code));
        console.log(chalk.green('\n✅ Masukkan code di WhatsApp → Perangkat tertaut → Tautkan dengan nomor telepon.\n'));
        rl.close();
    } catch (e) {
        global.pairingRequested = false;
        global.pairingInputShown = false;
        try { rl.close(); } catch {}
        console.log(chalk.red('❌ Error pairing:'), e.message);
    }
};

/* ============================================================
 * DATABASE AUTO SAVE
 * ============================================================ */
let isDbWriting = false;
if (global.db) {
    global.dbInterval = setInterval(async () => {
        if (isDbWriting || !global.db?.data) return;
        
        isDbWriting = true;
        try {
            await global.db.write().catch(console.error);
        } finally {
            isDbWriting = false;
        }
        
        if ((global.support || {}).find) {
            const tmp = [tmpdir(), 'tmp'];
            tmp.forEach(filename => {
                spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']);
            });
        }
    }, 5000);
}

/* ============================================================
 * CHANNEL FOLLOW
 * ============================================================ */
// const anu = [
//     "120363409623385879@newsletter",
//     "120363403527946427@newsletter"
// ];
let followed = false;

/* ============================================================
 * JADIBOT RESTORE FLAG
 * ============================================================ */
let jadibotRestored = false;

/* ============================================================
 * CONNECTION UPDATE
 * ============================================================ */
async function connectionUpdate(update) {
    const { receivedPendingNotifications, connection, lastDisconnect, isOnline } = update;
    global.stopped = connection;

    if (connection === 'connecting') {
        console.log(chalk.redBright('Mengaktifkan Bot, Mohon tunggu sebentar...'));
        // Pairing utama dipanggil manual setelah koneksi siap. Tidak auto-pair di event connecting.
    } else if (connection === 'open') {
        console.log(chalk.green('Tersambung'));

        if (!jadibotRestored) {
            jadibotRestored = true;
            try {
                await restoreSubBots(global.conn);
            } catch (e) {
                console.error(chalk.red('[JADIBOT] Gagal restore:'), e);
            }
        }

    //     if (!followed) {
    //         followed = true;
    //         for (let id of anu) {
    //             try {
    //                 if (global.conn && typeof global.conn.newsletterFollow === 'function') {
    //                     await global.conn.newsletterFollow(id);
    //                     console.log(chalk.green(`Follow newsletter: ${id}`));
    //                 }
    //             } catch (e) {
    //                 console.log(chalk.red(`Gagal follow newsletter: ${e.message}`));
    //             }
    //         }
    //     }
    }

    if (isOnline === true) console.log(chalk.green('Status Aktif'));
    else if (isOnline === false) console.log(chalk.red('Status Mati'));

    if (receivedPendingNotifications) console.log(chalk.yellow('Menunggu Pesan Baru'));

    if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(chalk.red('Koneksi terputus:'), lastDisconnect?.error?.message || reason || 'Closed');
        if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
            console.log(chalk.red('Sesi logout/rusak, mereset folder sessions...'));
            try { fs.rmSync('./sessions', { recursive: true, force: true }); } catch {}
        }
        global.pairingRequested = false;
        await global.reloadHandler(true);
    }

    if (global.db.data == null) await global.loadDatabase();
}

/* ============================================================
 * ERROR HANDLER
 * ============================================================ */
process.on('uncaughtException', console.error);

/* ============================================================
 * HANDLER
 * ============================================================ */
let isInit = true;
let handler = await import('./handler.js');

/* ============================================================
 * RELOAD HANDLER
 * ============================================================ */
global.reloadHandler = async function (restatConn) {
    try {
        const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
        if (Object.keys(Handler || {}).length) handler = Handler;
    } catch (e) {
        console.error(e);
    }

    if (restatConn) {
        const oldChats = global.conn.chats;
        try { global.conn.ws.close(); } catch {}
        global.conn.ev.removeAllListeners();
        global.conn = makeWASocket(connectionOptions, { chats: oldChats });
        isInit = true;
    }

    if (!isInit) {
        global.conn.ev.off('messages.upsert', global.conn.handler);
        global.conn.ev.off('group-participants.update', global.conn.participantsUpdate);
        global.conn.ev.off('groups.update', global.conn.groupsUpdate);
        global.conn.ev.off('message.delete', global.conn.onDelete);
        global.conn.ev.off('connection.update', global.conn.connectionUpdate);
        global.conn.ev.off('creds.update', global.conn.credsUpdate);
    }

    /* ====================================================
     * WELCOME
     * ==================================================== */
    global.conn.welcome = '✦━━━━━━[ WELCOME ]━━━━━━✦\n\n┏––––––━━━━━━━━•\n│⫹⫺ @subject\n┣━━━━━━━━┅┅┅\n│( 👋 Hallo @user)\n├[ INTRO ]—\n│ Nama: \n│ Umur: \n│ Gender:\n┗––––––━━┅┅┅\n\n––––––┅┅ DESCRIPTION ┅┅––––––\n@desc';
    global.conn.bye = '✦━━━━━━[ GOOD BYE ]━━━━━━✦\nSayonara @user 👋( ╹▽╹ )';
    global.conn.spromote = '@user sekarang admin!';
    global.conn.sdemote = '@user sekarang bukan admin!';
    global.conn.sDesc = 'Deskripsi telah diubah ke \n@desc';
    global.conn.sSubject = 'Judul grup telah diubah ke \n@subject';
    global.conn.sIcon = 'Icon grup telah diubah!';
    global.conn.sRevoke = 'Link group telah diubah ke \n@revoke';

    /* ====================================================
     * HANDLER BIND
     * ==================================================== */
    global.conn.handler = handler.handler.bind(global.conn);
    global.conn.participantsUpdate = handler.participantsUpdate.bind(global.conn);
    global.conn.groupsUpdate = handler.groupsUpdate.bind(global.conn);
    global.conn.onDelete = handler.deleteUpdate.bind(global.conn);
    global.conn.connectionUpdate = connectionUpdate.bind(global.conn);
    global.conn.credsUpdate = saveCreds.bind(global.conn);

    /* ====================================================
     * ANTICALL
     * ==================================================== */
    global.conn.ev.on('call', async calls => {
        for (const call of calls) {
            const { id, from, status } = call;
            const settings = global.db.data.settings?.[global.conn.user?.jid];

            if (status === 'offer' && settings?.anticall) {
                try {
                    await global.conn.rejectCall(id, from);
                    console.log('Menolak panggilan dari', from);
                } catch (e) {}
            }
        }
    });

    /* ====================================================
     * EVENTS
     * ==================================================== */
    global.conn.ev.on('messages.upsert', global.conn.handler);
    global.conn.ev.on('group-participants.update', global.conn.participantsUpdate);
    global.conn.ev.on('groups.update', global.conn.groupsUpdate);
    global.conn.ev.on('message.delete', global.conn.onDelete);
    global.conn.ev.on('connection.update', global.conn.connectionUpdate);
    global.conn.ev.on('creds.update', global.conn.credsUpdate);

    isInit = false;
    return true;
};

/* ============================================================
 * PLUGIN FOLDER
 * ============================================================ */
const pluginFolder = path.resolve(__dirname, 'plugins');
const pluginFilter = filename => /\.js$/i.test(filename) && !filename.startsWith('.');
global.plugins = {};
global.pluginsFolder = pluginFolder;

function getPluginFiles(dir, base = pluginFolder) {
    const result = [];
    if (!fs.existsSync(dir)) return result;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;

        const full = path.join(dir, entry.name);

        // hanya recurse ke dalam ./plugins dan subfoldernya.
        // node_modules/, lib/, root, dll tidak pernah disentuh.
        if (entry.isDirectory()) {
            result.push(...getPluginFiles(full, base));
            continue;
        }

        if (entry.isFile() && pluginFilter(entry.name)) {
            const key = path.relative(base, full).replace(/\\/g, '/');
            result.push({ file: full, key });
        }
    }

    return result;
}

function pluginKey(file) {
    return path.relative(pluginFolder, path.resolve(file)).replace(/\\/g, '/');
}

function validPluginFile(file) {
    const resolved = path.resolve(file);
    return resolved !== pluginFolder &&
        resolved.startsWith(pluginFolder + path.sep) &&
        pluginFilter(path.basename(resolved));
}

/* ============================================================
 * LOAD PLUGINS (RECURSIVE, PLUGINS ONLY)
 * ============================================================ */
async function filesInit() {
    try {
        if (!fs.existsSync(pluginFolder)) {
            fs.mkdirSync(pluginFolder, { recursive: true });
            console.log('Folder ./plugins dibuat.');
            return;
        }

        const pluginFiles = getPluginFiles(pluginFolder)
            .sort((a, b) => a.key.localeCompare(b.key));

        for (const { file, key } of pluginFiles) {
            try {
                const err = syntaxerror(fs.readFileSync(file), key, {
                    sourceType: 'module',
                    allowAwaitOutsideFunction: true
                });

                if (err) {
                    console.error(`Failed to load plugin ${key}: syntax error\n${format(err)}`);
                    continue;
                }

                const module = await import(`${pathToFileURL(file).href}?load=${Date.now()}`);
                global.plugins[key] = module.default || module;
            } catch (e) {
                console.error(`Failed to load plugin ${key}: ${e.message}`);
                delete global.plugins[key];
            }
        }

        global.plugins = Object.fromEntries(
            Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b))
        );

        console.log(`Successfully Loaded ${Object.keys(global.plugins).length} Plugins`);
    } catch (e) {
        console.error('Error loading plugins:', e);
    }
}

await filesInit();

/* ============================================================
 * PLUGIN HOT RELOAD
 * ============================================================ */
async function reloadPluginFile(file) {
    const resolved = path.resolve(file);
    if (!validPluginFile(resolved)) return;
    if (!fs.existsSync(resolved)) return;

    const key = pluginKey(resolved);

    try {
        const err = syntaxerror(fs.readFileSync(resolved), key, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true
        });

        if (err) {
            console.error(`syntax error '${key}'\n${format(err)}`);
            return;
        }

        const module = await import(`${pathToFileURL(resolved).href}?update=${Date.now()}`);
        global.plugins[key] = module.default || module;
        global.plugins = Object.fromEntries(
            Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b))
        );

        console.log(`reloaded plugin '${key}'`);
    } catch (e) {
        console.error(`error loading plugin '${key}'\n${format(e)}`);
    }
}

/* Dipakai base lama juga, tetapi path tetap dikunci ke ./plugins. */
global.reload = async (_ev, filename) => {
    if (!filename) return;

    const raw = filename.toString().replace(/\\/g, '/');
    const full = path.resolve(pluginFolder, raw);

    if (!validPluginFile(full)) return;
    if (fs.existsSync(full)) await reloadPluginFile(full);
    else {
        const key = pluginKey(full);
        delete global.plugins[key];
        console.log(`deleted plugin '${key}'`);
    }
};

/* ============================================================
 * WATCH ALL PLUGIN SUBFOLDERS
 * ============================================================ */
const pluginWatchers = new Map();

function collectPluginDirectories(dir, output = []) {
    if (!fs.existsSync(dir)) return output;

    output.push(dir);

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (!entry.isDirectory()) continue;

        const child = path.join(dir, entry.name);
        collectPluginDirectories(child, output);
    }

    return output;
}

function watchPluginDirectories() {
    const dirs = collectPluginDirectories(pluginFolder);
    const active = new Set(dirs);

    // Hapus watcher untuk folder yang sudah tidak ada.
    for (const [dir, watcher] of pluginWatchers) {
        if (!active.has(dir) || !fs.existsSync(dir)) {
            try { watcher.close(); } catch {}
            pluginWatchers.delete(dir);
        }
    }

    for (const dir of dirs) {
        if (pluginWatchers.has(dir)) continue;

        try {
            const watcher = fs.watch(dir, async (_ev, filename) => {
                if (!filename) return;

                const name = filename.toString();
                if (name.startsWith('.')) return;

                const full = path.resolve(dir, name);

                // Folder baru -> pasang watcher untuk subfolder tersebut.
                if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
                    setTimeout(watchPluginDirectories, 200);
                    return;
                }

                if (!pluginFilter(name)) return;
                if (!validPluginFile(full)) return;

                if (fs.existsSync(full)) {
                    await reloadPluginFile(full);
                } else {
                    const key = pluginKey(full);
                    delete global.plugins[key];
                    console.log(`deleted plugin '${key}'`);
                }
            });

            pluginWatchers.set(dir, watcher);
        } catch (e) {
            console.error(`Failed watching plugin folder ${dir}: ${e.message}`);
        }
    }
}

watchPluginDirectories();

/* ============================================================
 * START HANDLER
 * ============================================================ */
await global.reloadHandler();

/* ============================================================
 * AUTO RESET LIMIT
 * ============================================================ */
console.log('Auto reset system aktif');

global.resetInterval = setInterval(async () => {
    if (!global.db?.data?.users) return;

    let now = new Date();
    if (now.getHours() !== 0 || now.getMinutes() !== 0) return;

    let today = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
    if (global.db.data.lastReset === today) return;

    global.db.data.lastReset = today;
    let limitDefault = 50;
    let users = global.db.data.users;

    for (let jid in users) {
        let user = users[jid];
        if (!user || user.premium || user.premiumTime > 0) continue;
        user.limit = limitDefault;
    }
    console.log(`[AUTO RESET] Limit user direset ke ${limitDefault}`);
}, 60000);

/* ============================================================
 * QUICK TEST
 * ============================================================ */
async function _quickTest() {
    // Resolved npm-installed binaries are used directly; PATH is only a fallback.
    const probe = (bin, args = []) =>
        new Promise(resolve => {
            const child = spawn(bin, args, { stdio: 'ignore' });
            let settled = false;
            const done = value => {
                if (!settled) {
                    settled = true;
                    resolve(value);
                }
            };
            child.on('error', () => done(false));
            child.on('close', code => done(code === 0));
        });

    let [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = await Promise.all([
        probe(ffmpegPath, ['-version']),
        probe(ffprobePath, ['-version']),
        probe(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
        probe('convert', ['--version']),
        probe('magick', ['--version']),
        probe('gm', ['version']),
        probe('find', ['--version'])
    ]);

    // C:\Windows\System32 ships its own convert.exe (FAT->NTFS) and find.exe
    // (text search). Both exit non-zero for foreign flags yet still look
    // "present", so drop them when they resolve inside the Windows dir.
    if (convert && isWindowsSystemBinary(resolveFromPath('convert'))) convert = false;
    if (find && isWindowsSystemBinary(resolveFromPath('find'))) find = false;

    global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find };
    Object.freeze(global.support);

    if (global.support.ffmpeg) {
        console.log(`FFmpeg siap (${usingBundledFfmpeg ? 'bundled via npm' : 'dari PATH'})`);
    } else {
        console.log('FFmpeg tidak ditemukan. Jalankan `npm install` untuk memuat binary bawaan.');
    }

    if (global.support.ffmpeg && !global.support.ffmpegWebp) {
        console.log('Sticker animasi mungkin tidak jalan karena libwebp tidak tersedia.');
    }

    if (!global.support.convert && !global.support.magick && !global.support.gm) {
        console.log('ImageMagick tidak ditemukan. Fitur konversi gambar tambahan akan dilewati.');
    }
}

await _quickTest();
console.log('Quick Test Done');

/* ============================================================
 * READY
 * ============================================================ */
if (!global.conn.authState.creds.registered) {
    setTimeout(() => global.requestPairing(), 1000);
}

console.log(chalk.green('Bot siap digunakan!'));
console.log(chalk.yellow('Scan QR atau masukkan pairing code di WhatsApp'));
