const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const https = require("https"); 
const app = express();
const PORT = process.env.PORT || 8080;

// CONFIGURAÇÕES
const MY_URL = "https://patobot-version-3.onrender.com";

app.get("/", (req, res) => {
    res.send("Patobot Pro online e patrulhando! 🦆🔨");
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

function injetarGasolina() {
    setInterval(() => {
        https.get(MY_URL, (res) => {
            console.log(`⛽ Gasolina: Status ${res.statusCode}`);
        }).on('error', (e) => {
            console.log("❌ Erro no Auto-Ping.");
        });
    }, 60000); 
}

async function connectToWhatsApp() {
    // 1. O 'auth_info' precisa estar limpo se deu erro antes!
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        printQRInTerminal: false, // Desativado para usar Pareamento
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        logger: pino({ level: "silent" }),
        // AJUSTE 1: Identificação de navegador padrão (essencial para pareamento)
        browser: ["Chrome (Linux)", "Chrome", "110.0.0.0"] 
    });

    // SOLICITAÇÃO DE CÓDIGO
    if (!sock.authState.creds.registered) {
        const phoneNumber = "5582991583743";
        // AJUSTE 2: Tempo de espera maior (10s) para o Render processar a chave de segurança
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n📢 SEU CÓDIGO: ${code}\n`);
            } catch (error) {
                console.error("Erro ao solicitar código:", error);
            }
        }, 10000); 
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("✅ CONEXÃO ESTABELECIDA!");
            injetarGasolina(); 
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (messageContent === "!id") {
            await sock.sendMessage(from, { text: `📍 ID: ${from}` });
        }

        if (messageContent === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        }
    });
}

connectToWhatsApp();
