import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import { join } from 'path';
import { promises as fs } from 'fs';

const ROOT = join('C:', 'Users', 'RAFA PC', 'Documents', 'KIDOU MD');
const fp = await import(pathToFileURL(join(ROOT, 'lib', 'ffmpeg-path.js')).href);

const work = join(ROOT, 'tmp');
await fs.mkdir(work, { recursive: true });

// animated webp, which is the real input for webp2mp4
const anim = join(work, 'dbg-anim.webp');
await new Promise((res, rej) => {
	const c = spawn(fp.ffmpegPath, [
		'-y', '-f', 'lavfi', '-i', 'testsrc=size=512x512:rate=10:duration=2',
		'-c:v', 'libwebp', '-loop', '0', '-an', anim,
	], { stdio: 'ignore' });
	c.on('error', rej);
	c.on('close', code => (code === 0 ? res() : rej(new Error('anim gen failed ' + code))));
});
console.log('animated webp bytes :', (await fs.stat(anim)).size);

// what does ffprobe report for duration?
const dur = await new Promise(res => {
	const c = spawn(fp.ffprobePath, ['-v', 'error', '-show_entries', 'format=duration',
		'-of', 'default=noprint_wrappers=1:nokey=1', anim]);
	let o = '';
	c.stdout.on('data', d => (o += d));
	c.on('close', () => res(o.trim()));
});
console.log('ffprobe duration    :', JSON.stringify(dur), '-> parseFloat =', parseFloat(dur));

const mp4 = join(work, 'dbg-out.mp4');
const proc = spawn(fp.ffmpegPath, [
	'-y', '-i', anim,
	'-t', (parseFloat(dur) || 3).toString(),
	'-movflags', 'faststart',
	'-pix_fmt', 'yuv420p',
	'-vf', 'scale=512:512:flags=lanczos,fps=25',
	'-an',
	'-c:v', 'libx264',
	mp4,
]);
let err = '';
proc.stderr.on('data', d => (err += d));
proc.on('close', code => {
	console.log('ffmpeg exit code    :', code);
	console.log('ffmpeg stderr tail  :', err.trim().split('\n').slice(-6).join(' | '));
	const size = require('node:fs').statSync(mp4).size;
	console.log('output mp4 bytes    :', size);
});