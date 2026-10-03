import fetch from "node-fetch"

const packages = {
  '1gb': { ram: "1000", disk: "1000", cpu: "40" },
  '2gb': { ram: "2000", disk: "1000", cpu: "60" },
  '3gb': { ram: "3000", disk: "2000", cpu: "80" },
  '4gb': { ram: "4000", disk: "2000", cpu: "100" },
  '5gb': { ram: "5000", disk: "3000", cpu: "120" },
  '6gb': { ram: "6000", disk: "3000", cpu: "140" },
  '7gb': { ram: "7000", disk: "4000", cpu: "160" },
  '8gb': { ram: "8000", disk: "4000", cpu: "180" },
  '9gb': { ram: "9000", disk: "5000", cpu: "200" },
  '10gb': { ram: "10000", disk: "5000", cpu: "220" },
  'unli': { ram: "0", disk: "0", cpu: "0" },
  'unlimited': { ram: "0", disk: "0", cpu: "0" }
}

function makeId(length = 8) {
  let result = ""
  let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
  const { domain, ptla, egg, loc } = global.panel || {}

  if (!domain || !ptla)
    return m.reply("❌ Panel belum disetting di config.js")

  let cmd = command.toLowerCase()

  if (cmd === "pannel") {
    return m.reply(`☁️ MENU PANEL

1GB - 10GB
UNLI
createadmin
listpanel
listadmin
delpanel <id>
deladmin <id>`)
  }

  if (!packages[cmd] && !["createadmin","listpanel","listadmin","delpanel","deladmin"].includes(cmd))
    return

  try {

    if (cmd === "listpanel") {
      let res = await fetch(domain + "/api/application/servers", {
        headers: { Authorization: "Bearer " + ptla }
      })
      let data = await res.json()
      if (!data.data?.length) return m.reply("Tidak ada server")
      let txt = "📦 LIST SERVER\n\n"
      data.data.forEach(s => {
        txt += `ID: ${s.attributes.id}
Name: ${s.attributes.name}
RAM: ${s.attributes.limits.memory == 0 ? "Unlimited" : s.attributes.limits.memory + "MB"}

`
      })
      return m.reply(txt)
    }

    if (cmd === "listadmin") {
      let res = await fetch(domain + "/api/application/users", {
        headers: { Authorization: "Bearer " + ptla }
      })
      let data = await res.json()
      if (!data.data?.length) return m.reply("Tidak ada user")
      let txt = "👤 LIST USER PANEL\n\n"
      data.data.forEach(u => {
        txt += `ID: ${u.attributes.id}
Username: ${u.attributes.username}
Admin: ${u.attributes.root_admin ? "Yes" : "No"}

`
      })
      return m.reply(txt)
    }

    if (cmd === "delpanel") {
      if (!text) return m.reply("Contoh: .delpanel 3")
      await fetch(domain + "/api/application/servers/" + text, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + ptla }
      })
      return m.reply("✅ Server berhasil dihapus")
    }

    if (cmd === "deladmin") {
      if (!text) return m.reply("Contoh: .deladmin 5")
      await fetch(domain + "/api/application/users/" + text, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + ptla }
      })
      return m.reply("✅ User berhasil dihapus")
    }

    if (!text || text.split(/[, ]/).length < 2)
      return m.reply(`Contoh:
${usedPrefix + cmd} username,@tag
${usedPrefix + cmd} username,628xxxx`)

    let username = text.split(/[, ]/)[0]

    let target = m.mentionedJid[0] ||
      (m.quoted ? m.quoted.sender : null) ||
      (text.match(/\d+/) ? text.match(/\d+/)[0] + "@s.whatsapp.net" : null)

    if (!target) return m.reply("Tag atau nomor tidak ditemukan")

    let jid = target.includes("@s.whatsapp.net")
      ? target
      : target.split("@")[0] + "@s.whatsapp.net"

    let email = username + "@panel.com"
    let password = makeId(8)

    await m.reply("✨ Creating server panel...")

    let userRes = await fetch(domain + "/api/application/users", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + ptla,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        username,
        first_name: username,
        last_name: username,
        language: "en",
        password
      })
    })

    let userData = await userRes.json()
    if (userData.errors)
      return m.reply(JSON.stringify(userData.errors[0], null, 2))

    let user = userData.attributes

    let pack = packages[cmd]
    let memory = parseInt(pack.ram)
    let disk = parseInt(pack.disk)
    let cpu = parseInt(pack.cpu)

    let serverRes = await fetch(domain + "/api/application/servers", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + ptla,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `${username} Server`,
        user: user.id,
        egg: parseInt(egg),
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_22",
        startup: "npm start",
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start"
        },
        limits: {
          memory,
          swap: 0,
          disk,
          io: 500,
          cpu
        },
        feature_limits: {
          databases: 5,
          backups: 5,
          allocations: 5
        },
        deploy: {
          locations: [parseInt(loc)],
          dedicated_ip: false,
          port_range: []
        }
      })
    })

    let serverData = await serverRes.json()
    if (serverData.errors)
      return m.reply(JSON.stringify(serverData.errors[0], null, 2))

    await conn.sendMessage(jid, {
      text: `📦 DATA PANEL

Username: ${username}
Password: ${password}
Login: ${domain}

RAM: ${memory == 0 ? "Unlimited" : memory + "MB"}
CPU: ${cpu == 0 ? "Unlimited" : cpu + "%"}
Disk: ${disk == 0 ? "Unlimited" : disk + "MB"}`
    })

    return m.reply("✅ Server berhasil dibuat & data dikirim ke PC")

  } catch (err) {

    if (err.code === "ENOTFOUND")
      return m.reply("❌ Domain panel tidak ditemukan, cek config.js")

    if (err.status === 401)
      return m.reply("❌ API Key tidak valid")

    return m.reply("❌ Terjadi kesalahan saat menghubungi panel")
  }
}

handler.command = /^(pannel|1gb|2gb|3gb|4gb|5gb|6gb|7gb|8gb|9gb|10gb|unli|unlimited|createadmin|listpanel|listadmin|delpanel|deladmin)$/i
handler.tags = ["panel"]
handler.help = ["pannel","1gb-10gb","unli","createadmin","listpanel","listadmin","delpanel","deladmin"]
handler.owner = true

export default handler
