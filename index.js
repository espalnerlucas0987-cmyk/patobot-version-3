
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const https = require("https"); // Usando nativo para não precisar de axios
const app = express();
const PORT = process.env.PORT || 8080;

// CONFIGURAÇÕES
const MY_URL = "https://patobot-version-3.onrender.com";
const GRUPO_ID = "ID_DO_GRUPO_AQUI@g.us"; 

app.get("/", (req, res) => {
    res.send("Patobot Pro online e patrulhando! 🦆🔨");
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// FUNÇÃO GASOLINA NATIVA (Sem precisar de axios)
function injetarGasolina() {
    setInterval(() => {
        https.get(MY_URL, (res) => {
            console.log(`⛽ Gasolina injetada: Status ${res.statusCode}`);
        }).on('error', (e) => {
            console.log("❌ Erro no Auto-Ping interno.");
        });
    }, 60000); // 1 minuto
}

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

    // SOLICITAÇÃO DE CÓDIGO (Só se não estiver logado)
    if (!sock.authState.creds.registered) {
        const phoneNumber = "5582991583743";
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\nCÓDIGO DE PAREAMENTO: ${code}\n`);
            } catch (error) {
                console.error("Erro ao solicitar código:", error);
            }
        }, 5000); // Aumentei o tempo para dar fôlego ao servidor
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("✅ CONEXÃO ESTABELECIDA!");
            injetarGasolina(); // Só começa a gasolina depois que conectar
        }
    });

    // COMANDOS (PING E ID)
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
