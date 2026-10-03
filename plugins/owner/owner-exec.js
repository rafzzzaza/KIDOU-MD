import syntaxerror from 'syntax-error'
import { format } from 'util'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(__dirname)

let handler = async (m, extra) => {
  const {
    conn,
    usedPrefix,
    noPrefix,
    args,
    groupMetadata
  } = extra

  let _return
  let _syntax = ''
  const old = m.exp * 1

  const code =
    (/^=/.test(usedPrefix) ? 'return ' : '') +
    noPrefix

  try {
    // Debug cepat
    if (noPrefix === 'debug') {
      return await conn.reply(
        m.chat,
        format({
          hasM: !!m,
          hasConn: !!conn,
          sender: m.sender,
          chat: m.chat,
          mtype: m.mtype,
          text: m.text,
          quoted: !!m.quoted,
          quotedType: m.quoted?.mtype,
          quotedMime: m.quoted?.msg?.mimetype,
          hasDownload: typeof m.quoted?.download,
          args,
          hasGroupMetadata: !!groupMetadata
        }),
        m
      )
    }

    let limit = 15

    const module = {
      exports: {}
    }

    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor

    const exec = new AsyncFunction(
      'print',
      'm',
      'handler',
      'require',
      'conn',
      'process',
      'args',
      'groupMetadata',
      'module',
      'exports',
      'extra',
      code
    )

    _return = await exec(
      (...data) => {
        if (--limit < 1) return

        console.log(...data)

        return conn.reply(
          m.chat,
          format(...data),
          m
        )
      },
      m,
      handler,
      require,
      conn,
      process,
      args,
      groupMetadata,
      module,
      module.exports,
      extra
    )
  } catch (e) {
    const err = syntaxerror(
      code,
      'Execution Function',
      {
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        sourceType: 'module'
      }
    )

    if (err) {
      _syntax = `\`\`\`${err}\`\`\`\n\n`
    }

    _return = e
  } finally {
    if (_return !== undefined) {
      await conn.reply(
        m.chat,
        _syntax + format(_return),
        m
      )
    }

    m.exp = old
  }
}

handler.help = ['>', '=', '> debug']
handler.tags = ['owner']
handler.customPrefix = /^=?>\s/
handler.command = /(?:)/i
handler.owner = true

export default handler
