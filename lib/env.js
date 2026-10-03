/**
 * Minimal .env loader (tanpa dependency eksternal).
 *
 * Node >= 20.6 punya `node --env-file=.env`, tapi itu gagal keras kalau
 * file tidak ada. Loader di sini aman: file opsional, dan variabel yang
 * sudah ada di environment asli TIDAK ditimpa.
 *
 * Dipanggil pertama kali di main.js sebelum config.js di-import,
 * supaya `process.env.X` di config.js sudah terisi.
 */
import fs from 'node:fs'
import path from 'node:path'

export function loadEnv(file = '.env') {
	const full = path.resolve(process.cwd(), file)

	if (!fs.existsSync(full)) return false

	let content
	try {
		content = fs.readFileSync(full, 'utf8')
	} catch (e) {
		console.warn(`[env] Gagal membaca ${file}: ${e.message}`)
		return false
	}

	// buang BOM + karakter yang tidak valid, lalu normalisasi line ending
	content = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')

	let applied = 0
	for (const rawLine of content.split('\n')) {
		const line = rawLine.trim()
		if (!line || line.startsWith('#')) continue

		const eq = line.indexOf('=')
		if (eq === -1) continue

		const key = line.slice(0, eq).trim()
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

		let value = line.slice(eq + 1).trim()

		// hapus inline comment hanya untuk value tanpa kutip
		if (
			!value.startsWith('"') &&
			!value.startsWith("'") &&
			value.includes(' #')
		) {
			value = value.replace(/\s+#.*$/, '').trim()
		}

		// unwrap kutip; konversi escape sederhana di dalam double quote
		if (
			(value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
			(value.startsWith("'") && value.endsWith("'") && value.length > 1)
		) {
			const quote = value[0]
			value = value.slice(1, -1)
			if (quote === '"') {
				value = value
					.replace(/\\n/g, '\n')
					.replace(/\\r/g, '\r')
					.replace(/\\t/g, '\t')
					.replace(/\\"/g, '"')
					.replace(/\\\\/g, '\\')
			}
		}

		// environment asli selalu menang
		if (process.env[key] === undefined) {
			process.env[key] = value
			applied++
		}
	}

	if (applied) console.log(`[env] ${applied} variabel dimuat dari ${file}`)
	return true
}

export default loadEnv
