/**
 * ZELAPI SMS / OTP
 * Type: ESM Plugin
 * API: https://smsku.zelapi.eu.cc
 *
 * Commands:
 * .sms
 * .sms services
 * .sms countries WhatsApp
 * .sms get WhatsApp|Indonesia
 * .sms numbers
 * .sms otp 628xxxx
 * .sms otps
 * .sms release 628xxxx
 * .sms feed
 * .sms stats daily
 */

import axios from 'axios'

const BASE_URL = 'https://smsku.zelapi.eu.cc'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'ZELAPI-ESM/1.0'
  }
})

const cleanNumber = number =>
  String(number || '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '')

const formatNumber = number => {
  const n = cleanNumber(number)
  return n ? `+${n}` : '-'
}

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms))

function apiError(error) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    'Terjadi kesalahan pada ZELAPI.'
  )
}

async function getServices() {
  const { data } = await api.get('/api/services')
  return data
}

async function getCountries(service) {
  const { data } = await api.get('/api/countries', {
    params: { service }
  })
  return data
}

async function requestNumber(service, country) {
  const { data } = await api.post('/api/request_number', {
    service,
    country
  })
  return data
}

async function getMyNumbers() {
  const { data } = await api.get('/api/my_numbers')
  return data
}

async function releaseNumber(number) {
  const { data } = await api.post('/api/release_number', {
    number: cleanNumber(number)
  })
  return data
}

async function getLatestOtp(number) {
  const { data } = await api.get('/api/latest_otp', {
    params: {
      number: cleanNumber(number)
    }
  })
  return data
}

async function getMyOtps(limit = 10, number = '') {
  const params = { limit }

  if (number) {
    params.number = cleanNumber(number)
  }

  const { data } = await api.get('/api/my_otps', {
    params
  })

  return data
}

async function getOtpFeed(count = 10) {
  const { data } = await api.get('/api/otp', {
    params: { count }
  })

  return data
}

async function getStats(period = 'daily') {
  const { data } = await api.get('/api/stats/detailed', {
    params: { period }
  })

  return data
}

async function waitOtp(number, tries = 12, interval = 5000) {
  for (let i = 0; i < tries; i++) {
    try {
      const data = await getLatestOtp(number)

      if (
        data?.success &&
        data?.has_otp &&
        data?.otp_code
      ) {
        return data
      }
    } catch {}

    if (i < tries - 1) {
      await sleep(interval)
    }
  }

  return null
}

function menu(prefix = '.') {
  return `╭━━━〔 📱 ZELAPI SMS 〕━━━⬣
┃
┃ • ${prefix}sms services
┃   └─ Daftar service
┃
┃ • ${prefix}sms countries <service>
┃   └─ Daftar negara
┃
┃ • ${prefix}sms get <service>|<country>
┃   └─ Ambil nomor
┃
┃ • ${prefix}sms numbers
┃   └─ Nomor aktif
┃
┃ • ${prefix}sms otp <number>
┃   └─ Cek OTP
┃
┃ • ${prefix}sms otps
┃   └─ Riwayat OTP
┃
┃ • ${prefix}sms release <number>
┃   └─ Release nomor
┃
┃ • ${prefix}sms feed
┃   └─ Live OTP
┃
┃ • ${prefix}sms stats [period]
┃   └─ Statistik
┃
╰━━━━━━━━━━━━━━━━━━━━⬣`
}

function servicesText(data) {
  if (!data?.services?.length) {
    return '❌ Tidak ada service tersedia.'
  }

  let text = `╭━━〔 📱 SERVICES 〕━━⬣\n`

  for (const service of data.services) {
    text += `┃ 📦 ${service.name}\n`
    text += `┃ └─ Tersedia: ${service.count}\n`
  }

  text += `╰━━━━━━━━━━━━━━━━⬣`

  return text
}

function countriesText(data, service) {
  if (!data?.countries?.length) {
    return `❌ Tidak ada negara untuk *${service}*.`
  }

  let text = `╭━━〔 🌎 COUNTRIES 〕━━⬣\n`
  text += `┃ 📦 Service: *${service}*\n┃\n`

  for (const country of data.countries) {
    text += `┃ 🌎 ${country.name}\n`
    text += `┃ └─ ${country.count} nomor\n`
  }

  text += `╰━━━━━━━━━━━━━━━━⬣`

  return text
}

function numbersText(data) {
  if (!data?.numbers?.length) {
    return `╭━━〔 📱 NOMOR AKTIF 〕━━⬣
┃
┃ Tidak ada nomor aktif.
┃
╰━━━━━━━━━━━━━━━━⬣`
  }

  let text = `╭━━〔 📱 NOMOR AKTIF 〕━━⬣\n`

  for (const item of data.numbers) {
    const number =
      item.number ||
      item.phone ||
      item.msisdn ||
      '-'

    const id =
      item.id ||
      item.transaction_id ||
      '-'

    text += `┃ 📞 ${formatNumber(number)}\n`
    text += `┃ 🆔 ${id}\n`
    text += `┃\n`
  }

  text += `╰━━━━━━━━━━━━━━━━⬣`

  return text
}

function otpHistoryText(data) {
  if (!data?.otps?.length) {
    return `╭━━〔 🔐 OTP HISTORY 〕━━⬣
┃
┃ Belum ada riwayat OTP.
┃
╰━━━━━━━━━━━━━━━━⬣`
  }

  let text = `╭━━〔 🔐 OTP HISTORY 〕━━⬣\n`

  for (const otp of data.otps) {
    if (typeof otp === 'object') {
      text += `┃ 📱 ${formatNumber(
        otp.number ||
        otp.phone ||
        otp.msisdn ||
        ''
      )}\n`

      text += `┃ 🔐 ${otp.otp_code || otp.code || '-'}\n`

      if (otp.service) {
        text += `┃ 📦 ${otp.service}\n`
      }

      if (otp.country) {
        text += `┃ 🌎 ${otp.country}\n`
      }

      text += `┃\n`
    }
  }

  text += `╰━━━━━━━━━━━━━━━━⬣`

  return text
}

function feedText(data) {
  if (!Array.isArray(data) || !data.length) {
    return `╭━━〔 📡 OTP FEED 〕━━⬣
┃
┃ Belum ada OTP.
┃
╰━━━━━━━━━━━━━━━━⬣`
  }

  let text = `╭━━〔 📡 OTP FEED 〕━━⬣\n`

  for (const item of data) {
    if (!Array.isArray(item)) continue

    const [
      service,
      number,
      otp,
      time,
      country
    ] = item

    text += `┃ 📦 ${service || '-'}\n`
    text += `┃ 📱 ${formatNumber(number)}\n`
    text += `┃ 🔐 ${otp || '-'}\n`
    text += `┃ 🌎 ${country || '-'}\n`
    text += `┃ ⏱️ ${time || '-'}\n`
    text += `┃\n`
  }

  text += `╰━━━━━━━━━━━━━━━━⬣`

  return text
}

function statsText(data, period) {
  return `╭━━〔 📊 ZELAPI STATS 〕━━⬣
┃
┃ 📅 Period
┃ └─ ${period}
┃
┃ 🔐 OTP
┃ └─ ${data?.otp_count ?? 0}
┃
┃ 🌎 Countries
┃ └─ ${data?.countries_count ?? 0}
┃
┃ 📦 Services
┃ └─ ${data?.services_count ?? 0}
┃
┃ 📱 Available Numbers
┃ └─ ${data?.available_numbers ?? 0}
┃
╰━━━━━━━━━━━━━━━━⬣`
}

let handler = async (m, {
  text,
  usedPrefix,
  command
}) => {
  const input = String(text || '').trim()

  if (!input) {
    return m.reply(menu(usedPrefix))
  }

  const args = input.split(/\s+/)
  const action = args.shift().toLowerCase()

  try {

    // ==========================================
    // SERVICES
    // ==========================================

    if (action === 'services') {
      const data = await getServices()

      return m.reply(
        servicesText(data)
      )
    }

    // ==========================================
    // COUNTRIES
    // ==========================================

    if (action === 'countries') {
      const service = args.join(' ').trim()

      if (!service) {
        return m.reply(
          `❌ Masukkan service.\n\n` +
          `Contoh:\n` +
          `${usedPrefix}${command} countries WhatsApp`
        )
      }

      const data = await getCountries(service)

      return m.reply(
        countriesText(data, service)
      )
    }

    // ==========================================
    // REQUEST NUMBER
    // ==========================================

    if (
      action === 'get' ||
      action === 'request' ||
      action === 'number'
    ) {
      const query = args.join(' ').trim()

      if (!query.includes('|')) {
        return m.reply(
          `❌ Format salah.\n\n` +
          `Contoh:\n` +
          `${usedPrefix}${command} get WhatsApp|Indonesia`
        )
      }

      const [service, country] = query
        .split('|')
        .map(v => v.trim())

      if (!service || !country) {
        return m.reply(
          '❌ Service dan country wajib diisi.'
        )
      }

      await m.reply(
        `⏳ Meminta nomor...\n\n` +
        `📦 Service: *${service}*\n` +
        `🌎 Country: *${country}*`
      )

      const data = await requestNumber(
        service,
        country
      )

      if (
        !data?.success ||
        !data?.number
      ) {
        return m.reply(
          `❌ Gagal mendapatkan nomor.\n\n` +
          `${data?.error || 'Nomor tidak tersedia.'}`
        )
      }

      const number = cleanNumber(data.number)

      await m.reply(
        `╭━━〔 📱 NOMOR DIDAPAT 〕━━⬣
┃
┃ 📦 Service
┃ └─ ${service}
┃
┃ 🌎 Country
┃ └─ ${country}
┃
┃ 📞 Number
┃ └─ *${formatNumber(number)}*
┃
┃ 🆔 ID
┃ └─ ${data.id || '-'}
┃
╰━━━━━━━━━━━━━━━━⬣

⏳ *Menunggu OTP...*`
      )

      const otp = await waitOtp(
        number,
        12,
        5000
      )

      if (otp?.otp_code) {
        return m.reply(
          `╭━━〔 🔐 OTP DITERIMA 〕━━⬣
┃
┃ 📱 ${formatNumber(number)}
┃
┃ 🔐 Kode OTP
┃ └─ *${otp.otp_code}*
┃
╰━━━━━━━━━━━━━━━━⬣`
        )
      }

      return m.reply(
        `⏱️ OTP belum diterima dalam 60 detik.\n\n` +
        `Cek lagi dengan:\n` +
        `*${usedPrefix}${command} otp ${number}*`
      )
    }

    // ==========================================
    // MY NUMBERS
    // ==========================================

    if (
      action === 'numbers' ||
      action === 'active'
    ) {
      const data = await getMyNumbers()

      return m.reply(
        numbersText(data)
      )
    }

    // ==========================================
    // LATEST OTP
    // ==========================================

    if (action === 'otp') {
      const number = args.join('').trim()

      if (!number) {
        return m.reply(
          `❌ Masukkan nomor.\n\n` +
          `Contoh:\n` +
          `${usedPrefix}${command} otp 6288269202428`
        )
      }

      const data = await getLatestOtp(number)

      if (
        !data?.success ||
        !data?.has_otp
      ) {
        return m.reply(
          `⏳ Belum ada OTP untuk *${formatNumber(number)}*.`
        )
      }

      return m.reply(
        `╭━━〔 🔐 LATEST OTP 〕━━⬣
┃
┃ 📱 ${formatNumber(number)}
┃ 🔐 OTP
┃ └─ *${data.otp_code}*
┃
╰━━━━━━━━━━━━━━━━⬣`
      )
    }

    // ==========================================
    // OTP HISTORY
    // ==========================================

    if (
      action === 'otps' ||
      action === 'history'
    ) {
      const limit = Math.min(
        Math.max(
          parseInt(args[0]) || 10,
          1
        ),
        50
      )

      const data = await getMyOtps(limit)

      return m.reply(
        otpHistoryText(data)
      )
    }

    // ==========================================
    // RELEASE NUMBER
    // ==========================================

    if (
      action === 'release' ||
      action === 'remove'
    ) {
      const number = args.join('').trim()

      if (!number) {
        return m.reply(
          `❌ Masukkan nomor.\n\n` +
          `Contoh:\n` +
          `${usedPrefix}${command} release 6288269202428`
        )
      }

      const data = await releaseNumber(number)

      if (!data?.success) {
        return m.reply(
          `❌ Gagal release nomor.\n\n` +
          `${data?.error || ''}`
        )
      }

      return m.reply(
        `✅ Nomor *${formatNumber(number)}* berhasil direlease.`
      )
    }

    // ==========================================
    // LIVE OTP FEED
    // ==========================================

    if (
      action === 'feed' ||
      action === 'live'
    ) {
      const count = Math.min(
        Math.max(
          parseInt(args[0]) || 10,
          1
        ),
        50
      )

      const data = await getOtpFeed(count)

      return m.reply(
        feedText(data)
      )
    }

    // ==========================================
    // STATS
    // ==========================================

    if (action === 'stats') {
      const allowed = [
        'daily',
        'weekly',
        'monthly',
        'lifetime'
      ]

      const period = String(
        args[0] || 'daily'
      ).toLowerCase()

      if (!allowed.includes(period)) {
        return m.reply(
          `❌ Period tidak valid.\n\n` +
          allowed
            .map(x => `• ${x}`)
            .join('\n')
        )
      }

      const data = await getStats(period)

      return m.reply(
        statsText(data, period)
      )
    }

    // ==========================================
    // UNKNOWN COMMAND
    // ==========================================

    return m.reply(
      `❌ Perintah tidak dikenal.\n\n` +
      menu(usedPrefix)
    )

  } catch (e) {
    console.error('[ZELAPI]', e)

    return m.reply(
      `❌ *ZELAPI ERROR*\n\n` +
      `${apiError(e)}`
    )
  }
}

handler.help = [
  'sms',
  'sms services',
  'sms countries <service>',
  'sms get <service>|<country>',
  'sms numbers',
  'sms otp <number>',
  'sms otps',
  'sms release <number>',
  'sms feed',
  'sms stats'
]

handler.tags = ['tools']
handler.command = /^sms$/i
handler.premium = true

export default handler
