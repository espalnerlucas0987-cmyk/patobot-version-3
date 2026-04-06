
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

// 🚨 ATENÇÃO: COLOQUE O ID DO GRUPO AQUI DEPOIS DE PEGAR COM O COMANDO !id
const GRUPO_ID = "COLOQUE_O_ID_AQUI@g.us"; 

// Banner do PATOBOT PRO
console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
                                                            
    > STATUS: SISTEMA INICIADO
    > MÓDULO: AUTO-PING (GASOLINA 60s) ⛽ + VIGIA NOTURNO 🌙
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

    // MANTIDO: O sistema de gerar o código de 8 dígitos caso precise logar novamente
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

    // BOAS-VINDAS NORMAL (Sem Páscoa)
    sock.ev.on("group-participants.update", async (anu) => {
        try {
            const { id, participants, action } = anu;
            if (action === "add") {
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
            
            // SISTEMA DO VIGIA NOTURNO (Ativado após conectar)
            setInterval(async () => {
                if (GRUPO_ID === "COLOQUE_O_ID_AQUI@g.us") return; // Ignora se não tiver o ID
                
                const agora = new Date();
                const horaBrasilia = agora.getUTCHours() - 3;
                const hora = horaBrasilia < 0 ? horaBrasilia + 24 : horaBrasilia;
                const minuto = agora.getUTCMinutes();

                // Fecha o grupo à meia-noite
                if (hora === 0 && minuto === 0) {
                    try {
                        await sock.groupSettingUpdate(GRUPO_ID, 'announcement');
                        await sock.sendMessage(GRUPO_ID, { text: "🌙 *TOQUE DE RECOLHER!* \n\nO xerife fechou o grupo. Voltamos às 06:00! 💤" });
                    } catch (e) { console.log("Erro ao fechar o grupo:", e); }
                }
                
                // Abre o grupo às 06:00 da manhã
                if (hora === 6 && minuto === 0) {
                    try {
                        await sock.groupSettingUpdate(GRUPO_ID, 'not_announcement');
                        await sock.sendMessage(GRUPO_ID, { text: "☀️ *BOM DIA!* \n\nO sol raiou! Grupo aberto, podem mandar bala nas artes! 🎨🦆" });
                    } catch (e) { console.log("Erro ao abrir o grupo:", e); }
                }
            }, 60000); // Checa a hora a cada minuto
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // COMANDO !ping
        if (messageContent === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        }

        // COMANDO !id (Para pegar o ID do grupo)
        if (messageContent === "!id") {
            await sock.sendMessage(from, { text: `📍 O ID deste chat é:\n\n*${from}*` });
        }

        // COMANDO !menu NORMAL
        if (messageContent === "!menu") {
            const menuText = `🦆 *MENU DO PATOBOT XERIFE* 🦆\n\n` +
                             `*Comandos Manuais:* \n` +
                             `⛽ *!ping* - Testa se o bot tá online.\n` +
                             `📍 *!id* - Pega o ID do grupo.\n` +
                             `🔨 *!ban @usuario* - Dá a martelada do ban (Só ADMs).\n` +
                             `📜 *!menu* - Mostra esta lista.\n\n` +
                             `*Sistemas Automáticos Ativos:* \n` +
                             `🦆 Boas-vindas: ON\n` +
                             `🌙 Toque de Recolher (00h às 06h): ON`;
            await sock.sendMessage(from, { text: menuText });
        }

        // COMANDO !ban NORMAL
        if (messageContent.startsWith("!ban")) {
            if (!isGroup) return;
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            if (!admins.includes(msg.key.participant || msg.key.remoteJid)) {
                return await sock.sendMessage(from, { text: "🚫 Só ADMs, parceiro!" });
            }
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                            msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!mention) return await sock.sendMessage(from, { text: "Marque alguém para o Xerife dar a martelada!" });
            await sock.groupParticipantsUpdate(from, [mention], "remove");
            await sock.sendMessage(from, { text: "🔨 O martelo do Xerife cantou! Menos um no bando." });
        }
    });
}

connectToWhatsApp();
