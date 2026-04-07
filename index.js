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
const app = express();
const PORT = process.env.PORT || 8080;

const MY_URL = "https://patobot-version-3.onrender.com"; 
const GRUPO_ID = "120363404586258584@g.us"; 

// ARQUIVOS DE DADOS
const xpFile = './usuarios_xp.json';
const configFile = './config.json';

if (!fs.existsSync(xpFile)) fs.writeFileSync(xpFile, JSON.stringify({}));
if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, JSON.stringify({ xpAtivo: true }));

// --- FUNÇÃO DE PATENTES ATUALIZADA ---
function obterPatente(nivel) {
    if (nivel >= 200) return "🌌 *O ESCOLHIDO*";
    if (nivel >= 180) return "🔥 *SENHOR SUPREMO*";
    if (nivel >= 160) return "👾 *CHEFE FINAL*";
    if (nivel >= 140) return "👑 *IMPERADOR*";
    if (nivel >= 120) return "🦅 *ASCENDENTE*";
    if (nivel >= 100) return "🔱 *CONQUISTADOR*";
    if (nivel >= 80)  return "🗿 *MOGGER*";
    if (nivel >= 60)  return "⚡ *CHADE*";
    if (nivel >= 40)  return "🍷 *SIGMA*";
    if (nivel >= 20)  return "🖌️ *VANGUARDA*";
    return "🐣 *NOOB*";
}

console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
                                                            
    > STATUS: XERIFE REFORMULADO 🦆🔨
    > SISTEMA: SUPER RNG XP (1/10 CHANCE)
    > ACESSO: !PERFIL SÓ ADM 🔐
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

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const user = msg.key.participant || msg.key.remoteJid;
        const messageContent = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        let config = JSON.parse(fs.readFileSync(configFile));
        let dbs = JSON.parse(fs.readFileSync(xpFile));

        let isAdm = false;
        if (isGroup) {
            try {
                const meta = await sock.groupMetadata(from);
                isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
            } catch (e) { isAdm = false; }
        }

        // --- SISTEMA DE XP RARO (CHANCE DE 10%) ---
        if (config.xpAtivo && isGroup) {
            const sorteio = Math.floor(Math.random() * 10); // 0 a 9
            
            if (sorteio === 0) { 
                if (!dbs[user]) dbs[user] = { xp: 0, level: 1 };
                
                // Ganho de 500 a 1000 XP
                const ganhoXP = 500 + Math.floor(Math.random() * 501);
                dbs[user].xp += ganhoXP;

                let prox = dbs[user].level * 2500; // Meta aumentada para compensar o ganho alto
                if (dbs[user].xp >= prox) {
                    dbs[user].level += 1;
                    dbs[user].xp = 0;
                    const patente = obterPatente(dbs[user].level);
                    await sock.sendMessage(from, { 
                        text: `🆙 *LEVEL UP!* @${user.split("@")[0]}\n📊 Aura nível: *${dbs[user].level}*\n🏆 Patente: ${patente}`, 
                        mentions: [user] 
                    });
                }
                fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));
            }
        }

        // --- ANTI-LINK ---
        if (isGroup && !isAdm && (messageContent.includes("chat.whatsapp.com") || messageContent.includes("http"))) {
            await sock.sendMessage(from, { delete: msg.key });
            return sock.sendMessage(from, { text: "🚫 *LINK PROIBIDO!*" });
        }

        // --- COMANDO PERFIL (SÓ PARA ADM) ---
        if (messageContent.startsWith("!perfil")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO:* Só ADM pode ver a aura dos membros." });

            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                           msg.message.extendedTextMessage?.contextInfo?.participant || 
                           user;

            const data = dbs[target] || { xp: 0, level: 1 };
            const patente = obterPatente(data.level);
            const meta = data.level * 2500;

            const textoPerfil = `👤 *FICHA DO ARTISTA*\n@${target.split("@")[0]}\n\n🏆 *PATENTE:* ${patente}\n📊 Nível: ${data.level}\n✨ XP: ${data.xp}/${meta}`;
            return sock.sendMessage(from, { text: textoPerfil, mentions: [target] });
        }

        // --- COMANDOS ADM ---
        if (isGroup && isAdm) {
            if (messageContent === "!fechar") await sock.groupSettingUpdate(from, 'announcement');
            if (messageContent === "!abrir") await sock.groupSettingUpdate(from, 'not_announcement');
            if (messageContent === "!xp off") {
                config.xpAtivo = false;
                fs.writeFileSync(configFile, JSON.stringify(config));
                return sock.sendMessage(from, { text: "🔘 XP desativado." });
            }
            if (messageContent === "!xp on") {
                config.xpAtivo = true;
                fs.writeFileSync(configFile, JSON.stringify(config));
                return sock.sendMessage(from, { text: "🔘 XP ativado!" });
            }
            if (messageContent.startsWith("!ban")) {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
                if (mention) {
                    await sock.groupParticipantsUpdate(from, [mention], "remove");
                    return sock.sendMessage(from, { text: "🔨 *MARTELO DO XERIFE!*" });
                }
            }
        }

        // --- COMANDOS PÚBLICOS ---
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        if (messageContent === "!regras") return sock.sendMessage(from, { text: "🎨 *REGRAS ART OF DUCK* 🦆\n1. Respeito.\n2. Sem +18.\n3. Sem Spam." });
        if (messageContent === "!menu") {
            let statusXp = config.xpAtivo ? "Ativo" : "Inativo";
            return sock.sendMessage(from, { text: `🦆 *PATOBOT MENU*\n\n!ping | !regras\n\n*ADM:*\n!perfil @user | !ban | !fechar | !abrir\n!xp on/off\n\n*STATUS XP:* ${statusXp}` });
        }
    });
}

connectToWhatsApp();
