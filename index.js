
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const https = require("https"); 
const app = express();

app.get("/", (req, res) => res.send("PATOBOT ON"));
app.listen(process.env.PORT || 8080);

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"]
    });

    if (!sock.authState.creds.registered) {
        // Aguarda 15 segundos para garantir que o Render liberou a internet
        setTimeout(async () => {
            try {
                console.log("🚀 GERANDO CÓDIGO AGORA...");
                const code = await sock.requestPairingCode("5582991583743");
                console.log("\n==============================");
                console.log("SEU CÓDIGO É:", code);
                console.log("==============================\n");
            } catch (err) {
                console.log("Erro ao gerar código. Reiniciando...");
                process.exit(1); // Força o Render a reiniciar o bot
            }
        }, 15000);
    }

    sock.ev.on("creds.update", saveCreds);
    
    sock.ev.on("connection.update", (up) => {
        if (up.connection === "open") {
            console.log("✅ CONECTADO!");
            // Gasolina
            setInterval(() => {
                https.get("https://patobot-version-3.onrender.com", (res) => {
                    console.log("⛽ Gasolina OK");
                });
            }, 60000);
        }
        if (up.connection === "close") connectToWhatsApp();
    });
}

connectToWhatsApp();
