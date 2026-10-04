import fs from 'fs'
import path from 'path'



const dbPath = path.join(process.cwd(), 'lib', 'chat.json')
const tmpPath = dbPath + '.tmp'
const FLUSH_INTERVAL = 5000



/* ================= LOAD (sekali, async) ================= */

// Counter disimpan di memori. Versi lama membaca + parse ulang seluruh
// file (ratusan KB) dan menulis ulang seluruh file untuk SETIAP pesan grup,
// sehingga biaya per pesan tumbuh seiring jumlah chat/user.
let db = null
let loadError = false
let loading = null

const loadDB = async () => {

    if (db) return db

    if (!loading) {

        loading = (async () => {

            try {

                await fs.promises.mkdir(path.dirname(dbPath), { recursive: true })

                if (!fs.existsSync(dbPath)) {

                    await fs.promises.writeFile(dbPath, JSON.stringify({}))

                }

                const parsed = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'))
                db = (parsed && typeof parsed === 'object') ? parsed : {}

            } catch (e) {

                // JANGAN kembali ke {} lalu menimpanya: file yang gagal parse
                // masih bisa diamankan, dan menimpanya akan menghapus SEMUA
                // counter secara permanen. Kita lanjut di memori, dan file
                // asli disalin ke cadangan sebelum ditulis ulang.
                loadError = true
                db = {}
                console.error(`[totalchat-listener] gagal baca ${dbPath}:`, e.message)

            }

            return db

        })()

    }

    return loading

}



/* ================= SAVE (atomic + serial) ================= */

let flushTimer = null
let writing = null

const writeNow = async () => {

    // Serialisasi: hanya satu penulisan berjalan, penumpukan berikutnya
    // menunggu. Tanpa ini, dua pesan berdekatan bisa saling menimpa
    // hasil read-modify-write dan counter hilang.
    if (writing) return writing

    writing = (async () => {

        try {

            await fs.promises.mkdir(path.dirname(dbPath), { recursive: true })

            if (loadError && fs.existsSync(dbPath)) {

                const backup = `${dbPath}.corrupt-${Date.now()}`
                await fs.promises.rename(dbPath, backup)
                console.error(`[totalchat-listener] file lama dibackup ke ${backup}`)

            }

            // Tulis ke file sementara lalu rename, supaya bot yang mati di
            // tengah write tidak meninggalkan JSON setengah jadi.
            await fs.promises.writeFile(tmpPath, JSON.stringify(db, null, 2))
            await fs.promises.rename(tmpPath, dbPath)
            loadError = false

        } catch (e) {

            console.error('[totalchat-listener] gagal simpan:', e.message)

        } finally {

            writing = null

        }

    })()

    return writing

}

const scheduleFlush = () => {

    if (flushTimer) return

    flushTimer = setTimeout(() => {

        flushTimer = null
        writeNow()

    }, FLUSH_INTERVAL)

    // Tidak perlu menahan event loop hanya untuk menyimpan counter.
    flushTimer.unref?.()

}



/* ================= LISTENER ================= */

export async function before(m) {

    if (!m.isGroup) return

    if (!m.sender) return

    if (m.key.fromMe) return

    const data = await loadDB()

    if (!data[m.chat]) data[m.chat] = {}

    if (!data[m.chat][m.sender]) data[m.chat][m.sender] = 0

    data[m.chat][m.sender] += 1

    scheduleFlush()

}