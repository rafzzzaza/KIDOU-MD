import axios from 'axios'
import https from 'https'
import Builder from 'baileys-mbuilder'

const { AIRich } = Builder

const agent = new https.Agent({
    rejectUnauthorized: true,
    maxVersion: 'TLSv1.3',
    minVersion: 'TLSv1.2'
})

async function getCookies() {
    try {
        const response = await axios.get(
            'https://www.pinterest.com/csrf_error/',
            {
                httpsAgent: agent,
                timeout: 10000,
                validateStatus: s => s >= 200 && s < 500
            }
        )

        const cookies = response.headers['set-cookie']

        if (!cookies?.length) return ''

        return cookies
            .map(v => v.split(';')[0].trim())
            .join('; ')

    } catch (e) {
        console.log('[PINDLRICH COOKIE]', e.message)
        return ''
    }
}

async function pinterest(query) {
    const cookies = await getCookies()

    if (!cookies) {
        throw new Error('Gagal mendapatkan cookie Pinterest.')
    }

    const url =
        'https://www.pinterest.com/resource/BaseSearchResource/get/'

    const params = {
        source_url:
            `/search/pins/?q=${encodeURIComponent(query)}`,

        data: JSON.stringify({
            options: {
                isPrefetch: false,
                query: query,
                scope: 'pins',
                no_fetch_context_on_resource: false
            },
            context: {}
        }),

        _: Date.now()
    }

    const headers = {
        accept:
            'application/json, text/javascript, */*, q=0.01',

        'accept-language':
            'en-US,en;q=0.9',

        cookie: cookies,

        referer:
            'https://www.pinterest.com/',

        'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36',

        'x-app-version':
            'c056fb7',

        'x-pinterest-appstate':
            'active',

        'x-pinterest-pws-handler':
            'www/[username]/[slug].js',

        'x-pinterest-source-url':
            '/search/pins/',

        'x-requested-with':
            'XMLHttpRequest'
    }

    const { data } = await axios.get(url, {
        httpsAgent: agent,
        headers,
        params,
        timeout: 15000,
        maxContentLength: 20 * 1024 * 1024,
        maxBodyLength: 20 * 1024 * 1024
    })

    const results =
        data?.resource_response?.data?.results || []

    return results
        .filter(v => v?.images?.orig?.url)
        .map(v => ({
            image: v.images.orig.url,
            source:
                `https://id.pinterest.com/pin/${v.id}`,
            username:
                v?.pinner?.username || 'Unknown',
            fullname:
                v?.pinner?.full_name || 'Unknown',
            caption:
                v?.grid_title || ''
        }))
}

let handler = async (
    m,
    {
        conn,
        text,
        usedPrefix,
        command
    }
) => {

    if (!text) {
        return m.reply(
            `❌ Penggunaan:\n\n` +
            `${usedPrefix + command} <search> <jumlah>\n\n` +
            `Contoh:\n` +
            `${usedPrefix + command} domba 5`
        )
    }

    let parts = text.trim().split(/\s+/)
    let count = 5

    if (/^\d+$/.test(parts.at(-1))) {
        count = parseInt(parts.pop())
    }

    const query = parts.join(' ').trim()

    if (!query) {
        return m.reply('❌ Query pencarian kosong.')
    }

    count = Math.min(
        Math.max(count, 1),
        10
    )

    await m.reply(
        `🔎 Mencari gambar Pinterest...\n\n` +
        `Query: ${query}\n` +
        `Jumlah: ${count}`
    )

    try {

        console.log(
            `[PINDLRICH] Search: ${query} | Count: ${count}`
        )

        const results = await pinterest(query)

        console.log(
            `[PINDLRICH] Results: ${results.length}`
        )

        if (!results.length) {
            return m.reply(
                `❌ Tidak ditemukan hasil untuk:\n` +
                `"${query}"`
            )
        }

        const selected =
            results.slice(0, count)

        /*
         * ============================================
         * AI RICH
         * ============================================
         *
         * Semua hasil dimasukkan ke SATU Rich Response.
         */

        const rich = new AIRich(conn)

        rich
            .setTitle('📌 Pinterest Search')

            .addText(
                `🔎 Hasil pencarian untuk "${query}"\n\n` +
                `Menampilkan ${selected.length} foto dari Pinterest`
            )

        /*
         * Masukkan gambar satu per satu
         * ke dalam Rich Response.
         */

        for (let i = 0; i < selected.length; i++) {

            const item = selected[i]

            rich.addImage(
                item.image,
                {
                    id: `pinterest_${i + 1}`
                }
            )
        }

        rich.addText(
            `\n📌 Sumber: Pinterest`
        )

        /*
         * INI YANG MENGIRIM AIRICH.
         *
         * Jangan gunakan conn.sendMessage()
         * untuk bagian Rich Response.
         */

        await rich.send(m.chat)

        console.log(
            '[PINDLRICH] Rich Response berhasil dikirim.'
        )

    } catch (e) {

        console.error(
            '[PINDLRICH ERROR]',
            e
        )

        await m.reply(
            `❌ Pinterest gagal diproses.\n\n` +
            `Error: ${e?.message || e}`
        )
    }
}

handler.help = [
    'pindlrich <search> <jumlah>'
]

handler.tags = [
    'search'
]

handler.command = [
    'pin2'
]

handler.limit = true
handler.register = true

export default handler
