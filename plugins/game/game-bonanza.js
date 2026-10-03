const handler = async (m, { conn, args }) => {
    global.db = global.db || {};
    global.db.data = global.db.data || {};

    let user = global.db.data.users[m.sender];

    if (args.length < 2) {
        return conn.reply(m.chat, 'Contoh: .fruitspin 10000 10', m);
    }

    let betAmount = parseInt(args[0]);
    let spinCount = parseInt(args[1]);

    if (isNaN(betAmount) || betAmount <= 0) {
        return conn.reply(m.chat, 'Jumlah taruhan tidak valid.', m);
    }

    if (isNaN(spinCount) || spinCount <= 0 || spinCount > 20) {
        return conn.reply(m.chat, 'Jumlah spin harus antara 1 hingga 20.', m);
    }

    if (user.money < betAmount) {
        return conn.reply(m.chat, 'Uang kamu tidak cukup untuk taruhan ini.', m);
    }

    user.money -= betAmount;
    let singleBet = betAmount / spinCount;
    let fruits = ['🍌', '🍎', '🍇', '🍊', '🥭'];
    let fruitValues = {
        '🍌': 100,
        '🍎': 50,
        '🍇': 90,
        '🍊': 70,
        '🥭': 40
    };

    let winPatterns = [
        ['🍎', '🍎', '🍎', '🍎'],
        ['🍌', '🍌', '🍌', '🍌'],
        ['🍇', '🍇', '🍇', '🍇'],
        ['🍊', '🍊', '🍊', '🍊'],
        ['🥭', '🥭', '🥭', '🥭'],
        ['🍎', '🍎', '🍎'],
        ['🍌', '🍌', '🍌'],
        ['🍇', '🍇', '🍇'],
        ['🍊', '🍊', '🍊'],
        ['🥭', '🥭', '🥭'],
        ['🥭'],
        ['🥭', '🍌', '🍎'],
        ['🍎'],
        ['🥭'],
        ['🍇']
    ];

    let wins = 0;
    let losses = 0;
    let totalWinAmount = 0;
    let totalLossAmount = 0;
    let winFruits = { '🍌': 0, '🍎': 0, '🍇': 0, '🍊': 0, '🥭': 0 };
    let scatterWins = 0;

    const generateSpinResult = () => {
        let result = [];
        for (let i = 0; i < 4; i++) {
            let row = [];
            for (let j = 0; j < 5; j++) {
                row.push(fruits[Math.floor(Math.random() * fruits.length)]);
            }
            result.push(row);
        }
        return result;
    };

    const checkWin = (result) => {
        for (let pattern of winPatterns) {
            for (let row of result) {
                let joinedRow = row.join('');
                if (joinedRow.includes(pattern.join(''))) {
                    let fruit = pattern[0];
                    if (pattern.length === 4) {
                        scatterWins++;
                        totalWinAmount += singleBet * fruitValues[fruit];
                        winFruits[fruit]++;
                        return 'Scatter Win';
                    } else {
                        wins++;
                        totalWinAmount += singleBet * fruitValues[fruit];
                        winFruits[fruit]++;
                        return 'Win';
                    }
                }
            }
        }
        return 'Lose';
    };

    // Fetch the user's name using conn.getName
    let userName = await conn.getName(m.sender);

    let initialMessage = await conn.reply(m.chat, `╭──────────────────\n│ *👤nama*: ${userName}\n│ *🎰spin*: ${spinCount}\n│ *🪙bet*: ${betAmount}\n╰──────────────────\n           ❃𝗙𝗥𝗨𝗜𝗧 𝗦𝗣𝗜𝗡❃`, m);

    // Adding a 2-second delay before starting the game
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create countdown and spin effect
    for (let i = 0; i < spinCount; i++) {
        let count = spinCount - i;
        let spinResult = generateSpinResult();
        let spinText = spinResult.map(row => `┃ ${row.join(' │ ')} ┃`).join('\n');
        let spinStatus = checkWin(spinResult);

        if (spinStatus === 'Lose') {
            losses++;
            totalLossAmount += singleBet;
        }

        // Update the message with the decreasing spin count
        let updateMessage = `╭──────────────────\n│ *👤nama*: ${userName}\n│ *🎰spin*: ${count}\n│ *🪙bet*: ${betAmount}\n╰──────────────────\n           ❃𝗙𝗥𝗨𝗜𝗧 𝗦𝗣𝗜𝗡❃\n${spinText}\n\n│ *Money*: ${user.money + totalWinAmount}`;

        if (i === spinCount - 1) {
            updateMessage += `\n╭──────────────────\n│ *🏆win*: ${totalWinAmount}\n│➞ 🍎 Apel: ${winFruits['🍎']}\n│➞ 🍌 Pisang: ${winFruits['🍌']}\n│➞ 🍇 Anggur: ${winFruits['🍇']}\n│➞ 🍊 Jeruk: ${winFruits['🍊']}\n│➞ 🥭 Mangga: ${winFruits['🥭']}\n│ *Lose*: ${totalLossAmount}\n│ *Scater*: ${scatterWins}\n╰──────────────────`;
        }

        await conn.relayMessage(m.chat, {
            protocolMessage: {
                key: initialMessage.key,
                type: 14,
                editedMessage: {
                    conversation: updateMessage
                }
            }
        }, {});

        await new Promise(resolve => setTimeout(resolve, 1000)); // Add a delay between each spin
    }

    user.money += totalWinAmount; // Mengembalikan uang kemenangan ke pengguna
};

handler.help = ['bonanza'];
handler.tags = ['game'];
handler.command = /^(bonanza)$/i;
handler.group = true
handler.register = true

export default handler;
