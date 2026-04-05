const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const axios = require("axios"); // Importante para a gasolina ⛽
const app = express();
const PORT = process.env.PORT || 8080;

// LINK DO SEU BOT NO RENDER
const MY_URL = "https://patobot-version-3.onrender.com";

// Banner do PATOBOT PRO
console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
                                                            
██████╗ ██████╗  ██████╗ 
██╔══██╗██╔══██╗██╔═══██╗
██████╔╝██████╔╝██║   ██║
██╔═══╝ ██╔══██╗██║   ██║
██║     ██║  ██║╚██████╔╝
╚═╝     ╚═╝  ╚═╝ ╚═════╝ 

    > STATUS: SISTEMA INICIADO
    > MÓDULO: GASOLINA 60s ATIVADO ⛽
    > DESENVOLVEDOR: LUCAS
`);

app.get("/", (req, res) => {
    res.send("Patobot Pro online e vigiando!");
});

app.listen(PORT, () => {
    console.log(`Servidor na porta ${PORT}`);
});

// LÓGICA DA GASOLINA ⛽ (AUTO-PING A CADA 1 MINUTO)
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
                error.log("Erro ao solicitar código:", error);
            }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    // LÓGICA DE BOAS-VINDAS (RECEPÇÃO)
    sock.ev.on("group-participants.update", async (anu) => {
        try {
            const { id, participants, action } = anu;
            if (action === "add") {
                for (let num of participants) {
                    let welcomeMsg = `Olá @${num.split("@")[0]}! 👋\n\nBem-vindo(a) à **ART of Duck**! 🦆✨\n\nRespeite as regras e divirta-se com a comunidade!`;
                    await sock.sendMessage(id, { 
                        text: welcomeMsg, 
                        mentions: [num] 
                    });
                }
            }
        } catch (err) {
            console.log("Erro no Boas-Vindas:", err);
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("CONEXÃO ESTABELECIDA COM SUCESSO!");
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // COMANDO !PING
        if (messageContent === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! Patobot Pro operante." });
        }

        // COMANDO !BAN (COM TRAVA DE ADMIN)
        if (messageContent.startsWith("!ban")) {
            if (!isGroup) return;

            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isSenderAdmin = admins.includes(msg.key.participant || msg.key.remoteJid);

            if (!isSenderAdmin) {
                return await sock.sendMessage(from, { text: "🚫 Apenas ADMs podem usar este comando!" });
            }

            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                            msg.message.extendedTextMessage?.contextInfo?.participant;

            if (!mention) return await sock.sendMessage(from, { text: "Marque alguém ou responda a mensagem!" });

            try {
                await sock.groupParticipantsUpdate(from, [mention], "remove");
                await sock.sendMessage(from, { text: "🚫 Alvo removido com sucesso!" });
            } catch (e) {
                await sock.sendMessage(from, { text: "Erro! Verifique se eu sou Admin." });
            }
        }
    });
}

connectToWhatsApp();
