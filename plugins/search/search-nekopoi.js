/*
 * ==============================================
 * NEKOPOI SCRAPER — ESM PLUGIN
 * ==============================================
 * Command:
 * .nekopoi <query>
 * .nekopoi latest
 * .nekopoi detail <url>
 * .nekopoi genre <genre>
 * .nekopoi category <category>
 * .nekopoi schedule
 *
 * Dependency:
 * npm install axios cheerio
 * ==============================================
 */

import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE_URL = 'https://nekopoi.care'

const HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
}

const api = axios.create({
    baseURL: BASE_URL,
    headers: HEADERS,
    timeout: 15000
})

function resolveUrl(url) {
    if (!url) return ''

    if (/^https?:\/\//i.test(url))
        return url

    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

function parseSearchDescription(text) {
    const metadata = {}

    if (!text) return metadata

    const keys = [
        'Original Title',
        'Judul Asli',
        'Parody',
        'Parodi',
        'Producers',
        'Produser',
        'Duration',
        'Durasi',
        'Genre',
        'Size',
        'Ukuran'
    ]

    const keyMap = {
        'Original Title': 'originalTitle',
        'Judul Asli': 'originalTitle',
        'Parody': 'parody',
        'Parodi': 'parody',
        'Producers': 'producers',
        'Produser': 'producers',
        'Duration': 'duration',
        'Durasi': 'duration',
        'Genre': 'genres',
        'Size': 'size',
        'Ukuran': 'size'
    }

    const matches = []

    for (const key of keys) {
        const regex = new RegExp(`(${key})\\s*:\\s*`, 'gi')

        let match

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                key,
                index: match.index,
                length: match[0].length
            })
        }
    }

    matches.sort((a, b) => a.index - b.index)

    for (let i = 0; i < matches.length; i++) {
        const current = matches[i]
        const next = matches[i + 1]

        const start = current.index + current.length
        const end = next ? next.index : text.length

        let value = text.substring(start, end).trim()

        if (!next)
            value = value.replace(/\s*\.\.\.\s*$/, '')

        const normalizedKey = keyMap[current.key]

        if (normalizedKey)
            metadata[normalizedKey] = value
    }

    return metadata
}

async function getPage(urlPath) {
    const url = resolveUrl(urlPath)

    try {
        const response = await api.get(url)

        return cheerio.load(response.data)
    } catch (error) {
        throw new Error(
            `Gagal memuat halaman.\nURL: ${url}\nPesan: ${error.message}`
        )
    }
}

function parseList($) {
    const results = []

    // ==========================================
    // SEARCH RESULT
    // ==========================================

    $('.nk-search-item').each((i, el) => {
        const url = $(el).attr('href')
        const title = $(el).find('h2').text().trim()

        const style =
            $(el).find('.nk-search-thumb').attr('style') || ''

        const imgMatch =
            style.match(/url\(['"]?(.*?)['"]?\)/)

        const image = imgMatch ? imgMatch[1] : ''

        const excerpt =
            $(el).find('.nk-search-desc').text().trim()

        const metadata =
            parseSearchDescription(excerpt)

        const genres = []

        $(el)
            .find('.nk-search-genres a')
            .each((j, aEl) => {
                const genre = $(aEl).text().trim()

                if (genre)
                    genres.push(genre)
            })

        const genreVal =
            genres.length
                ? genres
                : $(el).find('.nk-search-genres').text().trim()

        if (url && title) {
            results.push({
                type: 'search_result',
                title,
                url: resolveUrl(url),
                image,
                cover: image,
                excerpt,
                genres: genreVal,
                metadata
            })
        }
    })

    // ==========================================
    // LATEST POSTS
    // ==========================================

    $('.nk-post-card').each((i, el) => {
        const titleEl =
            $(el).find('h2 a, h3 a').first()

        const title =
            titleEl.text().trim()

        const url =
            titleEl.attr('href')

        const style =
            $(el).find('.nk-thumb-crop').attr('style') || ''

        const imgMatch =
            style.match(/url\(['"]?(.*?)['"]?\)/)

        const image =
            imgMatch ? imgMatch[1] : ''

        const date =
            $(el).find('.nk-post-meta span').text().trim()

        if (url && title) {
            results.push({
                type: 'latest_upload',
                title,
                url: resolveUrl(url),
                image,
                cover: image,
                date
            })
        }
    })

    // ==========================================
    // SERIES GRID
    // ==========================================

    $('.nk-series-link').each((i, el) => {
        const url =
            $(el).attr('href')

        const title =
            $(el).find('.title').text().trim()

        const style =
            $(el)
                .find('.nk-hentai-thumb, .nk-grid-thumb')
                .attr('style') || ''

        const imgMatch =
            style.match(/url\(['"]?(.*?)['"]?\)/)

        const image =
            imgMatch ? imgMatch[1] : ''

        const tooltipHtml =
            $(el).attr('original-title') || ''

        const metadata = {}

        if (tooltipHtml) {
            const _$ = cheerio.load(tooltipHtml)

            _$('.nk-tooltip-detail p').each((j, pEl) => {
                const text =
                    _$(pEl).text().trim()

                if (!text.includes(':'))
                    return

                const parts = text.split(':')

                const key =
                    parts.shift().trim()

                const value =
                    parts.join(':').trim()

                if (key && value)
                    metadata[key] = value
            })
        }

        if (url && title) {
            results.push({
                type: 'series_grid',
                title,
                url: resolveUrl(url),
                image,
                cover: image,
                metadata
            })
        }
    })

    // ==========================================
    // FALLBACK
    // ==========================================

    if (!results.length) {
        $(
            'article, .eropost, .result-item, .post-item, .box, .result'
        ).each((i, el) => {
            const titleEl =
                $(el)
                    .find(
                        'h2 a, h3 a, .title a, a.title, .entry-title a'
                    )
                    .first()

            const title =
                titleEl.text().trim()

            const url =
                titleEl.attr('href')

            const imgEl =
                $(el).find('img').first()

            const image =
                imgEl.attr('src') ||
                imgEl.attr('data-src') ||
                imgEl.attr('data-lazy-src') ||
                ''

            const excerpt =
                $(el)
                    .find('.entry-summary, .excerpt, p')
                    .first()
                    .text()
                    .trim()

            if (url && title) {
                results.push({
                    type: 'generic_post',
                    title,
                    url: resolveUrl(url),
                    image,
                    cover: image,
                    excerpt
                })
            }
        })
    }

    return results
}

// ==========================================
// SEARCH
// ==========================================

async function search(query, page = 1) {
    const urlPath =
        page > 1
            ? `/search/${encodeURIComponent(query)}/page/${page}/`
            : `/search/${encodeURIComponent(query)}`

    try {
        const $ = await getPage(urlPath)

        return parseList($)
    } catch (error) {
        try {
            const fallbackUrl =
                page > 1
                    ? `/page/${page}/?s=${encodeURIComponent(query)}`
                    : `/?s=${encodeURIComponent(query)}`

            const $ = await getPage(fallbackUrl)

            return parseList($)
        } catch {
            throw new Error(
                `Pencarian gagal untuk "${query}"`
            )
        }
    }
}

// ==========================================
// LATEST
// ==========================================

async function getLatest(page = 1) {
    const urlPath =
        page > 1
            ? `/page/${page}/`
            : '/'

    const $ = await getPage(urlPath)

    return parseList($)
}

// ==========================================
// CATEGORY
// ==========================================

async function getCategory(category, page = 1) {
    const urlPath =
        page > 1
            ? `/category/${category}/page/${page}/`
            : `/category/${category}/`

    const $ = await getPage(urlPath)

    return parseList($)
}

// ==========================================
// GENRE
// ==========================================

async function getByGenre(genre, page = 1) {
    const urlPath =
        page > 1
            ? `/genres/${genre}/page/${page}/`
            : `/genres/${genre}/`

    const $ = await getPage(urlPath)

    return parseList($)
}

// ==========================================
// SCHEDULE
// ==========================================

async function getSchedule() {
    const $ =
        await getPage('/jadwal-new-hentai/')

    const schedule = []

    $('.coming_soon').each((i, el) => {
        const title =
            $(el)
                .find('a.title, .title')
                .text()
                .trim()

        const episode =
            $(el)
                .find('.episode')
                .text()
                .trim()
                .replace(/[\(\)]/g, '')

        const imgEl =
            $(el).find('img').first()

        const image =
            imgEl.attr('src') ||
            imgEl.attr('data-src') ||
            ''

        const infoText =
            $(el)
                .find('h2')
                .last()
                .text()
                .trim()

        let producer = ''

        let releaseDate =
            $(el)
                .find('.release_date')
                .text()
                .trim()
                .replace(/[\n\r]/g, '')

        let subIndo = ''

        const producerMatch =
            infoText.match(
                /Producer\s*\/\s*Label\s*:\s*([^\n\r]+)/i
            )

        if (producerMatch)
            producer = producerMatch[1].trim()

        if (!releaseDate) {
            const releaseMatch =
                infoText.match(
                    /Tanggal\s*Release\s*:\s*([^\n\r]+)/i
                )

            if (releaseMatch)
                releaseDate =
                    releaseMatch[1].trim()
        }

        const subMatch =
            infoText.match(
                /Sub\s*Indo\s*:\s*([^\n\r]+)/i
            )

        if (subMatch)
            subIndo = subMatch[1].trim()

        if (title) {
            schedule.push({
                title,
                episode,
                image,
                cover: image,
                producer,
                releaseDate,
                subIndo
            })
        }
    })

    return schedule
}

// ==========================================
// EXTRACT M3U8
// ==========================================

function extractM3u8(iframeUrl) {
    if (!iframeUrl)
        return null

    try {
        const parsedUrl =
            new URL(iframeUrl)

        const streamId =
            parsedUrl.searchParams.get('name') ||
            parsedUrl.searchParams.get('id')

        if (
            streamId &&
            iframeUrl.includes('/play.html')
        ) {
            const base =
                iframeUrl.split('/play.html')[0]

            return `${base}/streams/${streamId}.m3u8`
        }
    } catch {}

    return null
}

// ==========================================
// DETAIL
// ==========================================

async function getDetail(urlPath) {
    const $ =
        await getPage(urlPath)

    const resolvedUrl =
        resolveUrl(urlPath)

    const title =
        $(
            'h1.entry-title, h1.title, h1'
        )
            .first()
            .text()
            .trim() ||
        $('h2')
            .first()
            .text()
            .trim()

    const isSeries =
        $(
            '.nk-episode-grid, .nk-series-detail, .nk-series-meta-list'
        ).length > 0

    // ========================================
    // SERIES
    // ========================================

    if (isSeries) {
        const titleText =
            $('.nk-series-synopsis b')
                .first()
                .text()
                .trim() || title

        const posterStyle =
            $('.nk-series-poster')
                .attr('style') || ''

        const posterMatch =
            posterStyle.match(
                /url\(['"]?(.*?)['"]?\)/
            )

        const poster =
            posterMatch
                ? posterMatch[1]
                : ''

        const synopsis =
            $('.nk-series-synopsis p')
                .text()
                .trim()

        const metadata = {}

        $('.nk-series-meta-list li')
            .each((i, el) => {
                const text =
                    $(el).text().trim()

                if (!text.includes(':'))
                    return

                const parts =
                    text.split(':')

                const key =
                    parts.shift().trim()

                const value =
                    parts.join(':').trim()

                if (key && value)
                    metadata[key] = value
            })

        const episodes = []

        $(
            '.nk-episode-grid li a, .nk-episode-card'
        ).each((i, el) => {
            const epUrl =
                $(el).attr('href')

            const epTitle =
                $(el)
                    .find('.nk-episode-card-title')
                    .text()
                    .trim()

            const epBadge =
                $(el)
                    .find('.nk-episode-badge')
                    .text()
                    .trim()

            const epDate =
                $(el)
                    .find('.nk-episode-card-date')
                    .text()
                    .trim()

            const epStyle =
                $(el)
                    .find('.nk-episode-card-thumb')
                    .attr('style') || ''

            const epImgMatch =
                epStyle.match(
                    /url\(['"]?(.*?)['"]?\)/
                )

            const epImage =
                epImgMatch
                    ? epImgMatch[1]
                    : ''

            if (epUrl) {
                episodes.push({
                    title:
                        epTitle ||
                        epBadge ||
                        `Episode ${i + 1}`,
                    url: resolveUrl(epUrl),
                    badge: epBadge,
                    date: epDate,
                    image: epImage
                })
            }
        })

        return {
            type: 'series',
            title: titleText,
            url: resolvedUrl,
            poster,
            synopsis,
            metadata,
            episodes
        }
    }

    // ========================================
    // EPISODE
    // ========================================

    const metadata = {}

    $(
        '.konten p, .content p, .entry-content p'
    ).each((i, el) => {
        const text =
            $(el).text().trim()

        if (!text.includes(':'))
            return

        const parts =
            text.split(':')

        const key =
            parts.shift().trim()

        const value =
            parts.join(':').trim()

        if (key && value)
            metadata[key] = value
    })

    const embeds = []
    const m3u8s = []

    $('iframe').each((i, el) => {
        const src =
            $(el).attr('src')

        if (!src)
            return

        embeds.push(resolveUrl(src))

        const m3u8 =
            extractM3u8(src)

        if (m3u8)
            m3u8s.push(m3u8)
    })

    const downloads = []

    $(
        '.nk-download-box .nk-download-row, .download-box .download-row'
    ).each((i, el) => {
        const name =
            $(el)
                .find(
                    '.nk-download-name, .download-name'
                )
                .text()
                .trim()

        const links = []

        $(el).find('a').each((j, aEl) => {
            const host =
                $(aEl).text().trim()

            const href =
                $(aEl).attr('href')

            if (href) {
                links.push({
                    host,
                    url: resolveUrl(href)
                })
            }
        })

        if (name && links.length)
            downloads.push({
                name,
                links
            })
    })

    return {
        type: 'episode',
        title,
        url: resolvedUrl,
        metadata,
        embeds,
        m3u8s,
        downloads
    }
}

// ==========================================
// FORMAT HASIL SEARCH
// ==========================================

function formatResults(results, title = 'Hasil') {
    if (!results?.length)
        return `❌ ${title} tidak ditemukan.`

    let text = `╭─「 ${title} 」\n`

    results.slice(0, 10).forEach((item, i) => {
        text += `│\n`
        text += `│ ${i + 1}. *${item.title}*\n`

        if (item.date)
            text += `│ 📅 ${item.date}\n`

        if (item.metadata?.duration)
            text += `│ ⏱️ ${item.metadata.duration}\n`

        if (item.metadata?.genres)
            text += `│ 🏷️ ${item.metadata.genres}\n`

        text += `│ 🔗 ${item.url}\n`
    })

    text += `│\n`
    text += `╰─ Total: ${results.length} hasil`

    return text
}

// ==========================================
// HANDLER
// ==========================================

const handler = async (m, {
    conn,
    text,
    usedPrefix,
    command
}) => {
    text = text?.trim() || ''

    if (!text) {
        return m.reply(
`╭─「 NEKOPOI 」─
│
│ ${usedPrefix + command} <query>
│
│ Contoh:
│ ${usedPrefix + command} latest
│ ${usedPrefix + command} search
│ ${usedPrefix + command} mahiru
│ ${usedPrefix + command} genre action
│ ${usedPrefix + command} category hentai
│ ${usedPrefix + command} schedule
│ ${usedPrefix + command} detail <url>
│
╰────────────────`
        )
    }

    await m.reply('⏳ Sebentar, lagi nyari datanya...')

    try {
        const args = text.split(/\s+/)
        const action = args[0].toLowerCase()

        let result

        // ====================================
        // LATEST
        // ====================================

        if (action === 'latest') {
            const page =
                parseInt(args[1]) || 1

            result =
                await getLatest(page)

            return m.reply(
                formatResults(
                    result,
                    `Latest — Page ${page}`
                )
            )
        }

        // ====================================
        // SEARCH
        // ====================================

        if (action === 'search') {
            const query =
                args.slice(1).join(' ')

            if (!query)
                return m.reply(
                    `Contoh: ${usedPrefix + command} search mahiru`
                )

            result =
                await search(query)

            return m.reply(
                formatResults(
                    result,
                    `Search: ${query}`
                )
            )
        }

        // ====================================
        // GENRE
        // ====================================

        if (action === 'genre') {
            const genre = args[1]

            if (!genre)
                return m.reply(
                    `Contoh: ${usedPrefix + command} genre action`
                )

            result =
                await getByGenre(genre)

            return m.reply(
                formatResults(
                    result,
                    `Genre: ${genre}`
                )
            )
        }

        // ====================================
        // CATEGORY
        // ====================================

        if (action === 'category') {
            const category = args[1]

            if (!category)
                return m.reply(
                    `Contoh: ${usedPrefix + command} category hentai`
                )

            result =
                await getCategory(category)

            return m.reply(
                formatResults(
                    result,
                    `Category: ${category}`
                )
            )
        }

        // ====================================
        // SCHEDULE
        // ====================================

        if (action === 'schedule') {
            result =
                await getSchedule()

            if (!result.length)
                return m.reply(
                    '❌ Jadwal tidak ditemukan.'
                )

            let msg =
                '╭─「 SCHEDULE 」\n'

            result
                .slice(0, 15)
                .forEach((item, i) => {
                    msg += `│\n`
                    msg += `│ ${i + 1}. *${item.title}*\n`

                    if (item.episode)
                        msg += `│ 🎬 ${item.episode}\n`

                    if (item.releaseDate)
                        msg += `│ 📅 ${item.releaseDate}\n`

                    if (item.producer)
                        msg += `│ 🏷️ ${item.producer}\n`

                    if (item.subIndo)
                        msg += `│ 🇮🇩 ${item.subIndo}\n`
                })

            msg += `│\n╰─ Total: ${result.length}`

            return m.reply(msg)
        }

        // ====================================
        // DETAIL
        // ====================================

        if (action === 'detail') {
            const url =
                args.slice(1).join(' ')

            if (!url)
                return m.reply(
                    `Contoh: ${usedPrefix + command} detail https://nekopoi.care/...`
                )

            result =
                await getDetail(url)

            let msg =
                `╭─「 DETAIL 」\n│\n`

            msg += `│ 🎬 *${result.title}*\n`
            msg += `│\n`

            if (result.type === 'series') {
                if (result.synopsis)
                    msg += `│ 📖 ${result.synopsis}\n│\n`

                if (
                    result.episodes?.length
                ) {
                    msg += `│ 📺 Episodes: ${result.episodes.length}\n`

                    result.episodes
                        .slice(0, 10)
                        .forEach((ep, i) => {
                            msg += `│ ${i + 1}. ${ep.title}\n`
                            msg += `│ 🔗 ${ep.url}\n`
                        })
                }
            } else {
                if (
                    Object.keys(result.metadata || {})
                        .length
                ) {
                    for (const [
                        key,
                        value
                    ] of Object.entries(
                        result.metadata
                    )) {
                        msg += `│ ${key}: ${value}\n`
                    }

                    msg += `│\n`
                }

                if (result.m3u8s?.length) {
                    msg += `│ 🎥 Stream:\n`

                    result.m3u8s.forEach(
                        (url, i) => {
                            msg += `│ ${i + 1}. ${url}\n`
                        }
                    )

                    msg += `│\n`
                }

                if (result.downloads?.length) {
                    msg += `│ 📥 Download:\n`

                    result.downloads.forEach(
                        item => {
                            msg += `│ • ${item.name}\n`

                            item.links.forEach(
                                link => {
                                    msg += `│   ${link.host}: ${link.url}\n`
                                }
                            )
                        }
                    )
                }
            }

            msg += `│\n╰─ ${result.url}`

            return m.reply(msg)
        }

        // ====================================
        // DEFAULT = SEARCH
        // ====================================

        result =
            await search(text)

        return m.reply(
            formatResults(
                result,
                `Search: ${text}`
            )
        )

    } catch (error) {
        console.error(
            '[NEKOPOI ERROR]',
            error
        )

        return m.reply(
            `❌ Terjadi error:\n\n${error.message}`
        )
    }
}

handler.help = [
    'nekopoi <query>',
    'nekopoi latest',
    'nekopoi search <query>',
    'nekopoi genre <genre>',
    'nekopoi category <category>',
    'nekopoi schedule',
    'nekopoi detail <url>'
]

handler.tags = ['search']
handler.command = /^nekopoi$/i

handler.limit = true

export default handler
