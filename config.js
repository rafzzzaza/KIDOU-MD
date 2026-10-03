import { watchFile, unwatchFile } from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

global.owner = [
  ['6285142128717', 'Rafzzz', true]
];
global.mods = [];

global.version = '6.0.0';
global.namebot = 'Kidou';
global.author = 'Rafzzz';

// JANGAN DI UBAH 
global.ownerNumber = global.owner?.[0]?.[0] || '';
global.ownerName = global.owner?.[0]?.[1] || 'Owner';

// =========================
// BOT IDENTITY & INFO
// =========================
global.info = {
    botName: global.namebot,
    ownerName: global.ownerName,
    authorName: global.author,
    version: '6.0.0',
    description: 'WhatsApp Multi-Device Bot powered by Baileys'
};

// =========================
// LINKS & SOCIAL MEDIA
// =========================
global.links = {
    github: 'https://github.com/rafzzzaza',
    githubRepo: 'https://github.com/rafzzzaza/Bot-MD',
    whatsappChannel: 'https://whatsapp.com/channel/0029Vb8NkwtLCoWw9VdO9E2S',
    newsletter: {
        jid: '120363432093486679@newsletter',
        name: global.namebot
    },
    officialGroup: 'https://chat.whatsapp.com/xxx',
    backupGroup: '1234567890@g.us'
};

// =========================
// UI & MEDIA CONFIG
// =========================
global.images = {
    ratio_16_9: {
        url: 'https://github.com/rafzzzaza/gambar/blob/main/menu.png?raw=true',
        width: 1080,
        height: 369 
    },
    ratio_1_1: {
        url: 'https://raw.githubusercontent.com/rafzzzaza/gambar/refs/heads/main/Bot_FAMILY.png',
        url_fallback: 'https://raw.githubusercontent.com/rafzzzaza/gambar/refs/heads/main/Bot_FAMILY.png'
    }
};

global.ownerInfo = {
    title: global.ownerName,
    subtitle: `Founder of ${global.namebot} Family`,
    secondary_subtitle: 'editor',
    entity_id: 867051314767696,
    entity_url: global.links?.whatsappChannel || 'https://whatsapp.com/channel/0029Vb8NkwtLCoWw9VdO9E2S'
};

// =========================
// SYSTEM MESSAGES
// =========================
global.msg = {
    wait: '✨ _Wait..._',
    error: '🚩 Terjadi Kesalahan...',
    success: '✅ Berhasil!',
    
    rowner: 'Ara~ command ini hanya untuk developer bot',
    owner: 'Nee~ command ini khusus owner',
    mods: 'Hehe~ hanya moderator yang boleh pakai fitur ini',
    premium: 'Ups~ fitur ini khusus pengguna premium',
    group: 'Ara~ command ini cuma bisa dipakai di grup',
    private: 'Nee~ command ini hanya bisa dipakai di chat pribadi',
    admin: 'Hehe~ hanya admin grup yang boleh pakai fitur ini',
    botAdmin: 'Ara~ jadikan aku admin dulu',
    unreg: 'Ara~ kamu belum terdaftar.\nDaftar dulu ya kalau mau pakai fiturku~\n.daftar Nama.Umur',
    
    welcome: `✨ Waku Waku~

Welcome @user

🌸 Member ke-@member
👥 Total Member: @member

Selamat datang di @subject`,
    
    bye: `🥜 Hweh...

Goodbye @user

Terima kasih sudah menjadi bagian dari @subject

👥 Sisa Member: @member`,
    
    promote: '@user sekarang admin',
    demote: '@user bukan admin lagi',
    
    groupDesc: '```Description has been changed to```\n@desc',
    groupSubject: '```Subject has been changed to```\n@subject',
    groupIcon: '```Icon has been changed to```',
    groupRevoke: '```Group link has been changed to```\n@revoke'
};

// Backward compatibility
global.wait = global.msg.wait;
global.eror = global.msg.error;
global.backupGroupLink = global.links.backupGroup;

// =========================
// SECRETS / API KEYS
// =========================
// Semua key di bawah ini WAJIB diisi lewat environment variable.
// Lihat .env.example. JANGAN pernah commit nilai aslinya ke git.
global.secrets = {
	// Google API key (YouTube InnerTube, Google Drive, Firebase)
	googleApiKey: process.env.GOOGLE_API_KEY || '',

	// Alight Motion premium generator (Firebase anon key)
	amFirebaseKey: process.env.AM_FIREBASE_KEY || '',

	// GitHub personal access token untuk uploader (tools-upgh)
	// Butuh scope: repo
	githubToken: process.env.GITHUB_TOKEN || '',

	// Token internal Alight Motion (AMPrem) - opsional
	amInternalToken: process.env.AM_INTERNAL_TOKEN || '',

	// Refresh token PhotoRoom untuk removebg - opsional
	photoroomRefreshToken: process.env.PHOTOROOM_REFRESH_TOKEN || '',
};

// nama repo GitHub untuk uploader
global.uploaderRepo = {
	username: process.env.UPLOADER_USERNAME || 'rafzzzaza',
	repo: process.env.UPLOADER_REPO || 'uploader',
	folder: process.env.UPLOADER_FOLDER || '',
	branch: process.env.UPLOADER_BRANCH || 'main',
};

// =========================
// PAYMENT CONFIG
// =========================
global.pakasir = {
	slug: process.env.PAKASIR_SLUG || 'hilman',
	apikey: process.env.PAKASIR_APIKEY || '',
	expired: 30,
};

global.stickpack = 'Sticker';
global.stickauth = global.namebot;

global.multiplier = 38;

// =========================
// PANEL CONFIG
// =========================
global.panel = {
  domain: "https://bokepytta.com",
  ptla: "ptla_xxxxxxxxx",
  ptlc: "ptlc_xxxxxxxxx",
  egg: 15,
  loc: 1
};

// =========================
// API ENDPOINTS
// =========================
global.APIs = {
    faa: 'https://api-faa.my.id',
    deline: 'https://api.deline.web.id'
}

// =========================
// COLORS & STYLING
// =========================
global.colors = {
    primary: '❀',
    secondary: '✦',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳',
    done: '✔️'
}

/*============== EMOJI ==============*/
global.rpg = {
	emoticon(string) {
		string = string.toLowerCase();
		let emot = {
			level: '📊',
			limit: '🎫',
			health: '❤️',
			stamina: '🔋',
			exp: '✨',
			money: '💹',
			bank: '🏦',
			potion: '🥤',
			diamond: '💎',
			common: '📦',
			uncommon: '🛍️',
			mythic: '🎁',
			legendary: '🗃️',
			superior: '💼',
			pet: '🔖',
			trash: '🗑',
			armor: '🥼',
			sword: '⚔️',
			pickaxe: '⛏️',
			fishingrod: '🎣',
			wood: '🪵',
			rock: '🪨',
			string: '🕸️',
			horse: '🐴',
			cat: '🐱',
			dog: '🐶',
			fox: '🦊',
			petFood: '🍖',
			iron: '⛓️',
			gold: '🪙',
			emerald: '❇️',
			upgrader: '🧰',
		};
		let results = Object.keys(emot)
			.map((v) => [v, new RegExp(v, 'gi')])
			.filter((v) => v[1].test(string));
		if (!results.length) return '';
		else return emot[results[0][0]];
	},
};

let file = fileURLToPath(import.meta.url);
watchFile(file, () => {
	unwatchFile(file);
	console.log(chalk.redBright("Update 'config.js'"));
	import(`${import.meta.url}?update=${Date.now()}`);
});

