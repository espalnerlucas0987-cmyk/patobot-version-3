
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

// CONFIGURAÇÕES DO XERIFE 🦆🔨
const MY_URL = "https://patobot-version-3.onrender.com";
const GRUPO_ID = "ID_DO_GRUPO_AQUI@g.us"; // Você vai trocar isso depois de dar !id no grupo

// Banner do PATOBOT PRO
console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   

    > MÓDULO: GASOLINA + VIGIA NOTURNO + COMANDO ID 🔍
    > HORÁRIO: FECHA 00:00 | ABRE 06:00
    > COMUNIDADE: ART OF DUCK
`);

app.get("/", (req, res) => {
    res.send("Patobot Pro online e patrulhando!");
});

app.listen(PORT, () => {
    console.log(`Servidor na porta ${PORT}`);
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

    // GASOLINA + VIGIA NOTURNO (A CADA 1 MINUTO)
    setInterval(async () => {
        try {
            // ⛽ Injetando Gasolina
            await axios.get(MY_URL);
            
            // 🌙 Lógica do Horário (Brasília)
            const agora = new Date();
            const horaBrasilia = agora.getUTCHours() - 3;
            const hora = horaBrasilia < 0 ? horaBrasilia + 24 : horaBrasilia;
            const minuto = agora.getUTCMinutes();

            // SÓ TENTA FECHAR/ABRIR SE O ID TIVER SIDO CONFIGURADO
            if (GRUPO_ID !== "ID_DO_GRUPO_AQUI@g.us") {
                // FECHAR GRUPO (00:00)
                if (hora === 0 && minuto === 0) {
                    await sock.groupSettingUpdate(GRUPO_ID, 'announcement');
                    await sock.sendMessage(GRUPO_ID, { text: "🌙 *TOQUE DE RECOLHER!* \n\nO xerife avisou: Grupo fechado para descanso. Voltamos às 06:00! 🦆💤" });
                }

                // ABRIR GRUPO (06:00)
                if (hora === 6 && minuto === 0) {
                    await sock.groupSettingUpdate(GRUPO_ID, 'not_announcement');
                    await sock.sendMessage(GRUPO_ID, { text: "☀️ *BOM DIA, NOBRES!* \n\nO xerife abriu o cercado. Podem mandar bala nos desenhos! 🦆🎨" });
                }
            }

        } catch (e) {
            console.log("❌ Erro no ciclo de vigia.");
        }
    }, 60000);

    // BOAS-VINDAS
    sock.ev.on("group-participants.update", async (anu) => {
        try {
            const { id, participants, action } = anu;
            if (action === "add") {
                for (let num of participants) {
                    let welcomeMsg = `Olá @${num.split("@")[0]}! 👋\n\nBem-vindo(a) à **ART of Duck**! 🦆✨\n\nRespeite as regras e divirta-se!`;
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
            console.log("CONEXÃO ESTABELECIDA COM SUCESSO!");
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // COMANDO !ID PARA VOCÊ PEGAR O CÓDIGO DO GRUPO
        if (messageContent === "!id") {
            await sock.sendMessage(from, { text: `📍 O ID deste chat é:\n\n${from}` });
        }

        if (messageContent === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! Patobot Pro operante." });
        }

        if (messageContent.startsWith("!ban")) {
            if (!isGroup) return;
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            if (!admins.includes(msg.key.participant || msg.key.remoteJid)) {
                return await sock.sendMessage(from, { text: "🚫 Só ADMs!" });
            }
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                            msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!mention) return await sock.sendMessage(from, { text: "Marque alguém!" });
            await sock.groupParticipantsUpdate(from, [mention], "remove");
            await sock.sendMessage(from, { text: "🔨 Removido!" });
        }
    });
}

connectToWhatsApp();
