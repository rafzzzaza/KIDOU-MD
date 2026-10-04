import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import { join } from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';

const ROOT = join('C:', 'Users', 'RAFA PC', 'Documents', 'KIDOU MD');
const imp = rel => import(pathToFileURL(join(ROOT, rel)).href);

// --- replicate main.js _quickTest ---
const fp = await imp('lib/ffmpeg-path.js');
const probe = (bin, args = []) =>
	new Promise(res => {
		const c = spawn(bin, args, { stdio: 'ignore' });
		let s = false;
		const d = v => { if (!s) { s = true; res(v); } };
		c.on('error', () => d(false));
		c.on('close', code => d(code === 0));
	});

const [ffmpeg, ffprobe, ffmpegWebp] = await Promise.all([
	probe(fp.ffmpegPath, ['-version']),
	probe(fp.ffprobePath, ['-version']),
	probe(fp.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
]);
global.support = Object.freeze({ ffmpeg, ffprobe, ffmpegWebp, convert: false, magick: false, gm: false, find: false });

console.log('support.ffmpeg     :', global.support.ffmpeg);
console.log('support.ffprobe    :', global.support.ffprobe);
console.log('support.ffmpegWebp :', global.support.ffmpegWebp);
console.log('ffmpegShell()      :', fp.ffmpegShell());

await fs.mkdir(join(ROOT, 'tmp'), { recursive: true });

// build a real test image
const png = await sharp({
	create: { width: 600, height: 400, channels: 3, background: { r: 200, g: 120, b: 220 } },
}).png().toBuffer();
console.log('test png bytes      :', png.length);

const { sticker } = await imp('lib/sticker.js');

const t0 = Date.now();
const out = await sticker(png, null, 'AsanagiTest', 'rafzzzaza');
console.log('sticker() ms        :', Date.now() - t0);

if (!out) {
	console.log('RESULT              : FAIL (returned false)');
	process.exit(1);
}
const buf = Buffer.isBuffer(out) ? out : Buffer.from(out);
console.log('RESULT              : OK');
console.log('webp bytes          :', buf.length);
console.log('riff header (webp)  :', buf.subarray(0, 4).toString('ascii'));
console.log('WEBP chunk present  :', buf.includes(Buffer.from('WEBP')));
await out.delete?.().catch?.(() => {});

// --- converter toPTT (spawn path, not fluent-ffmpeg) ---
const conv = await imp('lib/converter.js');
global.__dirname = () => join(ROOT, 'lib');
const { toPTT, toVideo } = conv;

// build a real WAV so the audio encoder has an actual audio stream
const wavPath = join(ROOT, 'tmp', 'smoke-tone.wav');
await new Promise((res, rej) => {
	const c = spawn(fp.ffmpegPath, [
		'-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', wavPath,
	], { stdio: 'ignore' });
	c.on('error', rej);
	c.on('close', code => (code === 0 ? res() : rej(new Error('wav gen failed ' + code))));
});
const wav = await fs.readFile(wavPath);
console.log('test wav bytes      :', wav.length, wav.subarray(0, 4).toString('ascii'));

const ptt = await toPTT(wav, 'wav');
console.log('toPTT bytes         :', ptt.data.length);
console.log('toPTT ogg magic     :', ptt.data.subarray(0, 4).toString('ascii'));
await ptt.delete();

// toVideo: png frames -> mp4 (libx264)
const vid = await toVideo(png, 'png');
console.log('toVideo bytes       :', vid.data.length);
console.log('toVideo ftyp magic  :', vid.data.subarray(4, 8).toString('ascii'));
await vid.delete();

await fs.unlink(wavPath).catch(() => {});
console.log('\nALL SMOKE TESTS PASSED');