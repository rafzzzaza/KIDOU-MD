import syntaxerror from "syntax-error";
import util from "node:util";
import { exec } from "node:child_process";

const handler = async (m, { conn, command, text, participants, groupMetadata }) => {
   if (!global.db.data.settings[conn.user.jid]?.self && !m.isOwner) return;

   const raw =
      command === "~>"
         ? (m.quoted?.text || "").trim()
         : text.trim();

   let old = m.exp;
   let _return;
   let _syntax = "";

   let logLimit = 15;

   const logger = (...args) => {
      if (logLimit-- < 1) return;
      conn.reply(m.chat, args.map(format).join(" "), m);
   };

   const consoleProxy = {
      log: logger,
      warn: logger,
      info: logger,
      error: logger
   };

   const paramNames = [
      "m",
      "conn",
      "text",
      "participants",
      "groupMetadata",
      "console"
   ].join(",");

   const paramValues = [
      m,
      conn,
      text,
      participants,
      groupMetadata,
      consoleProxy
   ];

   try {
      if (command === "$") {
         conn.reply(m.chat, "```executing...```", m);

         exec(raw, (err, stdout, stderr) => {
            if (err) return conn.reply(m.chat, err.toString(), m);

            let out = stdout || stderr;
            if (!out) return;

            try {
               out = JSON.stringify(JSON.parse(out), null, 2);
            } catch {}

            conn.reply(m.chat, out, m);
         });

         return;
      }

      if (command === ">" || command === "~>") {
         const Exec = new (async () => {}).constructor(paramNames, raw);
         _return = await Exec.call(conn, ...paramValues);
      }

      if (command === "=>") {
         const Exec = new (async () => {}).constructor(
            paramNames,
            `return (${raw})`
         );
         _return = await Exec.call(conn, ...paramValues);
      }
   } catch (e) {
      const err = syntaxerror(raw, "Eval", {
         allowReturnOutsideFunction: true,
         allowAwaitOutsideFunction: true,
         sourceType: "module"
      });

      if (err) _syntax = "```" + err + "```\n\n";
      _return = e;
   } finally {
      if (command !== "$") {
         const out = _syntax + format(_return);
         if (out) conn.reply(m.chat, out, m);
      }
      m.exp = old;
   }
};

handler.customPrefix = /^(\$|=>|>|~>)$/;
handler.command = new RegExp;
handler.owner = true;

export default handler;

function format(x) {
   try {
      if (x === undefined) return "";
      if (typeof x === "string") return x;

      if (typeof x === "function") {
         return `[${x.constructor.name}: ${x.name || "anonymous"}]`;
      }

      if (x instanceof Error) {
         return x.stack || x.message;
      }

      return JSON.stringify(
         x,
         (k, v) => {
            if (typeof v === "function") {
               return `[${v.constructor.name}: ${v.name || "anonymous"}]`;
            }
            return v;
         },
         2
      );
   } catch {
      return util.inspect(x, {
         depth: 4,
         colors: false,
         showHidden: false
      });
   }
}
