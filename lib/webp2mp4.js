import { tmpdir } from 'os'
import { join } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import sharp from 'sharp'
import webpmux from 'node-webpmux'
import { ffmpegPath } from './ffmpeg-path.js'

const TMP_PREFIX = 'webp2mp4'

function tmp(ext) {
    return join(tmpdir(), `${TMP_PREFIX}-${randomBytes(6).toString('hex')}.${ext}`)
}

/**
 * Neither the npm-shipped ffmpeg builds nor the common system builds are
 * compiled with libwebp_anim, so `ffmpeg -i sticker.webp` cannot demux an
 * animated sticker (it reports "image data not found"). libvips handles
 * animated WebP natively, so frames are decoded here and piped to ffmpeg as
 * PNG instead. This keeps the dependency on ffmpeg down to plain H.264
 * encoding, which every build supports.
 */
async function extractFrames(buffer) {
    const image = sharp(buffer, { animated: true })
    const meta = await image.metadata()

    if (!meta.pages || meta.pages < 2) {
        throw new Error('Bukan sticker animasi. Gunakan command webp2mp4 pada sticker bergerak.')
    }

    // Average the per-frame delay reported by the ANMF chunks so playback
    // speed is preserved. Fall back to 10fps when nothing usable is found.
    let fps = 10

    try {
        const muxer = new webpmux.Image()
        await muxer.load(buffer)
        muxer.convertToAnim()
        const delays = (muxer.frames || []).map(f => Number(f.delay)).filter(d => d > 0)
        if (delays.length) {
            const avg = delays.reduce((a, b) => a + b, 0) / delays.length
            fps = Math.min(30, Math.max(5, Math.round(1000 / avg)))
        }
    } catch {
        // keep the default framerate
    }

    const size = meta.pageHeight || meta.height || 512
    const frames = []

    for (let page = 0; page < meta.pages; page++) {
        frames.push(
            await sharp(buffer, { page })
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                })
                .png({ compressionLevel: 6 })
                .toBuffer()
        )
    }

    return { frames, fps, size }
}

async function write(stream, chunk) {
    if (stream.write(chunk)) return
    await new Promise(resolve => stream.once('drain', resolve))
}

export async function webp2mp4(buffer) {
    const { frames, fps, size } = await extractFrames(buffer)

    const output = tmp('mp4')

    try {
        const ff = spawn(ffmpegPath, [
            '-y',
            '-f', 'image2pipe',
            '-framerate', String(fps),
            '-vcodec', 'png',
            '-i', 'pipe:0',
            '-movflags', 'faststart',
            '-pix_fmt', 'yuv420p',
            '-vf', `scale=${size}:${size}:flags=lanczos,fps=25`,
            '-an',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '28',
            output
        ])

        let stderr = ''
        ff.stderr.on('data', chunk => (stderr += chunk))

        // ffmpeg exits non-zero on broken pipe when it fails mid-stream
        ff.stdin.on('error', () => {})

        try {
            for (const frame of frames) await write(ff.stdin, frame)
            ff.stdin.end()
        } catch {
            // stream already closed by ffmpeg
        }

        const code = await new Promise(resolve => {
            ff.on('error', () => resolve(-1))
            ff.on('close', resolve)
        })

        if (code !== 0) {
            throw new Error(`FFmpeg gagal (code ${code}): ${stderr.trim().split('\n').pop() || 'tidak diketahui'}`)
        }

        const data = readFileSync(output)
        if (!data.length) throw new Error('Hasil konversi kosong.')

        return data
    } finally {
        try {
            unlinkSync(output)
        } catch {}
    }
}