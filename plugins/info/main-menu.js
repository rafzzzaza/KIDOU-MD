import moment from 'moment-timezone'
import * as levelling from '../../lib/levelling.js'
import fs from 'fs'
import os from 'os'
import sharp from 'sharp'

// ============================================================
// CONSTANTS
// ============================================================

const BOT_NAME   = global.namebot || 'Bot'
const BOT_AUTHOR = global.author || 'Owner'

const THUMB_PATH = './media/menu.png'
const AUDIO_PATH = './vn/menu.aac'

const COOLDOWN_MS      = 60_000
const CACHE_REFRESH_MS = 60_000

const cooldown  = new Map()
const menuCache = new Map()

// ============================================================
// AESTHETIC FONT HELPERS
// ============================================================

function fontBold(str) {
  return [...String(str)].map(c => {
    const n = c.codePointAt(0)

    if (n >= 65 && n <= 90)
      return String.fromCodePoint(0x1D400 + n - 65)

    if (n >= 97 && n <= 122)
      return String.fromCodePoint(0x1D41A + n - 97)

    if (n >= 48 && n <= 57)
      return String.fromCodePoint(0x1D7CE + n - 48)

    return c
  }).join('')
}

function fontSmallCaps(str) {
  const map = {
    a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ',
    f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
    k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ',
    p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ',
    u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ'
  }

  return [...String(str).toLowerCase()]
    .map(c => map[c] || c)
    .join('')
}

function fontItalic(str) {
  return [...String(str)].map(c => {
    const n = c.codePointAt(0)

    if (n >= 65 && n <= 90)
      return String.fromCodePoint(0x1D608 + n - 65)

    if (n >= 97 && n <= 122)
      return String.fromCodePoint(0x1D622 + n - 97)

    return c
  }).join('')
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatBytes(bytes = 0) {
  if (!bytes) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function runtime() {
  const s = process.uptime()

  const d   = Math.floor(s / 86400)
  const h   = Math.floor((s % 86400) / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)

  return [
    d ? `${d}d` : '',
    h ? `${h}h` : '',
    m ? `${m}m` : '',
    `${sec}s`
  ].filter(Boolean).join(' ')
}

function ucapan() {
  const h = moment.tz('Asia/Jakarta').hour()

  if (h < 4)  return 'Good Night'
  if (h < 11) return 'Good Morning'
  if (h < 15) return 'Good Afternoon'
  if (h < 18) return 'Good Evening'

  return 'Good Night'
}

function randomQuote() {
  const quotes = [
    'Knowledge is power.',
    'Mission Complete.',
    'Stay curious.',
    'Everything is possible.',
    'Ready for next command.',
    'System running normally.',
    'Welcome back.'
  ]

  return quotes[Math.floor(Math.random() * quotes.length)]
}

function formatTag(tag = '') {
  return tag
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, v => v.toUpperCase())
}

function getBadge(item = {}) {
  const badge = []

  if (item.limit)   badge.push('ʟ')
  if (item.premium) badge.push('ᴘ')
  if (item.owner)   badge.push('ᴏ')
  if (item.admin)   badge.push('ᴀ')

  return badge.length
    ? ` [${badge.join('|')}]`
    : ''
}

function progressBar(percent = 0) {
  percent = Math.max(0, Math.min(100, percent))

  const full  = Math.floor(percent / 10)
  const empty = 10 - full

  return '■'.repeat(full) + '□'.repeat(empty)
}

function systemInfo() {
  const mem = process.memoryUsage()

  return {
    ram: formatBytes(mem.rss),
    heap: formatBytes(mem.heapUsed),
    platform: os.platform(),
    node: process.version,
    cpu: os.cpus()[0]?.model || '-'
  }
}

// ============================================================
// LOCAL THUMBNAIL
// ============================================================

async function getThumbnail(input) {
  try {
    // Buffer custom
    if (input && Buffer.isBuffer(input)) {
      return await sharp(input)
        .resize(300, 300, {
          fit: 'cover'
        })
        .jpeg({
          quality: 80
        })
        .toBuffer()
    }

    // Path custom
    if (
      input &&
      typeof input === 'string' &&
      fs.existsSync(input)
    ) {
      const buffer = fs.readFileSync(input)

      return await sharp(buffer)
        .resize(300, 300, {
          fit: 'cover'
        })
        .jpeg({
          quality: 80
        })
        .toBuffer()
    }

    // Default local thumbnail
    if (fs.existsSync(THUMB_PATH)) {
      return fs.readFileSync(THUMB_PATH)
    }

    console.warn('[menu] Thumbnail tidak ditemukan:', THUMB_PATH)

    return Buffer.alloc(0)
  } catch (e) {
    console.error('[menu] thumbnail error:', e)

    return Buffer.alloc(0)
  }
}

// ============================================================
// PLUGIN CACHE
// ============================================================

function buildPluginCache() {
  if (menuCache.has('plugins')) {
    return menuCache.get('plugins')
  }

  const plugins = Object.values(global.plugins || {})
    .filter(p => !p.disabled)

  const categories = {}

  for (const plugin of plugins) {
    const help = Array.isArray(plugin.help)
      ? plugin.help
      : plugin.help
        ? [plugin.help]
        : []

    const tags = Array.isArray(plugin.tags)
      ? plugin.tags
      : plugin.tags
        ? [plugin.tags]
        : []

    for (const tag of tags) {
      if (!tag) continue

      if (!categories[tag]) {
        categories[tag] = []
      }

      categories[tag].push({
        help,
        limit: !!plugin.limit,
        premium: !!plugin.premium,
        owner: !!plugin.owner,
        admin: !!plugin.admin,
        prefix: !!plugin.customPrefix
      })
    }
  }

  menuCache.set('plugins', {
    plugins,
    categories
  })

  return menuCache.get('plugins')
}

// ============================================================
// STYLE 1 — CLEAN ELEGANCE
// ============================================================

async function sendStyle1(
  conn,
  m,
  {
    d,
    sys,
    thumb,
    categories,
    categoryList,
    usedPrefix,
    command
  }
) {
  const sections = [{
    title: `Categories (${categoryList.length})`,

    rows: categoryList.map(tag => ({
      header: BOT_NAME,

      title: formatTag(tag),

      description:
        `${categories[tag].reduce(
          (a, b) => a + b.help.length,
          0
        )} Commands`,

      id: `${usedPrefix + command} ${tag}`
    }))
  }]

  const caption = [
    `*⟡ ${fontBold(BOT_NAME)} ⟡*`,
    ``,

    `Hi ${fontItalic(d.user)}, ${d.greeting.toLowerCase()}!`,
    ``,

    `┌  ⚲  *P R O F I L E*`,
    `│ ∘ ${fontSmallCaps('Rank')}  : ${fontSmallCaps(d.role)}`,
    `│ ∘ ${fontSmallCaps('Level')} : ${d.level}`,
    `│ ∘ ${fontSmallCaps('Limit')} : ${d.limit}`,
    `└──────────────⟡`,
    ``,

    `┌  ⚲  *S Y S T E M*`,
    `│ ∘ ${fontSmallCaps('Uptime')} : ${d.runtime}`,
    `│ ∘ ${fontSmallCaps('Memory')} : ${sys.ram}`,
    `│ ∘ ${fontSmallCaps('Total')}  : ${d.commands} cmds`,
    `└──────────────⟡`,
    ``,

    `  [ ${d.progress} ] ${d.percent}%`,
    ``,

    `  _"${fontItalic(d.quote)}"_`
  ].join('\n')

  return conn.sendMessage(
    m.chat,
    {
      image: thumb,
      caption,

      footer: `${BOT_NAME} • Clean UI`,

      optionTitle: BOT_NAME,
      optionText: 'Open Menu',
      offerText: 'Dashboard',
      offerCode: 'Bot-MD',

      interactiveAsTemplate: false,

      nativeFlow: [
        {
          text: '≡ Categories',
          sections
        },

        {
          text: '▤ All Menu',
          id: `${usedPrefix + command} all`
        },

        {
          text: '♡ Thanks to',
          id: `${usedPrefix}tqto`
        },

        {
          text: '◷ Runtime',
          copy: d.runtime
        },

        {
          text: '⟡ Owner',
          id: `${usedPrefix}owner`
        }
      ]
    },
    {
      quoted: m
    }
  )
}

// ============================================================
// STYLE 2 — SOFT AESTHETIC
// ============================================================

async function sendStyle2(
  conn,
  m,
  {
    d,
    sys,
    thumb,
    categories,
    categoryList,
    usedPrefix,
    command
  }
) {
  const rows = categoryList.map(tag => ({
    title: formatTag(tag),

    description:
      `${categories[tag].reduce(
        (a, b) => a + b.help.length,
        0
      )} Commands`,

    id: `${usedPrefix + command} ${tag}`
  }))

  const caption = [
    `🎀 ‧₊˚ ೀ *${fontBold(BOT_NAME)}* ೀ ‧₊˚ 🎀`,
    ``,

    `Hii ${fontItalic(d.user)}! ♡`,
    ``,

    ` ৎ ݂ ⁺ ${fontSmallCaps('Role')}   : ${d.role}`,
    ` ৎ ݂ ⁺ ${fontSmallCaps('Level')}  : ${d.level}`,
    ` ৎ ݂ ⁺ ${fontSmallCaps('Limit')}  : ${d.limit}`,
    ``,

    ` ৎ ݂ ⁺ ${fontSmallCaps('Uptime')} : ${d.runtime}`,
    ` ৎ ݂ ⁺ ${fontSmallCaps('Cmds')}   : ${d.commands}`,
    ` ৎ ݂ ⁺ ${fontSmallCaps('Ping')}   : ${sys.ram}`,
    ``,

    `💌 _"${fontItalic(d.quote)}"_`
  ].join('\n')

  return conn.sendMessage(
    m.chat,
    {
      image: thumb,
      caption,

      footer: `♡ ${BOT_NAME} Soft Edition ♡`,

      buttons: [{
        text: '≡ View Menus ⋆',

        sections: [{
          title: 'Categories',
          rows
        }]
      }]
    },
    {
      quoted: m
    }
  )
}

// ============================================================
// STYLE 3 — MODERN DEV
// ============================================================

async function sendStyle3(
  conn,
  m,
  {
    d,
    sys,
    thumb,
    categories,
    categoryList,
    usedPrefix,
    command
  }
) {
  const moduleList = categoryList
    .map(tag => {
      const total = categories[tag]
        .reduce(
          (a, b) => a + b.help.length,
          0
        )

      return `  │ ⊳ ${fontSmallCaps(
        formatTag(tag)
      ).padEnd(12, ' ')} [${total}]`
    })
    .join('\n')

  const caption = [
    `╭───[ ${fontBold(BOT_NAME + '_CORE')} ]───`,
    `│ root@system:~# ./status --all`,
    `│`,
    `│ ❖ ${fontBold('USER_DATA')}`,
    `│   ⊳ ID    : ${d.user}`,
    `│   ⊳ CLASS : ${d.role.toUpperCase()}`,
    `│   ⊳ LIMIT : ${d.limit}`,
    `│`,
    `│ ❖ ${fontBold('SYS_INFO')}`,
    `│   ⊳ UPTIME: ${d.runtime}`,
    `│   ⊳ MEMORY: ${sys.ram}`,
    `│   ⊳ STATUS: ONLINE`,
    `│`,
    `│ [${d.progress}] ${d.percent}%`,
    `╰─────────────────────────`,
    ``,
    `╭───[ ${fontBold('MODULES')} ]───`,
    `│ root@system:~# ./modules -l`,
    `│`,
    moduleList,
    `│`,
    `│ Execute > ${usedPrefix + command} all < to view`,
    `╰─────────────────────────`
  ].join('\n')

  return conn.sendMessage(
    m.chat,
    {
      image: thumb,
      caption
    },
    {
      quoted: m
    }
  )
}

// ============================================================
// STYLE 4 — SIMPLE DASHBOARD
// ============================================================

async function sendStyle4(
  conn,
  m,
  {
    d,
    sys,
    usedPrefix,
    command
  }
) {
  // Selalu gunakan thumbnail lokal
  const thumb4 = await getThumbnail()

  const mode =
    global.opts && global.opts.self
      ? 'SELF'
      : 'PUBLIC'

  const ping =
    Math.floor(Math.random() * 20) + 5

  const contentText = [
    `*✧ ─── [ ${BOT_NAME.toUpperCase()} DASHBOARD ] ─── ✧*`,
    ``,

    ` ┌  *U S E R   I N F O*`,
    ` │ ⟡ Name : ${d.user}`,
    ` │ ⟡ Mode : ${mode}`,
    ` │ ⟡ Ping : ${ping}ms`,
    ` └───────────────`,
    ``,

    ` ┌  *S Y S T E M   I N F O*`,
    ` │ ⟡ Cmds   : ${d.commands} deployed`,
    ` │ ⟡ RAM    : ${sys.ram}`,
    ` │ ⟡ Node   : ${sys.node}`,
    ` │ ⟡ Uptime : ${d.runtime}`,
    ` └───────────────`,
    ``,

    `   [ ${d.progress} ] ${d.percent}%`
  ].join('\n')

  return conn.relayMessage(
    m.chat,
    {
      buttonsMessage: {
        locationMessage: {
          degreesLatitude: 0,
          degreesLongitude: 0,

          name: `✧ ${BOT_NAME} ✧`,

          address:
            global.ownername ||
            BOT_AUTHOR,

          jpegThumbnail: thumb4
        },

        contentText,

        footerText:
          `✧ ${BOT_NAME} ✧`,

        buttons: [
          {
            buttonId:
              `${usedPrefix + command} all`,

            buttonText: {
              displayText:
                '≡ Interface'
            },

            type: 1
          },

          {
            buttonId:
              `${usedPrefix}ping`,

            buttonText: {
              displayText:
                '⟳ Latency'
            },

            type: 1
          },

          {
            buttonId:
              `${usedPrefix}owner`,

            buttonText: {
              displayText:
                '⟡ Creator'
            },

            type: 1
          }
        ],

        headerType: 6
      }
    },
    {}
  )
}

// ============================================================
// DETAIL MENU
// ============================================================

async function sendDetail(
  conn,
  m,
  {
    d,
    thumb,
    categories,
    showTags,
    usedPrefix
  }
) {
  let text = [
    `*⟡ ${fontBold(BOT_NAME)} ⟡*`,
    ``,

    `∘ ${fontSmallCaps('Role')}  : ${d.role}`,
    `∘ ${fontSmallCaps('Level')} : ${d.level}`,
    `∘ ${fontSmallCaps('Limit')} : ${d.limit}`,
    `────────────────`
  ].join('\n')

  for (const tag of showTags) {
    const menus = categories[tag]

    const total = menus.reduce(
      (sum, item) =>
        sum + item.help.length,
      0
    )

    text +=
      '\n\n' +
      `┌  ⚲  *${formatTag(tag).toUpperCase()}* [${total}]` +
      '\n│\n'

    for (const item of menus) {
      for (const cmd of item.help) {
        text +=
          `│ ∘ ${item.prefix ? '' : usedPrefix}${cmd}${getBadge(item)}\n`
      }
    }

    text +=
      `└──────────────⟡`
  }

  text +=
    '\n\n' +
    `  _"${fontItalic(d.quote)}"_`

  return conn.sendMessage(
    m.chat,
    {
      image: thumb,
      caption: text
    },
    {
      quoted: m
    }
  )
}

// ============================================================
// HANDLER
// ============================================================

let handler = async (
  m,
  {
    conn,
    usedPrefix,
    command,
    text,
    isOwner
  }
) => {

  // ==========================================================
  // DATABASE
  // ==========================================================

  if (!global.db) {
    global.db = {
      data: {}
    }
  }

  const db = global.db.data

  if (!db.users)
    db.users = {}

  if (!db.settings)
    db.settings = {}

  if (!db.users[m.sender])
    db.users[m.sender] = {}

  if (!db.settings[conn.user.jid]) {
    db.settings[conn.user.jid] = {
      setmenu: 1
    }
  }

  // ==========================================================
  // USER DATA
  // ==========================================================

  const user =
    db.users[m.sender]

  const setting =
    db.settings[conn.user.jid]

  const menuStyle =
    Number(setting.setmenu || 1)

  const menuType =
    (text || '')
      .trim()
      .toLowerCase() ||
    'list'

  const {
    level = 0,
    exp = 0,
    role = 'Beginner',
    limit = 0,
    premiumTime = 0
  } = user

  const name =
    await conn.getName(m.sender)

  // ==========================================================
  // PLUGIN DATA
  // ==========================================================

  const {
    plugins,
    categories
  } = buildPluginCache()

  const categoryList =
    Object.keys(categories).sort()

  const totalCommands =
    plugins.reduce((a, p) => {
      if (!p.help)
        return a

      return a +
        (
          Array.isArray(p.help)
            ? p.help.length
            : 1
        )
    }, 0)

  // ==========================================================
  // XP
  // ==========================================================

  const xp =
    levelling.xpRange(level)

  const percent =
    Math.min(
      100,
      Math.floor(
        (exp /
          Math.max(
            xp.max,
            1
          )) * 100
      )
    )

  // ==========================================================
  // STATS
  // ==========================================================

  const totalUsers =
    global.db?.data?.users
      ? Object.keys(
          global.db.data.users
        ).length
      : 0

  const totalChats =
    global.db?.data?.chats
      ? Object.keys(
          global.db.data.chats
        ).length
      : 0

  const d = {
    greeting: ucapan(),
    user: name,
    role,
    level,

    limit:
      isOwner ||
      premiumTime > 0
        ? 'Unlimited'
        : String(limit),

    runtime:
      runtime(),

    commands:
      totalCommands,

    categories:
      categoryList.length,

    progress:
      progressBar(percent),

    percent,

    quote:
      randomQuote(),

    totalUsers,

    totalChats
  }

  const sys =
    systemInfo()

  // ==========================================================
  // LOCAL THUMBNAIL
  // ==========================================================

  const thumb =
    await getThumbnail()

  const ctx = {
    d,
    sys,
    thumb,
    categories,
    categoryList,
    usedPrefix,
    command
  }

  // ==========================================================
  // LOCAL AUDIO
  // ==========================================================

  const last =
    cooldown.get(m.sender) || 0

  if (
    Date.now() - last >
    COOLDOWN_MS
  ) {
    cooldown.set(
      m.sender,
      Date.now()
    )

    if (fs.existsSync(AUDIO_PATH)) {
      try {
        await conn.sendFile(
          m.chat,

          AUDIO_PATH,

          'menu.aac',

          '',

          m,

          true,

          {
            mimetype:
              'audio/aac',

            ptt:
              true
          }
        )
      } catch (e) {
        console.error(
          '[menu] audio error:',
          e
        )
      }
    } else {
      console.warn(
        '[menu] Audio tidak ditemukan:',
        AUDIO_PATH
      )
    }
  }

  // ==========================================================
  // MAIN LIST
  // ==========================================================

  if (menuType === 'list') {

    if (menuStyle === 1)
      return sendStyle1(
        conn,
        m,
        ctx
      )

    if (menuStyle === 2)
      return sendStyle2(
        conn,
        m,
        ctx
      )

    if (menuStyle === 3)
      return sendStyle3(
        conn,
        m,
        ctx
      )

    if (menuStyle === 4)
      return sendStyle4(
        conn,
        m,
        ctx
      )
  }

  // ==========================================================
  // DETAIL / ALL
  // ==========================================================

  const showTags =
    menuType === 'all'
      ? categoryList
      : categories[menuType]
        ? [menuType]
        : []

  if (!showTags.length) {
    return m.reply(
      `Menu "${text}" tidak ditemukan.`
    )
  }

  return sendDetail(
    conn,
    m,
    {
      ...ctx,
      showTags
    }
  )
}

// ============================================================
// CACHE REFRESH
// ============================================================

setInterval(() => {
  try {
    menuCache.clear()
  } catch {}
}, CACHE_REFRESH_MS)

// ============================================================
// HANDLER CONFIG
// ============================================================

handler.help = [
  'menu',
  'help',
  'perintah'
]

handler.tags = [
  'main'
]

handler.command =
  /^(menu|help|perintah)$/i

export default handler


