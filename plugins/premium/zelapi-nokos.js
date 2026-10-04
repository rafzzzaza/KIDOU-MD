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
import fs from 'fs'
import sharp from 'sharp'
import { generateWAMessageFromContent, proto } from '@rexxhayanasi/elaina-baileys'

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

const THUMB_PATH = './media/menu.png'

async function getThumbnail(input) {
  try {
    if (input && Buffer.isBuffer(input)) {
      return await sharp(input)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer()
    }
    if (input && typeof input === 'string' && fs.existsSync(input)) {
      const buffer = fs.readFileSync(input)
      return await sharp(buffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer()
    }
    if (fs.existsSync(THUMB_PATH)) {
      return fs.readFileSync(THUMB_PATH)
    }
    console.warn('[zelapi] Thumbnail tidak ditemukan:', THUMB_PATH)
    return Buffer.alloc(0)
  } catch (e) {
    console.error('[zelapi] thumbnail error:', e)
    return Buffer.alloc(0)
  }
}

function isPremiumUser(m) {
  const user = global.db?.data?.users?.[m.sender]
  return user?.premiumTime > 0 || (global.owner || []).includes(m.sender.split('@')[0])
}

async function sendInteractive(conn, chat, content, options = {}) {
  const msg = generateWAMessageFromContent(chat, content, { userJid: options.quoted?.sender || conn.user.jid, quoted: options.quoted })
  await conn.relayMessage(chat, msg.message, { messageId: msg.key.id })
  return msg
}

async function editMessage(conn, chat, messageKey, newContent) {
  try {
    await conn.sendMessage(chat, newContent, { edit: messageKey })
  } catch (e) {
    console.error('[zelapi] edit message error:', e)
  }
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

async function waitOtpWithProgress(conn, chat, messageKey, number, usedPrefix, command, tries = 12, interval = 5000) {
  const totalTime = tries * (interval / 1000)

  for (let i = 0; i < tries; i++) {
    const remaining = totalTime - (i * (interval / 1000))
    const percent = Math.floor(((totalTime - remaining) / totalTime) * 100)
    const fill = Math.floor(percent / 10)
    const bar = '■'.repeat(fill) + '□'.repeat(10 - fill)

    const progressText = `⏳ *Menunggu OTP...*\n\n📱 ${formatNumber(number)}\n${bar} ${percent}%\n⏱️ ${Math.floor(remaining)}s tersisa`

    try {
      await conn.relayMessage(chat, {
        protocolMessage: {
          key: messageKey,
          type: 14,
          editedMessage: {
            conversation: progressText
          }
        }
      }, {})
    } catch {}

    try {
      const data = await getLatestOtp(number)

      if (data?.success && data?.has_otp && data?.otp_code) {
        return data
      }
    } catch {}

    if (i < tries - 1) {
      await sleep(interval)
    }
  }

  return null
}

function buildMainMenu(usedPrefix, command) {
  const buttons = [
    { text: '📦 Services', id: `${usedPrefix}${command} services` },
    { text: '🌎 Countries', id: `${usedPrefix}${command} countries` },
    { text: '📱 Get Number', id: `${usedPrefix}${command} get` },
    { text: '📋 My Numbers', id: `${usedPrefix}${command} numbers` },
    { text: '🔐 Check OTP', id: `${usedPrefix}${command} otp` },
    { text: '📜 OTP History', id: `${usedPrefix}${command} otps` },
    { text: '♻️ Release', id: `${usedPrefix}${command} release` },
    { text: '📡 Live Feed', id: `${usedPrefix}${command} feed` },
    { text: '📊 Statistics', id: `${usedPrefix}${command} stats` }
  ]

  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: '📱 ZELAPI SMS',
      sections: [{
        title: 'Main Menu',
        rows: buttons.map((b, i) => ({
          header: 'ZELAPI',
          title: b.text,
          description: `Klik untuk ${b.text.toLowerCase()}`,
          id: b.id
        }))
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • SMS / OTP 」`,
          body: { text: 'Pilih menu di bawah ini:' },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: {
            buttons: nativeFlow
          }
        }
      }
    }
  }
}

function buildServicesList(services, usedPrefix, command) {
  const rows = services.map(s => ({
    header: 'ZELAPI',
    title: s.name,
    description: `${s.count} nomor tersedia`,
    id: `${usedPrefix}${command} countries ${s.name}`
  }))

  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: '📦 Pilih Service',
      sections: [{
        title: 'Available Services',
        rows
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • Services 」`,
          body: { text: 'Pilih service untuk melihat negara:' },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons: nativeFlow }
        }
      }
    }
  }
}

function buildCountriesList(countries, service, usedPrefix, command) {
  const rows = countries.map(c => ({
    header: 'ZELAPI',
    title: c.name,
    description: `${c.count} nomor`,
    id: `${usedPrefix}${command} get ${service}|${c.name}`
  }))

  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: `🌎 Negara untuk ${service}`,
      sections: [{
        title: 'Available Countries',
        rows
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • Countries 」`,
          body: { text: `Service: *${service}*\nPilih negara:` },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons: nativeFlow }
        }
      }
    }
  }
}

function buildGetNumberConfirm(service, country, usedPrefix, command) {
  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: '📱 Konfirmasi Ambil Nomor',
      sections: [{
        title: 'Aksi',
        rows: [
          { header: 'ZELAPI', title: '📱 Ambil Nomor', description: `Service: ${service} | Country: ${country}`, id: `${usedPrefix}${command} confirm_get ${service}|${country}` },
          { header: 'ZELAPI', title: '❌ Batal', description: 'Kembali ke menu utama', id: `${usedPrefix}${command}` }
        ]
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • Get Number 」`,
          body: { text: `📦 Service: *${service}*\n🌎 Country: *${country}*\n\nLanjutkan ambil nomor?` },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons: nativeFlow }
        }
      }
    }
  }
}

function buildNumberResult(data, service, country, usedPrefix, command) {
  const number = cleanNumber(data.number)
  const buttons = [{
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({
      display_text: formatNumber(number),
      copy_code: number
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • Nomor Didapat 」`,
          body: { text: `✅ Berhasil mendapatkan nomor!\n\n📦 Service: *${service}*\n🌎 Country: *${country}*\n📞 Number: *${formatNumber(number)}*\n🆔 ID: ${data.id || '-'}\n\n⏳ *Menunggu OTP...*` },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons }
        }
      }
    }
  }
}

function buildMyNumbersList(numbers, usedPrefix, command) {
  if (!numbers.length) {
    return null
  }

  const rows = numbers.map((n, i) => {
    const num = n.number || n.phone || n.msisdn || '-'
    const id = n.id || n.transaction_id || '-'
    return {
      header: formatNumber(num),
      title: `${n.service || '-'} • ${n.country || '-'}`,
      description: `ID: ${id}`,
      id: `${usedPrefix}${command} number_action ${num}`
    }
  })

  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: '📋 Nomor Aktif',
      sections: [{
        title: 'Pilih nomor untuk aksi',
        rows
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • My Numbers 」`,
          body: { text: `Total: ${numbers.length} nomor aktif\nPilih nomor untuk melihat aksi:` },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons: nativeFlow }
        }
      }
    }
  }
}

function buildNumberActions(number, usedPrefix, command) {
  const num = cleanNumber(number)
  const buttons = [
    { text: '🔐 Cek OTP', id: `${usedPrefix}${command} otp ${num}` },
    { text: '📜 History', id: `${usedPrefix}${command} otps ${num}` },
    { text: '♻️ Release', id: `${usedPrefix}${command} release ${num}` }
  ]

  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: `📱 Aksi untuk ${formatNumber(number)}`,
      sections: [{
        title: 'Pilih aksi',
        rows: buttons.map((b, i) => ({ header: 'ZELAPI', title: b.text, description: b.id, id: b.id }))
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • Number Actions 」`,
          body: { text: `Nomor: *${formatNumber(number)}*\nPilih aksi:` },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons: nativeFlow }
        }
      }
    }
  }
}

function buildOtpResult(data, number, usedPrefix, command) {
  const buttons = [{
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({
      display_text: data.otp_code,
      copy_code: data.otp_code
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • OTP Diterima 」`,
          body: { text: `✅ OTP diterima!\n\n📱 ${formatNumber(number)}\n🔐 Kode OTP: *${data.otp_code}*` },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons }
        }
      }
    }
  }
}

function buildOtpHistoryList(data, usedPrefix, command) {
  if (!data?.otps?.length) {
    return null
  }

  const rows = data.otps.slice(0, 20).map(otp => {
    if (typeof otp !== 'object') return null
    const num = formatNumber(otp.number || otp.phone || otp.msisdn || '')
    const code = otp.otp_code || otp.code || '-'
    const svc = otp.service || '-'
    const cty = otp.country || '-'
    return {
      header: num,
      title: `OTP: ${code}`,
      description: `${svc} • ${cty}`,
      id: `${usedPrefix}${command} otp ${otp.number || otp.phone || otp.msisdn || ''}`
    }
  }).filter(Boolean)

  if (!rows.length) return null

  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: '📜 OTP History',
      sections: [{
        title: 'Riwayat OTP (max 20)',
        rows
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • OTP History 」`,
          body: { text: `Total: ${data.otps.length} riwayat\nKlik untuk cek detail:` },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons: nativeFlow }
        }
      }
    }
  }
}

function buildFeedList(data, usedPrefix, command) {
  if (!Array.isArray(data) || !data.length) {
    return null
  }

  const rows = data.slice(0, 20).map((item, i) => {
    if (!Array.isArray(item)) return null
    const [service, number, otp, time, country] = item
    return {
      header: formatNumber(number),
      title: `OTP: ${otp || '-'}`,
      description: `${service || '-'} • ${country || '-'} • ${time || '-'}`,
      id: `${usedPrefix}${command} otp ${number}`
    }
  }).filter(Boolean)

  if (!rows.length) return null

  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: '📡 Live OTP Feed',
      sections: [{
        title: 'OTP Terbaru (max 20)',
        rows
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • Live Feed 」`,
          body: { text: `Total: ${data.length} OTP terbaru\nKlik untuk cek detail:` },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons: nativeFlow }
        }
      }
    }
  }
}

function buildStatsButtons(usedPrefix, command) {
  const periods = ['daily', 'weekly', 'monthly', 'lifetime']
  const buttons = periods.map(p => ({
    text: `📅 ${p.charAt(0).toUpperCase() + p.slice(1)}`,
    id: `${usedPrefix}${command} stats ${p}`
  }))

  const nativeFlow = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: '📊 Statistik Periode',
      sections: [{
        title: 'Pilih Periode',
        rows: buttons.map(b => ({ header: 'ZELAPI', title: b.text, description: `Statistik ${b.text.replace('📅 ', '').toLowerCase()}`, id: b.id }))
      }]
    })
  }]

  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          title: `「 ZELAPI • Statistics 」`,
          body: { text: 'Pilih periode statistik:' },
          footer: { text: global.namebot || 'Bot' },
          nativeFlowMessage: { buttons: nativeFlow }
        }
      }
    }
  }
}

function buildStatsResult(data, period) {
  const text = `╭━━〔 📊 ZELAPI STATS 〕━━⬣
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

  return { text }
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

let handler = async (m, { text, usedPrefix, command, conn }) => {
  const input = String(text || '').trim()

  if (handler.premium && !isPremiumUser(m)) {
    return m.reply('❌ Fitur ini hanya untuk user Premium.')
  }

  const thumb = await getThumbnail()

  if (!input) {
    const content = buildMainMenu(usedPrefix, command)
    return sendInteractive(conn, m.chat, content, { quoted: m })
  }

  const args = input.split(/\s+/)
  const action = args.shift().toLowerCase()

  try {

    if (action === 'services') {
      const data = await getServices()
      const content = buildServicesList(data.services || [], usedPrefix, command)
      return sendInteractive(conn, m.chat, content, { quoted: m })
    }

    if (action === 'countries') {
      const service = args.join(' ').trim()
      if (!service) {
        const data = await getServices()
        const content = buildServicesList(data.services || [], usedPrefix, command)
        return sendInteractive(conn, m.chat, content, { quoted: m })
      }
      const data = await getCountries(service)
      const content = buildCountriesList(data.countries || [], service, usedPrefix, command)
      return sendInteractive(conn, m.chat, content, { quoted: m })
    }

    if (action === 'get' || action === 'request' || action === 'number') {
      const query = args.join(' ').trim()
      if (!query) {
        const data = await getServices()
        const content = buildServicesList(data.services || [], usedPrefix, command)
        return sendInteractive(conn, m.chat, content, { quoted: m })
      }
      if (!query.includes('|')) {
        return m.reply(`❌ Format salah.\n\nContoh:\n${usedPrefix}${command} get WhatsApp|Indonesia`)
      }
      const [service, country] = query.split('|').map(v => v.trim())
      if (!service || !country) {
        return m.reply('❌ Service dan country wajib diisi.')
      }
      const content = buildGetNumberConfirm(service, country, usedPrefix, command)
      return sendInteractive(conn, m.chat, content, { quoted: m })
    }

    if (action === 'confirm_get') {
      const query = args.join(' ').trim()
      if (!query.includes('|')) {
        return m.reply('❌ Format salah.')
      }
      const [service, country] = query.split('|').map(v => v.trim())

      const waitMsg = await m.reply(`⏳ Meminta nomor...\n\n📦 Service: *${service}*\n🌎 Country: *${country}*`)

      const data = await requestNumber(service, country)

      if (!data?.success || !data?.number) {
        return m.reply(`❌ Gagal mendapatkan nomor.\n\n${data?.error || 'Nomor tidak tersedia.'}`)
      }

      const number = cleanNumber(data.number)
      const resultContent = buildNumberResult(data, service, country, usedPrefix, command)
      const sent = await sendInteractive(conn, m.chat, resultContent, { quoted: m })

      const otp = await waitOtpWithProgress(conn, m.chat, sent.key, number, usedPrefix, command)

      if (otp?.otp_code) {
        const otpContent = buildOtpResult(otp, number, usedPrefix, command)
        return sendInteractive(conn, m.chat, otpContent, { quoted: m })
      }

      return m.reply(`⏱️ OTP belum diterima dalam 60 detik.\n\nCek lagi dengan:\n*${usedPrefix}${command} otp ${number}*`)
    }

    if (action === 'numbers' || action === 'active') {
      const data = await getMyNumbers()
      const content = buildMyNumbersList(data.numbers || [], usedPrefix, command)
      if (!content) {
        return m.reply('❌ Tidak ada nomor aktif.')
      }
      return sendInteractive(conn, m.chat, content, { quoted: m })
    }

    if (action === 'number_action') {
      const number = args.join(' ').trim()
      if (!number) {
        return m.reply('❌ Nomor tidak valid.')
      }
      const content = buildNumberActions(number, usedPrefix, command)
      return sendInteractive(conn, m.chat, content, { quoted: m })
    }

    if (action === 'otp') {
      const number = args.join('').trim()
      if (!number) {
        const data = await getMyNumbers()
        const content = buildMyNumbersList(data.numbers || [], usedPrefix, command)
        if (!content) {
          return m.reply('❌ Tidak ada nomor aktif.')
        }
        return sendInteractive(conn, m.chat, content, { quoted: m })
      }
      const data = await getLatestOtp(number)
      if (!data?.success || !data?.has_otp) {
        return m.reply(`⏳ Belum ada OTP untuk *${formatNumber(number)}*.`)
      }
      const content = buildOtpResult(data, number, usedPrefix, command)
      return sendInteractive(conn, m.chat, content, { quoted: m })
    }

    if (action === 'otps' || action === 'history') {
      const limit = Math.min(Math.max(parseInt(args[0]) || 10, 1), 50)
      const numberFilter = args[1] ? args.join(' ').trim() : ''
      const data = await getMyOtps(limit, numberFilter)
      const content = buildOtpHistoryList(data, usedPrefix, command)
      if (!content) {
        return m.reply(numberFilter ? `❌ Tidak ada riwayat OTP untuk *${formatNumber(numberFilter)}*.` : '❌ Belum ada riwayat OTP.')
      }
      return sendInteractive(conn, m.chat, content, { quoted: m })
    }

    if (action === 'release' || action === 'remove') {
      const number = args.join('').trim()
      if (!number) {
        const data = await getMyNumbers()
        const content = buildMyNumbersList(data.numbers || [], usedPrefix, command)
        if (!content) {
          return m.reply('❌ Tidak ada nomor aktif.')
        }
        return sendInteractive(conn, m.chat, content, { quoted: m })
      }
      const data = await releaseNumber(number)
      if (!data?.success) {
        return m.reply(`❌ Gagal release nomor.\n\n${data?.error || ''}`)
      }
      return m.reply(`✅ Nomor *${formatNumber(number)}* berhasil direlease.`)
    }

    if (action === 'feed' || action === 'live') {
      const count = Math.min(Math.max(parseInt(args[0]) || 10, 1), 50)
      const data = await getOtpFeed(count)
      const content = buildFeedList(data, usedPrefix, command)
      if (!content) {
        return m.reply('❌ Belum ada OTP.')
      }
      return sendInteractive(conn, m.chat, content, { quoted: m })
    }

    if (action === 'stats') {
      const allowed = ['daily', 'weekly', 'monthly', 'lifetime']
      const period = String(args[0] || 'daily').toLowerCase()
      if (!allowed.includes(period)) {
        const content = buildStatsButtons(usedPrefix, command)
        return sendInteractive(conn, m.chat, content, { quoted: m })
      }
      const data = await getStats(period)
      return m.reply(statsText(data, period))
    }

    return m.reply(`❌ Perintah tidak dikenal.\n\n${menu(usedPrefix)}`)

  } catch (e) {
    console.error('[ZELAPI]', e)
    return m.reply(`❌ *ZELAPI ERROR*\n\n${apiError(e)}`)
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
