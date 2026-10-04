import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pathToFileURL } from 'url';
import { join } from 'path';
import { promises as fs } from 'fs';

const ROOT = join('C:', 'Users', 'RAFA PC', 'Documents', 'KIDOU MD');
const imp = rel => import(pathToFileURL(join(ROOT, rel)).href);
const fp = await imp('lib/ffmpeg-path.js');
const execAsync = promisify(exec);

await fs.mkdir(join(ROOT, 'tmp'), { recursive: true });

// Path contains a space ("RAFA PC"), so shell quoting is the real risk here.
console.log('ffmpegShell()       :', fp.ffmpegShell());
console.log('path has space      :', fp.ffmpegPath.includes(' '));

// 1) exec() string path with quoted binary (vn.js / _allmenu.js / pinvideo style)
const out = join(ROOT, 'tmp', 'smoke-exec.ogg');
const cmd = `${fp.ffmpegShell()} -y -i "node_modules\\@ffprobe-installer\\win32-x64\\ffprobe.exe" -version 2>&1 | more`;
const cmd2 = `${fp.ffmpegShell()} -f lavfi -i "sine=frequency=440:duration=1" -vn -c:a libopus -b:a 128k "${out}"`;
await execAsync(cmd2);
const ogg = await fs.readFile(out);
console.log('exec() ogg bytes    :', ogg.length);
console.log('exec() ogg magic    :', ogg.subarray(0, 4).toString('ascii'));
await fs.unlink(out);

// 2) webp2mp4 (uses BOTH ffprobe for duration and ffmpeg for the encode)
const webp = join(ROOT, 'tmp', 'smoke.webp');
await new Promise((res, rej) => {
	const c = spawn(fp.ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=512x512:duration=2', webp], { stdio: 'ignore' });
	c.on('error', rej);
	c.on('close', code => (code === 0 ? res() : rej(new Error('webp gen failed ' + code))));
});
console.log('test webp bytes     :', (await fs.readFile(webp)).length);

const { webp2mp4 } = await imp('lib/webp2mp4.js');
const r = await webp2mp4(await fs.readFile(webp));
console.log('webp2mp4 result     :', r?.success ?? JSON.stringify(r).slice(0, 80));
if (r?.data) {
	console.log('webp2mp4 mp4 bytes  :', r.data.length);
	console.log('webp2mp4 mp4 magic  :', r.data.subarray(4, 8).toString('ascii'));
	await r.delete?.();
}
await fs.unlink(webp).catch(() => {});

console.log('\nEXEC + FFPROBE SMOKE TESTS PASSED');