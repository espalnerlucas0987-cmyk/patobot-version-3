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

        // --- SISTEMA DE MUDO (64) ---
        if (config.mutados.includes(user)) {
            return await sock.sendMessage(from, { delete: msg.key });
        }

        // --- VERIFICAÇÃO DE ADM ---
        let isAdm = false;
        try {
            const meta = await sock.groupMetadata(from);
            isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
        } catch (e) {}

        if (!isComando) return;

        // --- COOLDOWN (2 SEGUNDOS) ---
        if (cooldowns.has(user)) return;
        cooldowns.add(user);
        setTimeout(() => cooldowns.delete(user), 2000);

        // --- NOVOS COMANDOS ---

        if (messageContent === "!tempo") {
            const totalMs = Date.now() - uptimeBot;
            const horas = Math.floor(totalMs / 3600000);
            const mins = Math.floor((totalMs % 3600000) / 60000);
            return sock.sendMessage(from, { text: `⏳ *ESTOU ACORDADO HÁ:* \n${horas}h e ${mins}min.` });
        }

        if (messageContent === "!memoria") {
            const usado = process.memoryUsage().heapUsed / 1024 / 1024;
            return sock.sendMessage(from, { text: `🧠 *MEMÓRIA RAM:* \n${usado.toFixed(2)} MB usados no Render.` });
        }

        if (messageContent.startsWith("!mutar") && isAdm) {
            const alvo = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvo) return sock.sendMessage(from, { text: "💡 Marque quem deve ser mutado." });
            config.mutados.push(alvo);
            fs.writeFileSync(configFile, JSON.stringify(config));
            return sock.sendMessage(from, { text: `🤐 @${alvo.split("@")[0]} foi silenciado.`, mentions: [alvo] });
        }

        if (messageContent.startsWith("!desmutar") && isAdm) {
            const alvo = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvo) return sock.sendMessage(from, { text: "💡 Marque quem deseja desmutar." });
            config.mutados = config.mutados.filter(u => u !== alvo);
            fs.writeFileSync(configFile, JSON.stringify(config));
            return sock.sendMessage(from, { text: `🔊 @${alvo.split("@")[0]} pode falar novamente.`, mentions: [alvo] });
        }

        if (messageContent === "!sorteiopremio" && isAdm) {
            const meta = await sock.groupMetadata(from);
            const sorteado = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;
            return sock.sendMessage(from, { text: `🏆 *GANHADOR DO PRÊMIO:* @${sorteado.split("@")[0]}\nParabéns! Fale com os ADMs.`, mentions: [sorteado] });
        }

        if (messageContent === "!loja") {
            return sock.sendMessage(from, { text: `🛒 *LOJA ART OF DUCK*\n\n1. *Mudar Nick:* 5000 XP\n2. *Tema da Semana:* 10000 XP\n3. *Virar ADM:* 50000 XP\n\n_Para comprar, chame o Lucas!_` });
        }

        if (messageContent.startsWith("!votação") && isAdm) {
            const pauta = messageContent.replace("!votação", "").trim();
            return sock.sendMessage(from, { text: `🗳️ *VOTAÇÃO:* ${pauta || 'Qual a melhor arte?'}\n\n👍 Sim | 👎 Não` });
        }

        if (messageContent === "!destruir" && isAdm) {
            await sock.sendMessage(from, { text: "⚠️ *AVISO:* DESTRUIÇÃO EM 5 SEGUNDOS..." });
            setTimeout(() => sock.sendMessage(from, { text: "1..." }), 4000);
            return setTimeout(() => sock.sendMessage(from, { text: "💥 Brincadeira! O grupo está seguro. 😂" }), 5000);
        }

        // --- MENU E ORIGINAIS ---
        if (messageContent === "!menu") {
            const menuTxt = `🦆 *PATOBOT V3.1* 🦆\n\n🔹 *GERAL:*\n!ping | !regras | !tema | !link | !tempo | !memoria\n\n🔸 *INTERAÇÃO:*\n!pato | !pergunta | !critica | !luta | !loja\n\n🔹 *ADMS:*\n!ban | !mutar | !desmutar | !votação | !sorteiopremio | !destruir | !backup`;
            return sock.sendMessage(from, { text: menuTxt });
        }
        
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        if (messageContent === "!backup" && isAdm) {
            await sock.sendMessage(user, { document: fs.readFileSync(xpFile), mimetype: 'application/json', fileName: 'usuarios_xp.json' });
            return sock.sendMessage(from, { text: "✅ Backup enviado!" });
        }
    });
}

connectToWhatsApp();
