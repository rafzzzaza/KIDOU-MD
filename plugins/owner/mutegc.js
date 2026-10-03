import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../database');
const MUTE_FILE = path.join(DATA_DIR, 'mutegc.json');

// Pastikan folder dan file database tersedia
function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(MUTE_FILE)) {
    fs.writeFileSync(MUTE_FILE, '[]', 'utf8');
  }
}

// Baca data mute
function readMuteData() {
  ensureDatabase();

  try {
    const data = JSON.parse(fs.readFileSync(MUTE_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Simpan data mute
function saveMuteData(data) {
  ensureDatabase();
  fs.writeFileSync(MUTE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const handler = async (m, { command, usedPrefix }) => {
  // hanya bisa digunakan di dalam grup
  if (!m.isGroup) {
    return m.reply('🏫 Ehehe~ fitur ini cuma bisa dipakai di grup yaa~ 🌸');
  }

  const groupId = m.chat;
  const muteList = readMuteData();

  // =========================
  // MUTE GROUP
  // =========================
  if (command === 'mutegc') {
    if (muteList.includes(groupId)) {
      return m.reply(
        '⚠️ *Grup ini sudah di-mute!*\n\n' +
        'Shhh~ Bot lagi diem di sini 🤫🌸\n\n' +
        `⟡ Untuk mengaktifkan: *${usedPrefix}unmutegc*`
      );
    }

    muteList.push(groupId);
    saveMuteData(muteList);

    return m.reply(
      '🔇 *Mute Group Berhasil!*\n\n' +
      'Shhh~ Bot sekarang diem dulu di grup ini 🤫🌸\n' +
      'Bot tidak akan membalas pesan di grup ini lagi~ ehehe 💤\n\n' +
      `⟡ Aktifkan lagi: *${usedPrefix}unmutegc*`
    );
  }

  // =========================
  // UNMUTE GROUP
  // =========================
  if (command === 'unmutegc') {
    const index = muteList.indexOf(groupId);

    if (index === -1) {
      return m.reply('💭 Hmm~ grup ini belum di-mute kok, waku waku~ 🌸');
    }

    muteList.splice(index, 1);
    saveMuteData(muteList);

    return m.reply(
      '🔊 *Unmute Group Berhasil!*\n\n' +
      'Yay~ Bot sudah boleh ngomong lagi di grup ini! ✨🌸\n' +
      'Waku waku~ ehehe (≧◡≦)'
    );
  }
};

handler.help = ['mutegc', 'unmutegc'];
handler.tags = ['owner'];
handler.command = /^(mutegc|unmutegc)$/i;
handler.owner = true;

export default handler;

