

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
const fs = require('fs'); // Necessário para salvar o XP
const app = express();
const PORT = process.env.PORT || 8080;

const MY_URL = "https://patobot-version-3.onrender.com"; 
const GRUPO_ID = "120363404586258584@g.us"; 

// ARQUIVOS DE DADOS (XP E CONFIG)
const xpFile = './usuarios_xp.json';
const configFile = './config.json';

if (!fs.existsSync(xpFile)) fs.writeFileSync(xpFile, JSON.stringify({}));
if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, JSON.stringify({ xpAtivo: true }));

console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
                                                            
    > STATUS: XERIFE ATUALIZADO 🦆🔨
    > MÓDULO: XP + BAN CORRIGIDO + NOTURNO
    > IA: DESATIVADA TEMPORARIAMENTE
`);

app.get("/", (req, res) => res.send("Patobot Pro online! ⛽🦆"));
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));

setInterval(async () => {
    try {
        await axios.get(MY_URL); 
    } catch (e) { }
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

    // BOAS-VINDAS ATUALIZADO
    sock.ev.on("group-participants.update", async (anu) => {
        try {
            const { id, participants, action } = anu;
            if (action === "add" && id === GRUPO_ID) {
                for (let num of participants) {
                    let welcomeMsg = `Salve meu nobre! @${num.split("@")[0]} 👋\n\nSeja bem-vindo(a) ao nosso grupo! Mande três desenhos para os ADMs avaliarem você e te colocarem na categoria certa. \n\n⚠️ E não se esqueça de olhar as regras!\n\nEu sou o **PATO BOT**, o Xerife. 🦆🎨`;
                    await sock.sendMessage(id, { text: welcomeMsg, mentions: [num] });
                }
            }
        } catch (err) { }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("✅ CONEXÃO ESTABELECIDA!");
            
            // VIGIA NOTURNO (FECHA 00H, ABRE 06H)
            setInterval(async () => {
                const agora = new Date();
                const hora = (agora.getUTCHours() - 3 + 24) % 24;
                const minuto = agora.getUTCMinutes();
                if (hora === 0 && minuto === 0) {
                    await sock.groupSettingUpdate(GRUPO_ID, 'announcement');
                    await sock.sendMessage(GRUPO_ID, { text: "🌙 *TOQUE DE RECOLHER!* \nGrupo fechado para descanso. 🦆💤" });
                }
                if (hora === 6 && minuto === 0) {
                    await sock.groupSettingUpdate(GRUPO_ID, 'not_announcement');
                    await sock.sendMessage(GRUPO_ID, { text: "☀️ *BOM DIA!* \nCercado aberto para as artes! 🎨" });
                }
            }, 60000);
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const user = msg.key.participant || msg.key.remoteJid;
        const messageContent = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        // CARREGAR DADOS
        let config = JSON.parse(fs.readFileSync(configFile));
        let dbs = JSON.parse(fs.readFileSync(xpFile));

        // VERIFICAÇÃO DE ADM
        let isAdm = false;
        if (isGroup) {
            try {
                const meta = await sock.groupMetadata(from);
                isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
            } catch (e) { isAdm = false; }
        }

        // SISTEMA DE XP
        if (config.xpAtivo && isGroup) {
            if (!dbs[user]) dbs[user] = { xp: 0, level: 1 };
            dbs[user].xp += Math.floor(Math.random() * 10) + 5;
            let prox = dbs[user].level * 200;
            if (dbs[user].xp >= prox) {
                dbs[user].level += 1;
                dbs[user].xp = 0;
                await sock.sendMessage(from, { text: `🆙 *LEVEL UP!* @${user.split("@")[0]} subiu para o *Nível ${dbs[user].level}*!`, mentions: [user] });
            }
            fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));
        }

        // ANTI-LINK
        if (isGroup && !isAdm && (messageContent.includes("chat.whatsapp.com") || messageContent.includes("http"))) {
            await sock.sendMessage(from, { delete: msg.key });
            return sock.sendMessage(from, { text: "🚫 *LINK PROIBIDO!*" });
        }

        // COMANDOS PÚBLICOS
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        if (messageContent === "!regras") return sock.sendMessage(from, { text: "🎨 *REGRAS ART OF DUCK* 🦆\n1. Respeito.\n2. Sem +18.\n3. Sem Spam." });
        if (messageContent === "!perfil") {
            const { xp, level } = dbs[user] || { xp: 0, level: 1 };
            return sock.sendMessage(from, { text: `👤 *STATUS:* \n📊 Nível: ${level}\n✨ XP: ${xp}/${level*200}`, mentions: [user] });
        }

        // COMANDOS DE ADM
        if (isGroup && isAdm) {
            if (messageContent === "!fechar") await sock.groupSettingUpdate(from, 'announcement');
            if (messageContent === "!abrir") await sock.groupSettingUpdate(from, 'not_announcement');
            
            if (messageContent === "!xp off") {
                config.xpAtivo = false;
                fs.writeFileSync(configFile, JSON.stringify(config));
                return sock.sendMessage(from, { text: "🔘 XP desativado pelo Xerife." });
            }
            if (messageContent === "!xp on") {
                config.xpAtivo = true;
                fs.writeFileSync(configFile, JSON.stringify(config));
                return sock.sendMessage(from, { text: "🔘 XP ativado! Podem upar." });
            }

            // CORREÇÃO DO BAN (Pega marcação ou resposta)
            if (messageContent.startsWith("!ban")) {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
                if (mention) {
                    await sock.groupParticipantsUpdate(from, [mention], "remove");
                    return sock.sendMessage(from, { text: "🔨 *MARTELO DO XERIFE:* Removido com sucesso!" });
                }
            }
        }

        if (messageContent === "!menu") {
            let statusXp = config.xpAtivo ? "Ativo" : "Inativo";
            return sock.sendMessage(from, { text: `🦆 *PATOBOT MENU* 🦆\n\n!perfil | !ping | !regras\n\n*ADM:*\n!ban | !fechar | !abrir\n!xp on | !xp off\n\n*STATUS XP:* ${statusXp}` });
        }
    });
}

connectToWhatsApp();
