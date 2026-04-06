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

// CONFIGURAÇÕES DA IA (SUA CHAVE)
const genAI = new GoogleGenerativeAI("AIzaSyByVmLtblUeWwHuQmysp_D0cDsACoI1cpY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// LINK OFICIAL DO SEU BOT NO RENDER:
const MY_URL = "https://patobot-version-3.onrender.com"; 

// ID DO GRUPO CONFIGURADO
const GRUPO_ID = "120363404586258584@g.us"; 

// Banner do PATOBOT PRO
console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
                                                            
    > STATUS: SISTEMA INICIADO + IA ATIVA 🤖
    > MÓDULO: XERIFE COMPLETO 🦆🔨
    > DESENVOLVEDOR: LUCAS / ART OF DUCK
`);

app.get("/", (req, res) => {
    res.send("Patobot Pro online e com tanque cheio! ⛽🦆");
});

app.listen(PORT, () => {
    console.log(`Servidor na porta ${PORT}`);
});

// FUNÇÃO GASOLINA (AUTO-PING A CADA 60 SEGUNDOS)
setInterval(async () => {
    try {
        await axios.get(MY_URL); 
        console.log("⛽ Gasolina injetada: Motor aquecido!");
    } catch (e) {
        console.log("❌ Erro no Auto-Ping interno.");
    }
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
            } catch (error) {
                console.error("Erro ao solicitar código:", error);
            }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    // BOAS-VINDAS NORMAL
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
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("✅ CONEXÃO ESTABELECIDA!");

            // SISTEMA DO VIGIA NOTURNO (Automático)
            setInterval(async () => {
                const agora = new Date();
                const horaBrasilia = (agora.getUTCHours() - 3 + 24) % 24;
                const minuto = agora.getUTCMinutes();

                if (hora === 0 && minuto === 0) {
                    try {
                        await sock.groupSettingUpdate(GRUPO_ID, 'announcement');
                        await sock.sendMessage(GRUPO_ID, { text: "🌙 *TOQUE DE RECOLHER!* \n\nO xerife fechou o grupo para descanso. Voltamos às 06:00! 💤" });
                    } catch (e) { console.log(e); }
                }
                
                if (hora === 6 && minuto === 0) {
                    try {
                        await sock.groupSettingUpdate(GRUPO_ID, 'not_announcement');
                        await sock.sendMessage(GRUPO_ID, { text: "☀️ *BOM DIA!* \n\nGrupo aberto. Podem mandar bala nas artes! 🎨🦆" });
                    } catch (e) { console.log(e); }
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

        // --- VERIFICAÇÃO DE ADM ---
        let isAdm = false;
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                isAdm = admins.includes(msg.key.participant || msg.key.remoteJid);
            } catch (e) { isAdm = false; }
        }

        // --- ANTI-LINK (SEGURANÇA) ---
        if (isGroup && !isAdm && (messageContent.includes("chat.whatsapp.com") || messageContent.includes("http"))) {
            await sock.sendMessage(from, { delete: msg.key });
            return sock.sendMessage(from, { text: "🚫 *LINK PROIBIDO!* \nApenas ADMs podem mandar links aqui." });
        }

        // --- COMANDOS BÁSICOS ---
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        if (messageContent === "!id") return sock.sendMessage(from, { text: `📍 ID: ${from}` });
        if (messageContent === "!regras") return sock.sendMessage(from, { text: "🎨 *REGRAS ART OF DUCK* 🦆\n\n1. Respeito total.\n2. Sem conteúdo +18.\n3. Sem Spam/Links.\n4. Foco em Arte!" });

        // --- INSPIRAÇÃO (IA) ---
        if (messageContent === "!inspiração") {
            try {
                const result = await model.generateContent("Gere uma ideia criativa e curta para um desenho. Seja direto.");
                return sock.sendMessage(from, { text: `🎨 *DESAFIO DO XERIFE:* \n\n${result.response.text()}` }, { quoted: msg });
            } catch (e) { console.log(e); }
        }

        // --- TUTORIAL YT ---
        if (messageContent.startsWith("!yt")) {
            const busca = messageContent.replace("!yt", "").trim();
            if (!busca) return sock.sendMessage(from, { text: "Diga o que quer aprender! Ex: !yt como desenhar mãos" });
            const linkYt = `https://www.youtube.com/results?search_query=${encodeURIComponent(busca)}+tutorial+desenho`;
            return sock.sendMessage(from, { text: `📺 *TUTORIAIS:* \nResultados para "${busca}":\n\n🔗 ${linkYt}` });
        }

        // --- COMANDOS DE ADM ---
        if (isGroup && isAdm) {
            if (messageContent === "!fechar") {
                await sock.groupSettingUpdate(from, 'announcement');
                return sock.sendMessage(from, { text: "🔒 *GRUPO FECHADO!* \nApenas administradores podem falar." });
            }
            if (messageContent === "!abrir") {
                await sock.groupSettingUpdate(from, 'not_announcement');
                return sock.sendMessage(from, { text: "🔓 *GRUPO ABERTO!* \nO Xerife liberou o chat." });
            }
            if (messageContent === "!adm") {
                const meta = await sock.groupMetadata(from);
                const admins = meta.participants.filter(p => p.admin).map(p => p.id);
                return sock.sendMessage(from, { text: "🚨 *CHAMADA GERAL PARA OS ADMS!*", mentions: admins });
            }
            if (messageContent.startsWith("!ban")) {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (!mention) return sock.sendMessage(from, { text: "Marque o alvo!" });
                await sock.groupParticipantsUpdate(from, [mention], "remove");
                return sock.sendMessage(from, { text: "🔨 O martelo do Xerife cantou!" });
            }
        }

        // --- MENU ATUALIZADO ---
        if (messageContent === "!menu") {
            const menuText = `🦆 *MENU DO PATOBOT PRO* 🦆\n\n` +
                             `*Controle:* !fechar | !abrir | !ban\n` +
                             `*Utilidades:* !regras | !adm | !id | !ping\n` +
                             `*Arte:* !inspiração | !yt [tema]\n\n` +
                             `*🤖 IA ATIVA:* Me marque ou responda para conversar!`;
            return sock.sendMessage(from, { text: menuText });
        }

        // --- SISTEMA DE IA (GEMINI) ---
        const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botId);
        const respondido = msg.message.extendedTextMessage?.contextInfo?.participant === botId;

        if (!isGroup || mencionado || respondido) {
            try {
                const promptFinal = `Você é o Patobot, o Xerife oficial da ART of Duck. Lucas é seu criador. Ajude com desenhos. Responda como um xerife pato legal e curto. Pergunta: ${messageContent}`;
                const result = await model.generateContent(promptFinal);
                await sock.sendMessage(from, { text: result.response.text() }, { quoted: msg });
            } catch (err) { console.error("Erro na IA:", err); }
        }
    });
}

connectToWhatsApp();
