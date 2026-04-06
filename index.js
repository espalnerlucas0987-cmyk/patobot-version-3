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

    // BOAS-VINDAS NORMAL (SEM PÁSCOA)
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

            // SISTEMA DO VIGIA NOTURNO
            setInterval(async () => {
                const agora = new Date();
                const horaBrasilia = agora.getUTCHours() - 3;
                const hora = horaBrasilia < 0 ? horaBrasilia + 24 : horaBrasilia;
                const minuto = agora.getUTCMinutes();

                // Fecha o grupo 00h
                if (hora === 0 && minuto === 0) {
                    try {
                        await sock.groupSettingUpdate(GRUPO_ID, 'announcement');
                        await sock.sendMessage(GRUPO_ID, { text: "🌙 *TOQUE DE RECOLHER!* \n\nO xerife fechou o grupo para descanso. Voltamos às 06:00! 💤" });
                    } catch (e) { console.log(e); }
                }
                
                // Abre o grupo 06h
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
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // COMANDO !ping
        if (messageContent === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        }

        // COMANDO !id
        if (messageContent === "!id") {
            await sock.sendMessage(from, { text: `📍 ID: ${from}` });
        }

        // COMANDO !menu
        if (messageContent === "!menu") {
            const menuText = `🦆 *MENU DO PATOBOT PRO* 🦆\n\n` +
                             `*Comandos:* \n` +
                             `⛽ *!ping* - Status do bot.\n` +
                             `📍 *!id* - Pega o ID do chat.\n` +
                             `🔨 *!ban* - Remove um membro (Só ADMs).\n` +
                             `📜 *!menu* - Lista de comandos.\n\n` +
                             `*Sistemas Automáticos:* \n` +
                             `✅ Boas-vindas: Ativado\n` +
                             `🌙 Modo Noturno: Ativado (00h-06h)`;
            await sock.sendMessage(from, { text: menuText });
        }

        // COMANDO !ban (NORMAL)
        if (messageContent.startsWith("!ban")) {
            if (!isGroup) return;
            const groupMetadata = await sock.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            if (!admins.includes(msg.key.participant || msg.key.remoteJid)) {
                return await sock.sendMessage(from, { text: "🚫 Só ADMs podem usar o martelo!" });
            }
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                            msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!mention) return await sock.sendMessage(from, { text: "Marque o alvo para o banimento!" });
            await sock.groupParticipantsUpdate(from, [mention], "remove");
            await sock.sendMessage(from, { text: "🔨 O martelo do Xerife cantou! Menos um no bando." });
        }
    });
}

connectToWhatsApp();
