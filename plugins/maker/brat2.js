import {
  createCanvas,
  GlobalFonts
} from '@napi-rs/canvas'
import { spawn } from 'child_process'
import { ffmpegPath } from '../../lib/ffmpeg-path.js'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LIBRARY = path.join(__dirname, 'Library')

const POSITION = {
  x: 0,
  y: 0
}

const FONTS = {
  anton: {
    name: 'Anton',
    file: 'Anton-Regular.ttf',
    url: 'https://cdn.nekohime.site/file/5jal401q.ttf'
  },
  emoji: {
    name: 'AppleColorEmoji',
    file: 'AppleColorEmoji.ttf',
    url: 'https://cdn.nekohime.site/file/6q0yhlcg.ttf'
  }
}

const W = 720
const H = 720
const FPS = 30
const DURATION = 4
const FRAMES = FPS * DURATION

const WORD_DELAY = 2
const ZOOM_FRAMES = 7
const SHINE_FRAMES = 32
const SHINE_WIDTH = 260

const MAX_WORDS_PER_LINE = 2
const MAX_TEXT_WIDTH = 590
const MIN_FONT_SIZE = 35
const MAX_FONT_SIZE = 105

const EMOJI_SIZE = 76
const EMOJI_GAP = 10

async function downloadFile(url, file) {
  if (fs.existsSync(file)) return

  await new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        return downloadFile(
          res.headers.location,
          file
        ).then(resolve).catch(reject)
      }

      if (res.statusCode !== 200) {
        return reject(
          new Error(`HTTP ${res.statusCode}`)
        )
      }

      const stream =
        fs.createWriteStream(file)

      res.pipe(stream)

      stream.on(
        'finish',
        () => stream.close(resolve)
      )

      stream.on(
        'error',
        reject
      )
    })

    req.on(
      'error',
      reject
    )

    req.setTimeout(
      30000,
      () => req.destroy(
        new Error(
          'Download timeout'
        )
      )
    )
  })
}

async function loadFonts() {
  if (!fs.existsSync(LIBRARY)) {
    fs.mkdirSync(
      LIBRARY,
      { recursive: true }
    )
  }

  const antonPath =
    path.join(
      LIBRARY,
      FONTS.anton.file
    )

  const emojiPath =
    path.join(
      LIBRARY,
      FONTS.emoji.file
    )

  await downloadFile(
    FONTS.anton.url,
    antonPath
  )

  await downloadFile(
    FONTS.emoji.url,
    emojiPath
  )

  if (
    !GlobalFonts.has(
      FONTS.anton.name
    )
  ) {
    GlobalFonts.registerFromPath(
      antonPath,
      FONTS.anton.name
    )
  }

  if (
    !GlobalFonts.has(
      FONTS.emoji.name
    )
  ) {
    GlobalFonts.registerFromPath(
      emojiPath,
      FONTS.emoji.name
    )
  }
}

function easeOutBack(t) {
  const c1 = 1.70158
  const c3 = c1 + 1

  return (
    1 +
    c3 * Math.pow(t - 1, 3) +
    c1 * Math.pow(t - 1, 2)
  )
}

function easeOutQuart(t) {
  return 1 -
    Math.pow(1 - t, 4)
}

function getScale(elapsed) {
  const p =
    Math.min(
      1,
      elapsed / ZOOM_FRAMES
    )

  if (p < 0.72) {
    const t = p / 0.72

    return (
      0.08 +
      easeOutBack(t) *
      1.02
    )
  }

  const t =
    (p - 0.72) / 0.28

  return (
    1.10 -
    easeOutQuart(t) *
    0.10
  )
}

function getShine(elapsed) {
  return (
    (elapsed % SHINE_FRAMES) /
    SHINE_FRAMES
  )
}

function applyShine(
  image,
  width,
  height,
  elapsed
) {
  const ictx =
    image.getContext('2d')

  const mask =
    ictx.getImageData(
      0,
      0,
      width,
      height
    )

  const result =
    createCanvas(
      width,
      height
    )

  const rctx =
    result.getContext('2d')

  const p =
    getShine(elapsed)

  const start =
    -width - height

  const end =
    width + height

  const travel =
    start +
    p * (end - start)

  const gradient =
    rctx.createLinearGradient(
      travel -
        height -
        SHINE_WIDTH,
      -height,
      travel +
        height +
        SHINE_WIDTH,
      height
    )

  gradient.addColorStop(
    0,
    'rgba(255,255,255,0)'
  )

  gradient.addColorStop(
    0.25,
    'rgba(255,255,255,0)'
  )

  gradient.addColorStop(
    0.38,
    'rgba(255,255,255,0.18)'
  )

  gradient.addColorStop(
    0.44,
    'rgba(255,255,255,0.42)'
  )

  gradient.addColorStop(
    0.48,
    'rgba(255,255,255,0.78)'
  )

  gradient.addColorStop(
    0.50,
    'rgba(255,255,255,1)'
  )

  gradient.addColorStop(
    0.52,
    'rgba(255,255,255,0.78)'
  )

  gradient.addColorStop(
    0.56,
    'rgba(255,255,255,0.42)'
  )

  gradient.addColorStop(
    0.62,
    'rgba(255,255,255,0.18)'
  )

  gradient.addColorStop(
    0.75,
    'rgba(255,255,255,0)'
  )

  gradient.addColorStop(
    1,
    'rgba(255,255,255,0)'
  )

  rctx.fillStyle =
    gradient

  rctx.fillRect(
    0,
    0,
    width,
    height
  )

  const light =
    rctx.getImageData(
      0,
      0,
      width,
      height
    )

  for (
    let i = 0;
    i < light.data.length;
    i += 4
  ) {
    light.data[i] = 255
    light.data[i + 1] = 255
    light.data[i + 2] = 255

    light.data[i + 3] =
      Math.min(
        mask.data[i + 3],
        light.data[i + 3]
      )
  }

  rctx.putImageData(
    light,
    0,
    0
  )

  return result
}

function parseTokens(text) {
  const regex =
    /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu

  const result = []

  let last = 0

  for (
    const match of text.matchAll(regex)
  ) {
    const index = match.index

    if (index > last) {
      const words =
        text
          .slice(last, index)
          .trim()
          .split(/\s+/)
          .filter(Boolean)

      for (
        const word of words
      ) {
        result.push({
          type: 'word',
          text: word
        })
      }
    }

    result.push({
      type: 'emoji',
      text: match[0]
    })

    last =
      index +
      match[0].length
  }

  if (last < text.length) {
    const words =
      text
        .slice(last)
        .trim()
        .split(/\s+/)
        .filter(Boolean)

    for (
      const word of words
    ) {
      result.push({
        type: 'word',
        text: word
      })
    }
  }

  return result
}

async function makeVideo(text) {
  await loadFonts()

  const canvas =
    createCanvas(W, H)

  const ctx =
    canvas.getContext('2d')

  const tokens =
    parseTokens(text)

  let fontSize =
    MAX_FONT_SIZE

  let lines = []

  while (
    fontSize >=
    MIN_FONT_SIZE
  ) {
    ctx.font =
      `900 ${fontSize}px "${FONTS.anton.name}"`

    lines = []

    for (
      let i = 0;
      i < tokens.length;
      i += MAX_WORDS_PER_LINE
    ) {
      lines.push(
        tokens.slice(
          i,
          i +
            MAX_WORDS_PER_LINE
        )
      )
    }

    const lineHeight =
      fontSize * 1.05

    let valid = true

    for (
      const line of lines
    ) {
      let width = 0

      for (
        let i = 0;
        i < line.length;
        i++
      ) {
        const item =
          line[i]

        if (
          item.type === 'word'
        ) {
          width +=
            ctx.measureText(
              item.text
            ).width
        } else {
          width +=
            EMOJI_SIZE
        }

        if (
          i <
          line.length - 1
        ) {
          width +=
            ctx.measureText(
              ' '
            ).width
        }
      }

      if (
        width >
        MAX_TEXT_WIDTH
      ) {
        valid = false
        break
      }
    }

    if (
      valid &&
      lines.length *
        lineHeight <=
        500
    ) {
      break
    }

    fontSize -= 2
  }

  ctx.font =
    `900 ${fontSize}px "${FONTS.anton.name}"`

  const lineHeight =
    fontSize * 1.05

  const totalHeight =
    lines.length *
    lineHeight

  const startY =
    H / 2 -
    totalHeight / 2 +
    POSITION.y

  const items = []

  let globalIndex = 0

  for (
    let li = 0;
    li < lines.length;
    li++
  ) {
    const line =
      lines[li]

    let totalWidth = 0

    const widths = []

    for (
      const item of line
    ) {
      let width

      if (
        item.type === 'word'
      ) {
        width =
          ctx.measureText(
            item.text
          ).width
      } else {
        width =
          EMOJI_SIZE
      }

      widths.push(width)
      totalWidth += width
    }

    totalWidth +=
      ctx.measureText(
        ' '
      ).width *
      (line.length - 1)

    let x =
      (W -
        totalWidth) /
        2 +
      POSITION.x

    for (
      let i = 0;
      i < line.length;
      i++
    ) {
      const item =
        line[i]

      const width =
        widths[i]

      items.push({
        ...item,
        x:
          x +
          width / 2,
        y:
          startY +
          li *
            lineHeight +
          fontSize / 2,
        width,
        index:
          globalIndex++
      })

      x +=
        width +
        ctx.measureText(
          ' '
        ).width
    }
  }

  const ff =
    spawn(
      ffmpegPath,
      [
        '-y',
        '-f',
        'image2pipe',
        '-vcodec',
        'png',
        '-r',
        String(FPS),
        '-i',
        '-',
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        'frag_keyframe+empty_moov',
        '-f',
        'mp4',
        'pipe:1'
      ]
    )

  const chunks = []

  ff.stdout.on(
    'data',
    chunk =>
      chunks.push(chunk)
  )

  const done =
    new Promise(
      (resolve, reject) => {
        ff.on(
          'close',
          code => {
            if (code === 0)
              resolve()
            else
              reject(
                new Error(
                  `ffmpeg ${code}`
                )
              )
          }
        )

        ff.on(
          'error',
          reject
        )
      }
    )

  for (
    let frame = 0;
    frame < FRAMES;
    frame++
  ) {
    ctx.fillStyle =
      '#fff'

    ctx.fillRect(
      0,
      0,
      W,
      H
    )

    for (
      const item of items
    ) {
      const elapsed =
        frame -
        item.index *
          WORD_DELAY

      if (
        elapsed < 0
      )
        continue

      const scale =
        getScale(
          elapsed
        )

      ctx.save()

      ctx.translate(
        item.x,
        item.y
      )

      ctx.scale(
        scale,
        scale
      )

      if (
        item.type === 'word'
      ) {
        ctx.font =
          `900 ${fontSize}px "${FONTS.anton.name}"`

        ctx.textAlign =
          'center'

        ctx.textBaseline =
          'middle'

        ctx.fillStyle =
          '#000'

        ctx.fillText(
          item.text,
          0,
          0
        )

        const sw =
          Math.ceil(
            item.width + 240
          )

        const sh =
          Math.ceil(
            fontSize + 240
          )

        const base =
          createCanvas(
            sw,
            sh
          )

        const bctx =
          base.getContext(
            '2d'
          )

        bctx.font =
          `900 ${fontSize}px "${FONTS.anton.name}"`

        bctx.textAlign =
          'center'

        bctx.textBaseline =
          'middle'

        bctx.fillStyle =
          '#fff'

        bctx.fillText(
          item.text,
          sw / 2,
          sh / 2
        )

        const highlight =
          applyShine(
            base,
            sw,
            sh,
            elapsed
          )

        ctx.drawImage(
          highlight,
          -sw / 2,
          -sh / 2
        )
      } else {
        const size =
          EMOJI_SIZE + 240

        const base =
          createCanvas(
            size,
            size
          )

        const ectx =
          base.getContext(
            '2d'
          )

        ectx.font =
          `${EMOJI_SIZE}px "${FONTS.emoji.name}"`

        ectx.textAlign =
          'center'

        ectx.textBaseline =
          'middle'

        ectx.fillText(
          item.text,
          size / 2,
          size / 2
        )

        ctx.drawImage(
          base,
          -size / 2,
          -size / 2
        )

        const highlight =
          applyShine(
            base,
            size,
            size,
            elapsed
          )

        ctx.drawImage(
          highlight,
          -size / 2,
          -size / 2
        )
      }

      ctx.restore()
    }

    ff.stdin.write(
      canvas.toBuffer(
        'image/png'
      )
    )
  }

  ff.stdin.end()

  await done

  return Buffer.concat(
    chunks
  )
}

const handler = async (
  m,
  {
    conn,
    text
  }
) => {
  if (!text) {
    return m.reply(
      'Contoh: .brat2 hai 😪'
    )
  }

  try {
    const video =
      await makeVideo(
        text
      )

    await conn.sendMessage(
      m.chat,
      {
        video,
        mimetype:
          'video/mp4',
        fileName:
          'brat.mp4',
        gifPlayback:
        true
      },
      {
        quoted: m
      }
    )
  } catch (e) {
    m.reply(
      `Gagal: ${e.message}`
    )
  }
}

handler.help = [
  'brat2 <teks>'
]

handler.tags = [
  'maker'
]

handler.command = [
  'brat2'
]

handler.limit = true

export default handler
