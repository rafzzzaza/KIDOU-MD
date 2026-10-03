global.spamTracker = global.spamTracker || {};

export async function before(m, { isAdmin, isOwner, isBotAdmin }) {
	const user = global.db.data.users[m.sender];
	const chat = global.db.data.chats[m.chat];

	if (!m.isBaileys || m.mtype === 'protocolMessage' || m.mtype === 'pollUpdateMessage' || m.mtype === 'reactionMessage') return;
	if (!m.msg || !m.message || m.key.remoteJid !== m.chat || user.banned || chat.isBanned) return;

	global.spamTracker[m.sender] = global.spamTracker[m.sender] || { count: 0, lastspam: 0 };
	const now = m.messageTimestamp?.low || m.messageTimestamp;
	const timeDifference = now - global.spamTracker[m.sender].lastspam;

	if (timeDifference < 10) {
		global.spamTracker[m.sender].count++;
		if (global.spamTracker[m.sender].count >= 5 && !isOwner && !isAdmin && !isBotAdmin) {
			user.banned = true;
			global.spamTracker[m.sender].lastspam = now;

			setTimeout(() => {
				user.banned = false;
				global.spamTracker[m.sender].count = 0;

				this.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
			}, 10000);

			return m.reply('⚠️ Kamu telah terbanned tunggu setelah 10 detik..');
		}
	} else {
		global.spamTracker[m.sender].count = 0;
	}

	global.spamTracker[m.sender].lastspam = now;
}
