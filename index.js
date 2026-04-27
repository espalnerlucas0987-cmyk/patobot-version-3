const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const axios = require("axios");
const fs = require('fs');
const fsP = require('fs').promises; 
const app = express();
const PORT = process.env.PORT || 8080;

const MY_URL = "https://patobot-version-3.onrender.com"; 
const GRUPO_ID = "120363404586258584@g.us"; 

const xpFile = './usuarios_xp.json';
const configFile = './config.json';
const muralFile = './mural.json';

if (!fs.existsSync(xpFile)) fs.writeFileSync(xpFile, JSON.stringify({}));
if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, JSON.stringify({ xpAtivo: true, status: "online", mutados: [] }));
if (!fs.existsSync(muralFile)) fs.writeFileSync(muralFile, JSON.stringify({ tema: "Nenhum desafio ativo no momento." }));

const uptimeBot = Date.now();
const processadas = new Set();
const cooldowns = new Set();

function obterPatente(nivel) {
    if (nivel >= 100) return "🌌 *O ESCOLHIDO*";
    if (nivel >= 90)  return "🔥 *SENHOR SUPREMO*";
    if (nivel >= 80)  return "👾 *CHEFE FINAL*";
    if (nivel >= 70)  return "👑 *IMPERADOR*";
    if (nivel >= 60)  return "🦅 *ASCENDENTE*";
    if (nivel >= 50)  return "🔱 *CONQUISTADOR*";
    if (nivel >= 40)  return "🗿 *MOGGER*";
    if (nivel >= 30)  return "⚡ *CHADE*";
    if (nivel >= 20)  return "🍷 *SIGMA*";
    if (nivel >= 10)  return "🖌️ *VANGUARDA*"; 
    return "🐣 *NOOB*";
}

console.log(`
\x1b[33m      ,~~.
     (  6 )-_,
      \\___/ \`
       / \` _  \\
      / \` / \`  \\
     (\`  \` |\`   )
      \\___/\\___/
        | |
        |_|\x1b[0m
\x1b[36m ██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
 ██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
 ██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
 ██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
 ██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
 ╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝\x1b[0m
    \x1b[1m> STATUS:\x1b[0m \x1b[32mXERIFE ATIVADO 🦆🛡️\x1b[0m
    \x1b[1m> MODO:\x1b[0m \x1b[35mART OF DUCK PRO\x1b[0m
    \x1b[1m> CRIADOR:\x1b[0m \x1b[34m\x1b[4mLUCAS\x1b[0m
`);

app.get("/", (req, res) => res.send("Patobot Pro online! ⛽🦆"));
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));

setInterval(async () => {
    try { await axios.get(MY_URL); } catch (e) { }
}, 60000); 

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "5582991583743";
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\nCÓDIGO DE PAREAMENTO: ${code}\n`);
            } catch (error) { }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    // --- EVENTOS DE GRUPO (CHECK ESTRANGEIRO E SAÍDA) ---
    sock.ev.on("group-participants.update", async (anu) => {
        const { id, participants, action } = anu;
        if (id !== GRUPO_ID) return;
        for (let num of participants) {
            if (action === 'remove') {
                await sock.sendMessage(id, { text: `👋 *F NO CHAT!* @${num.split("@")[0]} saiu do cercado.`, mentions: [num] });
            }
            if (action === 'add' && !num.startsWith('55')) {
                await sock.sendMessage(id, { text: `⚠️ *ALERTA:* @${num.split("@")[0]} é estrangeiro. Cuidado!`, mentions: [num] });
            }
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("✅ CONEXÃO ESTABELECIDA!");
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const msgId = msg.key.id;
        if (processadas.has(msgId)) return;
        processadas.add(msgId);
        setTimeout(() => processadas.delete(msgId), 10000);

        const from = msg.key.remoteJid;
        const user = msg.key.participant || msg.key.remoteJid;
        const messageContent = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const isComando = messageContent.startsWith("!");
        
        let config = JSON.parse(fs.readFileSync(configFile));
        let dbs = JSON.parse(fs.readFileSync(xpFile));

        // --- SISTEMA DE MUDO ---
        if (config.mutados.includes(user)) {
            return await sock.sendMessage(from, { delete: msg.key });
        }

        // --- VERIFICAÇÃO DE ADM ---
        let isAdm = false;
        try {
            const meta = await sock.groupMetadata(from);
            isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
        } catch (e) {}

        // --- SISTEMA DE XP ---
        if (config.xpAtivo && !isComando) {
            if (Math.floor(Math.random() * 15) === 0) { 
                if (!dbs[user]) dbs[user] = { xp: 0, level: 1 };
                dbs[user].xp += 200;
                if (dbs[user].xp >= dbs[user].level * 1000) {
                    dbs[user].level += 1; dbs[user].xp = 0;
                    await sock.sendMessage(from, { text: `🆙 *LEVEL UP!* @${user.split("@")[0]}\n🏆 Patente: ${obterPatente(dbs[user].level)}`, mentions: [user] });
                }
                fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));
            }
        }

        if (!isComando) return;

        // --- COOLDOWN ---
        if (cooldowns.has(user)) return;
        cooldowns.add(user);
        setTimeout(() => cooldowns.delete(user), 2000);

        // --- COMANDOS DE STATUS ---
        if (messageContent === "!perfil") {
            if (!dbs[user]) dbs[user] = { xp: 0, level: 1 };
            const patente = obterPatente(dbs[user].level);
            return sock.sendMessage(from, { text: `👤 *PERFIL:*\n\n📊 Nível: ${dbs[user].level}\n✨ XP: ${dbs[user].xp}\n🏆 Patente: ${patente}`, mentions: [user] });
        }

        if (messageContent === "!ranking") {
            const top = Object.entries(dbs)
                .sort(([, a], [, b]) => (b.level * 1000 + b.xp) - (a.level * 1000 + a.xp))
                .slice(0, 10);
            let rankingTxt = "🏆 *TOP 10 ARTISTAS:* \n\n";
            top.forEach(([id, data], i) => {
                rankingTxt += `${i + 1}º - @${id.split("@")[0]} | Nível: ${data.level}\n`;
            });
            return sock.sendMessage(from, { text: rankingTxt, mentions: top.map(t => t[0]) });
        }

        // --- COMANDOS ADM & GERAL ---
        if (messageContent === "!tempo") {
            const totalMs = Date.now() - uptimeBot;
            const horas = Math.floor(totalMs / 3600000);
            const mins = Math.floor((totalMs % 3600000) / 60000);
            return sock.sendMessage(from, { text: `⏳ *ESTOU ACORDADO HÁ:* ${horas}h e ${mins}min.` });
        }

        if (messageContent === "!memoria") {
            const usado = process.memoryUsage().heapUsed / 1024 / 1024;
            return sock.sendMessage(from, { text: `🧠 *RAM USADA:* ${usado.toFixed(2)} MB.` });
        }

        if (messageContent.startsWith("!mutar") && isAdm) {
            const alvo = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvo) return sock.sendMessage(from, { text: "💡 Marque quem deve calar a boca." });
            config.mutados.push(alvo);
            fs.writeFileSync(configFile, JSON.stringify(config));
            return sock.sendMessage(from, { text: `🤐 @${alvo.split("@")[0]} mutado.`, mentions: [alvo] });
        }

        if (messageContent.startsWith("!desmutar") && isAdm) {
            const alvo = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvo) return sock.sendMessage(from, { text: "💡 Marque quem deseja liberar." });
            config.mutados = config.mutados.filter(u => u !== alvo);
            fs.writeFileSync(configFile, JSON.stringify(config));
            return sock.sendMessage(from, { text: `🔊 @${alvo.split("@")[0]} liberado.`, mentions: [alvo] });
        }

        if (messageContent === "!sorteiopremio" && isAdm) {
            const meta = await sock.groupMetadata(from);
            const sorteado = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;
            return sock.sendMessage(from, { text: `🏆 *VENCEDOR:* @${sorteado.split("@")[0]}`, mentions: [sorteado] });
        }

        if (messageContent.startsWith("!votação") && isAdm) {
            const pauta = messageContent.replace("!votação", "").trim();
            return sock.sendMessage(from, { text: `🗳️ *VOTAÇÃO:* ${pauta || 'Qual a melhor?'}\n👍 Sim | 👎 Não` });
        }

        if (messageContent === "!destruir" && isAdm) {
            await sock.sendMessage(from, { text: "⚠️ Destruindo grupo em 5s..." });
            return setTimeout(() => sock.sendMessage(from, { text: "💥 Brincadeira!" }), 5000);
        }

        if (messageContent === "!menu") {
            const menuTxt = `🦆 *PATOBOT V3.1* 🦆\n\n🔹 !perfil | !ranking | !ping | !tempo | !memoria\n🔸 !pato | !regras | !tema | !link | !loja\n🔹 !mutar | !votação | !sorteiopremio | !backup`;
            return sock.sendMessage(from, { text: menuTxt });
        }
        
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! ⛽" });
        if (messageContent === "!backup" && isAdm) {
            await sock.sendMessage(user, { document: fs.readFileSync(xpFile), mimetype: 'application/json', fileName: 'usuarios_xp.json' });
            return sock.sendMessage(from, { text: "✅ Backup enviado!" });
        }
    });
}

connectToWhatsApp();
