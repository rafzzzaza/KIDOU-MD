import { createRequire } from 'module';
import { accessSync, constants } from 'fs';
import fluentFfmpeg from 'fluent-ffmpeg';

const require = createRequire(import.meta.url);

// `which` is CommonJS, so a named ESM import would fail at load time.
const { whichSync } = require('which');

function resolveFromInstaller(pkgName) {
	try {
		const mod = require(pkgName);
		const binPath = typeof mod === 'string' ? mod : mod?.path;
		if (typeof binPath !== 'string' || !binPath) return null;
		accessSync(binPath, constants.X_OK);
		return binPath;
	} catch {
		return null;
	}
}

export const ffmpegPath = resolveFromInstaller('@ffmpeg-installer/ffmpeg') || 'ffmpeg';
export const ffprobePath = resolveFromInstaller('@ffprobe-installer/ffprobe') || 'ffprobe';

export const usingBundledFfmpeg = ffmpegPath !== 'ffmpeg';
export const usingBundledFfprobe = ffprobePath !== 'ffprobe';

export function configureFluentFfmpeg(ff) {
	if (!ff) return ff;

	try {
		if (typeof ff.setFfmpegPath === 'function' && usingBundledFfmpeg) {
			ff.setFfmpegPath(ffmpegPath);
		}
	} catch {}

	try {
		if (typeof ff.setFfprobePath === 'function' && usingBundledFfprobe) {
			ff.setFfprobePath(ffprobePath);
		}
	} catch {}

	return ff;
}

/**
 * Build a spawn/exec argument list that points at the resolved binary
 * instead of relying on PATH lookup.
 */
export function ffmpegArgs(args = []) {
	return [ffmpegPath, ...args];
}

export function ffprobeArgs(args = []) {
	return [ffprobePath, ...args];
}

/**
 * Wrap a resolved binary in double quotes so it survives shell
 * interpolation in `exec()`. Double quotes work in both cmd.exe and sh,
 * and the project path may contain spaces.
 */
export function shellQuote(binPath) {
	return `"${String(binPath).replace(/"/g, '\\"')}"`;
}

export const ffmpegShell = () => shellQuote(ffmpegPath);
export const ffprobeShell = () => shellQuote(ffprobePath);

/**
 * Pre-configured fluent-ffmpeg. Import this instead of `fluent-ffmpeg`
 * directly so the resolved binary paths are honoured everywhere.
 */
export const configuredFluentFfmpeg = configureFluentFfmpeg(fluentFfmpeg);

export default configuredFluentFfmpeg;

/**
 * Windows ships `convert.exe` (a FAT-to-NTFS filesystem conversion tool)
 * and `find.exe` (a text search tool) inside the Windows directory. Both
 * shadow the real ImageMagick / GNU findutils binaries, so a plain PATH
 * probe reports them as "available". Resolve the absolute path and treat
 * anything living under the Windows directory as the impostor.
 */
export function resolveFromPath(binName) {
	if (!binName) return null;
	try {
		return whichSync(binName, { path: process.env.PATH, windowsHide: true }) || null;
	} catch {
		return null;
	}
}

export function isWindowsSystemBinary(absPath) {
	if (process.platform !== 'win32' || !absPath) return false;
	const winRoot = String(process.env.SystemRoot || 'C:\\Windows').toLowerCase();
	const target = String(absPath).toLowerCase().replace(/\//g, '\\');
	return target.startsWith(`${winRoot}\\`) || target.startsWith(`${winRoot.replace(/\\$/, '')}\\`);
}