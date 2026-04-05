const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;

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
    > DESENVOLVEDOR: LUCAS (ART OF DUCK)
    > AGUARDANDO CONEXÃO...
`);

// Servidor Express básico para o Render
app.get("/", (req, res) => {
    res.send("Patobot Pro está online e vigiando!");
});

app.listen(PORT, () => {
    console.log(`Servidor Express rodando na porta ${PORT}`);
});

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
        const args = messageContent.trim().split(/ +/).slice(1);

        // COMANDO !PING
        if (messageContent === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! Patobot Pro operante." });
        }

      // COMANDO !BAN (XERIFE COM TRAVA DE SEGURANÇA)
        if (messageContent.startsWith("!ban")) {
            if (!isGroup) return await sock.sendMessage(from, { text: "Esse comando só funciona em grupos!" });

            // Puxa a lista de participantes e verifica se quem mandou é Admin
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isSenderAdmin = admins.includes(msg.key.participant || msg.key.remoteJid);

            if (!isSenderAdmin) {
                return await sock.sendMessage(from, { text: "🚫 Ops! Apenas administradores podem usar o martelo do banimento." });
            }

            // Se chegou aqui, é admin. Agora busca quem será banido
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                            msg.message.extendedTextMessage?.contextInfo?.participant;

            if (!mention) return await sock.sendMessage(from, { text: "Marque alguém ou responda a mensagem de quem você quer banir!" });

            try {
                await sock.groupParticipantsUpdate(from, [mention], "remove");
                await sock.sendMessage(from, { text: "🚫 Alvo removido com sucesso. Ordem restabelecida!" });
            } catch (e) {
                await sock.sendMessage(from, { text: "Erro ao banir! Verifique se eu sou administrador do grupo." });
            }
        }
   });
}

connectToWhatsApp();
