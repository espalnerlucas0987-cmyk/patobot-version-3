
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pino = require("pino");
const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 8080;

// CONFIGURAÇÕES DA IA (CHAVE DO LUCAS)
const genAI = new GoogleGenerativeAI("AIzaSyByVmLtblUeWwHuQmysp_D0cDsACoI1cpY");
// Ajustado para garantir compatibilidade com a versão v1
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const MY_URL = "https://patobot-version-3.onrender.com"; 
const GRUPO_ID = "120363404586258584@g.us"; 

console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
                                                            
    > STATUS: SISTEMA INICIADO + IA ATIVA 🤖
    > MÓDULO: XERIFE TURBINADO 🦆🔨
    > DESENVOLVEDOR: LUCAS / ART OF DUCK
`);

app.get("/", (req, res) => res.send("Patobot Pro online! ⛽🦆"));
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));

// FUNÇÃO GASOLINA (AUTO-PING 1 MINUTO)
setInterval(async () => {
    try {
        await axios.get(MY_URL); 
        console.log("⛽ Gasolina injetada: Motor aquecido!");
    } catch (e) { console.log("❌ Erro no Auto-Ping."); }
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
            } catch (error) { console.error("Erro no código:", error); }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("group-participants.update", async (anu) => {
        try {
            const { id, participants, action } = anu;
            if (action === "add" && id === GRUPO_ID) {
                for (let num of participants) {
                    let welcomeMsg = `Salve meus nobres! @${num.split("@")[0]} 👋\n\nSeja bem-vindo(a) à ART of Duck!\n\nEu sou o **PATO BOT 1.0**, o Xerife do grupo. Pode mandar bala nas artes! 🦆🎨`;
                    await sock.sendMessage(id, { text: welcomeMsg, mentions: [num] });
                }
            }
        } catch (err) { console.log(err); }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("✅ CONEXÃO ESTABELECIDA!");
            
            // VIGIA NOTURNO
            setInterval(async () => {
                const agora = new Date();
                const hora = (agora.getUTCHours() - 3 + 24) % 24;
                const minuto = agora.getUTCMinutes();
                if (hora === 0 && minuto === 0) {
                    await sock.groupSettingUpdate(GRUPO_ID, 'announcement');
                    await sock.sendMessage(GRUPO_ID, { text: "🌙 *TOQUE DE RECOLHER!* \nGrupo fechado para descanso." });
                }
                if (hora === 6 && minuto === 0) {
                    await sock.groupSettingUpdate(GRUPO_ID, 'not_announcement');
                    await sock.sendMessage(GRUPO_ID, { text: "☀️ *BOM DIA!* \nGrupo aberto para as artes! 🎨" });
                }
            }, 60000);
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const messageContent = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        // VERIFICAÇÃO DE ADM
        let isAdm = false;
        if (isGroup) {
            try {
                const meta = await sock.groupMetadata(from);
                isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(msg.key.participant || msg.key.remoteJid);
            } catch (e) { isAdm = false; }
        }

        // ANTI-LINK
        if (isGroup && !isAdm && (messageContent.includes("chat.whatsapp.com") || messageContent.includes("http"))) {
            await sock.sendMessage(from, { delete: msg.key });
            return sock.sendMessage(from, { text: "🚫 *LINK PROIBIDO!*" });
        }

        // COMANDOS
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        if (messageContent === "!regras") return sock.sendMessage(from, { text: "🎨 *REGRAS ART OF DUCK* 🦆\n1. Respeito.\n2. Sem +18.\n3. Sem Spam." });

        if (messageContent === "!inspiração") {
            try {
                const result = await model.generateContent("Dê uma ideia de desenho criativa e curta.");
                return sock.sendMessage(from, { text: `🎨 *DESAFIO:* \n${result.response.text()}` }, { quoted: msg });
            } catch (e) { console.log(e); }
        }

        if (isGroup && isAdm) {
            if (messageContent === "!fechar") await sock.groupSettingUpdate(from, 'announcement');
            if (messageContent === "!abrir") await sock.groupSettingUpdate(from, 'not_announcement');
            if (messageContent.startsWith("!ban")) {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mention) await sock.groupParticipantsUpdate(from, [mention], "remove");
            }
        }

        if (messageContent === "!menu") {
            return sock.sendMessage(from, { text: `🦆 *PATOBOT MENU* 🦆\n\n!fechar | !abrir | !ban\n!regras | !ping | !inspiração\n\n🤖 Marque o bot para usar a IA!` });
        }

        // SISTEMA DE IA
        const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botId);
        const respondido = msg.message.extendedTextMessage?.contextInfo?.participant === botId;

        if (!isGroup || mencionado || respondido) {
            try {
                const prompt = `Você é o Patobot, Xerife da ART of Duck. Lucas é seu criador. Ajude com desenhos de forma curta. Pergunta: ${messageContent}`;
                const result = await model.generateContent(prompt);
                await sock.sendMessage(from, { text: result.response.text() }, { quoted: msg });
            } catch (err) { console.error("Erro IA:", err); }
        }
    });
}

connectToWhatsApp();
