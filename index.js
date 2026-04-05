
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
const app = express();
const PORT = process.env.PORT || 8080;

// LINK OFICIAL DO SEU BOT NO RENDER:
const MY_URL = "https://patobot-version-3.onrender.com"; 

// Banner do PATOBOT PRO
console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
                                                            
    > STATUS: SISTEMA INICIADO
    > MÓDULO: AUTO-PING (GASOLINA 60s) ⛽
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

    // BOAS-VINDAS PERSONALIZADA
    sock.ev.on("group-participants.update", async (anu) => {
        try {
            const { id, participants, action } = anu;
            if (action === "add") {
                for (let num of participants) {
                    let welcomeMsg = `Salve meus nobres! @${num.split("@")[0]} 👋\n\n🐰 *Tio Lucas tá dando um feliz páscoa!* 🥚\n\nE com essa páscoa eu trago o **PATO BOT 1.0**! Cargo: Xerife da ART of Duck. 🦆🔨`;
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
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (messageContent === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        }

        if (messageContent.startsWith("!ban")) {
            if (!isGroup) return;
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            if (!admins.includes(msg.key.participant || msg.key.remoteJid)) {
                return await sock.sendMessage(from, { text: "🚫 Só ADMs, parceiro!" });
            }
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                            msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!mention) return await sock.sendMessage(from, { text: "Marque alguém!" });
            await sock.groupParticipantsUpdate(from, [mention], "remove");
            await sock.sendMessage(from, { text: "🔨 Martelo de páscoa cantou!" });
        }
    });
}

connectToWhatsApp();
