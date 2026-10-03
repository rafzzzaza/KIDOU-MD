/*
 * Name: id.akinator.com — Games
 * Type: Scraping
 * Base: https://id.akinator.com
 * Developer: t.me/hazeloffc
 *
 * ${global.namebot || "Bot"} ESM Plugin
 */

import * as cheerio from 'cheerio'

var gotScraping = null

async function loadGotScraping() {
    if (!gotScraping) {
        var mod = await import('got-scraping')
        gotScraping = mod.gotScraping
    }

    return gotScraping
}

var BASE_URL = 'https://id.akinator.com'

var THEMES = {
    characters: 1,
    animals: 14,
    objects: 2
}

var ANSWERS = {
    yes: 0,
    no: 1,
    idk: 2,
    probably: 3,
    'probably not': 4
}

/* ============================================================
 * SESSION
 * ========================================================== */

if (!global.akinatorSessions) {
    global.akinatorSessions = new Map()
}

function getUserId(m) {
    return m.sender || m.chat
}

function getSession(m) {
    return global.akinatorSessions.get(getUserId(m))
}

function setSession(m, data) {
    global.akinatorSessions.set(getUserId(m), data)
}

function deleteSession(m) {
    global.akinatorSessions.delete(getUserId(m))
}

/* ============================================================
 * COOKIE
 * ========================================================== */

function updateCookies(jar, headers) {
    var setCookies = headers && headers['set-cookie']

    if (!setCookies) return

    for (var i = 0; i < setCookies.length; i++) {
        var c = setCookies[i]
        var kv = c.split(';')[0]
        var index = kv.indexOf('=')

        if (index === -1) continue

        var key = kv.slice(0, index).trim()
        var value = kv.slice(index + 1).trim()

        jar[key] = value
    }
}

function cookieString(jar) {
    return Object.keys(jar)
        .map(function (key) {
            return key + '=' + jar[key]
        })
        .join('; ')
}

/* ============================================================
 * START
 * ========================================================== */

async function startGame(theme, childMode) {
    var got = await loadGotScraping()

    if (!theme) {
        theme = 'characters'
    }

    if (typeof childMode === 'undefined') {
        childMode = false
    }

    var sid = THEMES[theme] || THEMES.characters
    var jar = {}

    var homeRes = await got({
        url: BASE_URL + '/',
        throwHttpErrors: false
    })

    updateCookies(jar, homeRes.headers)

    var res = await got({
        url: BASE_URL + '/game',
        method: 'POST',
        form: {
            sid: String(sid),
            cm: String(childMode)
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: cookieString(jar)
        },
        throwHttpErrors: false
    })

    updateCookies(jar, res.headers)

    var $ = cheerio.load(res.body)

    var question = $('#question-label').text().trim()

    var sessionMatch = res.body.match(
        /name="session"[^>]*value="([^"]+)"/
    )

    var signatureMatch = res.body.match(
        /name="signature"[^>]*value="([^"]+)"/
    )

    var session = sessionMatch
        ? sessionMatch[1]
        : null

    var signature = signatureMatch
        ? signatureMatch[1]
        : null

    var akitude = 'defi.png'

    var akitudeMatch = res.body.match(
        /akitude[^"]*"[^"]*([^/]+\.png)"/
    )

    if (akitudeMatch) {
        akitude = akitudeMatch[1]
    }

    if (!session || !signature) {
        return {
            status: false,
            error: 'Gagal mengambil session/signature Akinator.'
        }
    }

    return {
        status: true,
        session: session,
        signature: signature,
        question: question,
        step: 0,
        progression: 0,
        akitude: akitude,
        sid: sid,
        theme: theme,
        childMode: childMode,
        cookies: jar
    }
}

/* ============================================================
 * ANSWER
 * ========================================================== */

async function answerGame(game, ans) {
    var got = await loadGotScraping()

    var answerId

    if (typeof ans === 'number') {
        answerId = ans
    } else {
        var answerKey = String(ans).toLowerCase()
        answerId = typeof ANSWERS[answerKey] !== 'undefined'
            ? ANSWERS[answerKey]
            : -1
    }

    if (answerId === -1) {
        return {
            status: false,
            error: 'Jawaban tidak valid.'
        }
    }

    var res = await got({
        url: BASE_URL + '/answer',
        method: 'POST',
        form: {
            step: String(game.step),
            progression: String(game.progression),
            sid: String(game.sid),
            cm: String(game.childMode),
            answer: String(answerId),
            session: game.session,
            signature: game.signature
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: cookieString(game.cookies || {})
        },
        throwHttpErrors: false
    })

    if (res.headers) {
        updateCookies(
            game.cookies || {},
            res.headers
        )
    }

    var data

    try {
        data = JSON.parse(res.body)
    } catch (e) {
        return {
            status: false,
            error: 'Gagal membaca response Akinator.'
        }
    }

    if (data.completion === 'KO') {
        return {
            status: false,
            error: 'Session Akinator sudah expired.'
        }
    }

    if (data.id_proposition) {
        return {
            status: true,
            won: true,
            name: data.name_proposition,
            description: data.description_proposition,
            photo: data.photo,
            pseudo: data.pseudo
        }
    }

    return {
        status: true,
        won: false,
        question: data.question,
        step: parseInt(data.step),
        progression: parseFloat(data.progression),
        akitude: data.akitude
    }
}

/* ============================================================
 * BACK
 * ========================================================== */

async function backGame(game) {
    var got = await loadGotScraping()

    var res = await got({
        url: BASE_URL + '/cancel_answer',
        method: 'POST',
        form: {
            step: String(game.step),
            progression: String(game.progression),
            sid: String(game.sid),
            cm: String(game.childMode),
            session: game.session,
            signature: game.signature
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: cookieString(game.cookies || {})
        },
        throwHttpErrors: false
    })

    var data

    try {
        data = JSON.parse(res.body)
    } catch (e) {
        return {
            status: false,
            error: 'Gagal membaca response Akinator.'
        }
    }

    return {
        status: true,
        question: data.question,
        step: parseInt(data.step),
        progression: parseFloat(data.progression),
        akitude: data.akitude
    }
}

/* ============================================================
 * EXCLUDE
 * ========================================================== */

async function excludeGame(game) {
    var got = await loadGotScraping()

    var res = await got({
        url: BASE_URL + '/exclude',
        method: 'POST',
        form: {
            step: String(game.step),
            progression: String(game.progression),
            sid: String(game.sid),
            cm: String(game.childMode),
            session: game.session,
            signature: game.signature,
            step_last_proposition: String(game.step)
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: cookieString(game.cookies || {})
        },
        throwHttpErrors: false,
        followRedirect: true
    })

    try {
        var data = JSON.parse(res.body)

        return {
            status: true,
            question: data.question,
            step: parseInt(data.step),
            progression: parseFloat(data.progression),
            akitude: data.akitude
        }
    } catch (e) {
        var $ = cheerio.load(res.body)
        var question = $('#question-label').text().trim()

        if (!question) {
            return {
                status: false,
                error: 'Akinator menolak exclude.'
            }
        }

        var newSession = res.body.match(
            /name="session"[^>]*value="([^"]+)"/
        )

        var newSignature = res.body.match(
            /name="signature"[^>]*value="([^"]+)"/
        )

        return {
            status: true,
            question: question,
            step: 0,
            progression: 0,
            akitude: 'defi.png',
            newSession: newSession
                ? newSession[1]
                : game.session,
            newSignature: newSignature
                ? newSignature[1]
                : game.signature
        }
    }
}

/* ============================================================
 * QUESTION TEXT
 * ========================================================== */

function questionText(game) {
    return (
        '╭───〔 🎩 AKINATOR 〕───\n' +
        '│\n' +
        '│ ❓ ' + game.question + '\n' +
        '│\n' +
        '│ 1. Ya\n' +
        '│ 2. Tidak\n' +
        '│ 3. Tidak tahu\n' +
        '│ 4. Mungkin\n' +
        '│ 5. Mungkin tidak\n' +
        '│\n' +
        '│ Progress: ' + game.progression + '%\n' +
        '│ Step: ' + game.step + '\n' +
        '│\n' +
        '╰─────────────────────\n\n' +
        'Balas dengan:\n' +
        '.akinator 1\n' +
        '.akinator 2\n' +
        '.akinator 3\n' +
        '.akinator 4\n' +
        '.akinator 5\n\n' +
        'Ketik .akinator stop untuk berhenti.'
    )
}

/* ============================================================
 * HANDLER
 * ========================================================== */

var handler = async function (m, _ref) {
    var conn = _ref.conn
    var args = _ref.args
    var usedPrefix = _ref.usedPrefix
    var command = _ref.command

    var sub = args[0]
        ? String(args[0]).toLowerCase()
        : ''

    /* --------------------------------------------------------
     * STOP
     * ------------------------------------------------------ */

    if (sub === 'stop' || sub === 'cancel') {
        if (!getSession(m)) {
            return m.reply(
                '❌ Kamu sedang tidak bermain Akinator.'
            )
        }

        deleteSession(m)

        return m.reply(
            '🛑 Permainan Akinator dihentikan.'
        )
    }

    /* --------------------------------------------------------
     * BACK
     * ------------------------------------------------------ */

    if (sub === 'back' || sub === 'mundur') {
        var gameBack = getSession(m)

        if (!gameBack) {
            return m.reply(
                '❌ Belum ada permainan Akinator.'
            )
        }

        try {
            var resultBack = await backGame(gameBack)

            if (!resultBack.status) {
                deleteSession(m)
                return m.reply(
                    '❌ ' + resultBack.error
                )
            }

            gameBack.question = resultBack.question
            gameBack.step = resultBack.step
            gameBack.progression = resultBack.progression
            gameBack.akitude = resultBack.akitude

            setSession(m, gameBack)

            return m.reply(
                questionText(gameBack)
            )
        } catch (e) {
            return m.reply(
                '❌ Error back:\n' + e.message
            )
        }
    }

    /* --------------------------------------------------------
     * EXCLUDE
     * ------------------------------------------------------ */

    if (sub === 'exclude') {
        var gameExclude = getSession(m)

        if (!gameExclude) {
            return m.reply(
                '❌ Belum ada permainan Akinator.'
            )
        }

        try {
            var resultExclude =
                await excludeGame(gameExclude)

            if (!resultExclude.status) {
                deleteSession(m)
                return m.reply(
                    '❌ ' + resultExclude.error
                )
            }

            if (resultExclude.newSession) {
                gameExclude.session =
                    resultExclude.newSession

                gameExclude.signature =
                    resultExclude.newSignature
            }

            gameExclude.question =
                resultExclude.question

            gameExclude.step =
                resultExclude.step

            gameExclude.progression =
                resultExclude.progression

            gameExclude.akitude =
                resultExclude.akitude

            setSession(m, gameExclude)

            return m.reply(
                questionText(gameExclude)
            )
        } catch (e) {
            return m.reply(
                '❌ Error exclude:\n' + e.message
            )
        }
    }

    /* --------------------------------------------------------
     * ANSWER
     * ------------------------------------------------------ */

    var validNumbers = [
        '1',
        '2',
        '3',
        '4',
        '5'
    ]

    if (
        validNumbers.indexOf(sub) !== -1 ||
        typeof ANSWERS[sub] !== 'undefined'
    ) {
        var gameAnswer = getSession(m)

        if (!gameAnswer) {
            return m.reply(
                '❌ Belum ada permainan.\n\n' +
                'Mulai dengan:\n' +
                usedPrefix + command
            )
        }

        var answerMap = {
            '1': 'yes',
            '2': 'no',
            '3': 'idk',
            '4': 'probably',
            '5': 'probably not'
        }

        var answer = answerMap[sub] || sub

        try {
            var resultAnswer =
                await answerGame(
                    gameAnswer,
                    answer
                )

            if (!resultAnswer.status) {
                deleteSession(m)

                return m.reply(
                    '❌ ' + resultAnswer.error
                )
            }

            /* ------------------------------------------------
             * WIN
             * ---------------------------------------------- */

            if (resultAnswer.won) {
                deleteSession(m)

                var text =
                    '╭───〔 🎩 AKINATOR 〕───\n' +
                    '│\n' +
                    '│ 🎯 Aku tahu jawabannya!\n' +
                    '│\n' +
                    '│ 👤 ' +
                    (resultAnswer.name || 'Tidak diketahui') +
                    '\n' +
                    '│\n' +
                    '│ 📝 ' +
                    (
                        resultAnswer.description ||
                        'Tidak ada deskripsi'
                    ) +
                    '\n' +
                    '│\n' +
                    '╰─────────────────────'

                if (resultAnswer.pseudo) {
                    text +=
                        '\n\n👨‍💻 Pseudo: ' +
                        resultAnswer.pseudo
                }

                if (resultAnswer.photo) {
                    try {
                        return await conn.sendMessage(
                            m.chat,
                            {
                                image: {
                                    url: resultAnswer.photo
                                },
                                caption: text
                            },
                            {
                                quoted: m
                            }
                        )
                    } catch (e) {
                        return m.reply(text)
                    }
                }

                return m.reply(text)
            }

            /* ------------------------------------------------
             * NEXT QUESTION
             * ---------------------------------------------- */

            gameAnswer.question =
                resultAnswer.question

            gameAnswer.step =
                resultAnswer.step

            gameAnswer.progression =
                resultAnswer.progression

            gameAnswer.akitude =
                resultAnswer.akitude

            setSession(m, gameAnswer)

            return m.reply(
                questionText(gameAnswer)
            )
        } catch (e) {
            return m.reply(
                '❌ Terjadi error saat menjawab:\n' +
                e.message
            )
        }
    }

    /* --------------------------------------------------------
     * START
     * ------------------------------------------------------ */

    if (
        !sub ||
        sub === 'start' ||
        sub === 'mulai'
    ) {
        if (getSession(m)) {
            return m.reply(
                '⚠️ Kamu masih punya permainan Akinator aktif.\n\n' +
                'Jawab dengan:\n' +
                usedPrefix + command + ' 1-5\n\n' +
                'Atau ketik:\n' +
                usedPrefix + command + ' stop'
            )
        }

        var theme = args[1]
            ? String(args[1]).toLowerCase()
            : 'characters'

        if (!THEMES[theme]) {
            return m.reply(
                '❌ Tema tidak valid.\n\n' +
                'Tema tersedia:\n' +
                '• characters\n' +
                '• animals\n' +
                '• objects'
            )
        }

        await m.reply(
            '🎩 Memanggil Akinator...'
        )

        try {
            var newGame =
                await startGame(
                    theme,
                    false
                )

            if (!newGame.status) {
                return m.reply(
                    '❌ ' + newGame.error
                )
            }

            setSession(m, newGame)

            return m.reply(
                questionText(newGame)
            )
        } catch (e) {
            return m.reply(
                '❌ Gagal memulai Akinator:\n' +
                e.message
            )
        }
    }

    /* --------------------------------------------------------
     * HELP
     * ------------------------------------------------------ */

    return m.reply(
        '🎩 *AKINATOR*\n\n' +
        'Cara bermain:\n' +
        usedPrefix + command + '\n\n' +
        'Jawaban:\n' +
        '1. Ya\n' +
        '2. Tidak\n' +
        '3. Tidak tahu\n' +
        '4. Mungkin\n' +
        '5. Mungkin tidak\n\n' +
        'Perintah:\n' +
        usedPrefix + command + ' back\n' +
        usedPrefix + command + ' exclude\n' +
        usedPrefix + command + ' stop'
    )
}

handler.help = [
    'akinator',
    'akinator 1',
    'akinator 2',
    'akinator 3',
    'akinator 4',
    'akinator 5',
    'akinator back',
    'akinator exclude',
    'akinator stop'
]

handler.tags = ['game']

handler.command = /^(akinator|yakinator)$/i

handler.limit = false

export default handler


