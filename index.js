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
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 8080;

const MY_URL = "https://patobot-version-3.onrender.com"; 
const GRUPO_ID = "120363404586258584@g.us"; 

// ARQUIVOS DE DADOS
const xpFile = './usuarios_xp.json';
const configFile = './config.json';

if (!fs.existsSync(xpFile)) fs.writeFileSync(xpFile, JSON.stringify({}));
if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, JSON.stringify({ xpAtivo: true }));

// --- FUNÇÃO DE PATENTES ---
function obterPatente(nivel) {
    if (nivel >= 200) return "🌌 *O ESCOLHIDO*";
    if (nivel >= 180) return "🔥 *SENHOR SUPREMO*";
    if (nivel >= 160) return "👾 *CHEFE FINAL*";
    if (nivel >= 140) return "👑 *IMPERADOR*";
    if (nivel >= 120) return "🦅 *ASCENDENTE*";
    if (nivel >= 100) return "🔱 *CONQUISTADOR*";
    if (nivel >= 80)  return "🗿 *MOGGER*";
    if (nivel >= 60)  return "⚡ *CHADE*";
    if (nivel >= 40)  return "🍷 *SIGMA*";
    if (nivel >= 20)  return "🖌️ *VANGUARDA*";
    return "🐣 *NOOB*";
}

console.log(`
██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
                                                            
    > STATUS: XERIFE 24H ATIVADO 🦆⛽
    > MODO NOTURNO: BLINDADO ANTI-CRASH (00h-06h)
    > XP BALANCEADO: 1/20 (GANHO: 500-1000)
    > ACESSO: COMANDO OCULTO 🔑
`);

// --- MANTER 24H ONLINE (RENDER) ---
app.get("/", (req, res) => res.send("Patobot Pro online! ⛽🦆"));
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));

setInterval(async () => {
    try { await axios.get(MY_URL); } catch (e) { }
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
            } catch (error) { }
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("✅ CONEXÃO ESTABELECIDA!");
            
            // --- LOOP MODO NOTURNO BLINDADO ANTI-CRASH ---
            setInterval(async () => {
                const agora = new Date();
                const hora = (agora.getUTCHours() - 3 + 24) % 24; 
                const minuto = agora.getUTCMinutes();
                
                // TRAVA: Só executa se o bot estiver totalmente conectado (Evita o erro Precondition Required)
                if (sock && sock.authState && sock.authState.creds && sock.authState.creds.registered) {
                    try {
                        if (hora === 0 && minuto === 0) {
                            await sock.groupSettingUpdate(GRUPO_ID, 'announcement');
                            await sock.sendMessage(GRUPO_ID, { text: "🌙 *TOQUE DE RECOLHER!* \nGrupo fechado. 🦆💤" });
                        }
                        if (hora === 6 && minuto === 0) {
                            await sock.groupSettingUpdate(GRUPO_ID, 'not_announcement');
                            await sock.sendMessage(GRUPO_ID, { text: "☀️ *BOM DIA!* \nCercado aberto para as artes! 🎨" });
                        }
                    } catch (error) {
                        console.log("⚠️ Oscilação de rede no Modo Noturno. Bot protegido de crash.");
                    }
                }
            }, 60000);
        }
    });

    // --- MODO DE BOAS-VINDAS REATIVADO COM REGRA DE AVALIAÇÃO ---
    sock.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            const from = anu.id;
            const person = anu.participants[0];
            const patente = obterPatente(1);
            
            const textoBoasVindas = `🎨 *BEM-VINDO(A) AO ART OF DUCK!* 🦆\n\nOlá @${person.split("@")[0]}, sinta-se em casa!\n\n⚠️ *REGRA IMPORTANTE:* Você precisa mandar *3 desenhos* no grupo para um ADM avaliar!\n\n🏆 *SUA PATENTE:* ${patente}\n📊 *NÍVEL:* 1\n\nUse *!regras* para ver as diretrizes do grupo e divirta-se! ✨`;

            try {
                await sock.sendMessage(from, { 
                    text: textoBoasVindas, 
                    mentions: [person] 
                });
            } catch(e) {}
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const user = msg.key.participant || msg.key.remoteJid;
        const messageContent = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        let config = JSON.parse(fs.readFileSync(configFile));
        let dbs = JSON.parse(fs.readFileSync(xpFile));

        let isAdm = false;
        if (isGroup) {
            try {
                const meta = await sock.groupMetadata(from);
                isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
            } catch (e) { isAdm = false; }
        }

        // --- SISTEMA DE XP BALANCEADO (1/20 CHANCE) ---
        if (config.xpAtivo && isGroup) {
            const sorteio = Math.floor(Math.random() * 20); // 1 chance em 20 mensagens
            if (sorteio === 0) { 
                if (!dbs[user]) dbs[user] = { xp: 0, level: 1 };
                
                // Ganho entre 500 e 1000 XP
                const ganhoXP = 500 + Math.floor(Math.random() * 501); 
                dbs[user].xp += ganhoXP;
                
                // Nível volta ao normal (1000 por nível)
                let prox = dbs[user].level * 1000; 
                
                if (dbs[user].xp >= prox) {
                    dbs[user].level += 1;
                    dbs[user].xp = 0;
                    const patente = obterPatente(dbs[user].level);
                    await sock.sendMessage(from, { 
                        text: `🆙 *LEVEL UP!* @${user.split("@")[0]}\n📊 Aura nível: *${dbs[user].level}*\n🏆 Patente: ${patente}`, 
                        mentions: [user] 
                    });
                }
                fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));
            }
        }

        // --- COMANDO SUPER ADM (SECRETO) ---
        // O comando agora é "! up" (com um espaço depois do ponto de exclamação)
        if (messageContent.startsWith("! up")) {
            if (!isAdm) {
                return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            }

            // Como tem um espaço extra, ajustamos a leitura do comando
            const args = messageContent.split(/ +/); 
            const novoNivel = parseInt(args[2]); // O nível agora é a terceira palavra: "!" "up" "50"
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                           msg.message.extendedTextMessage?.contextInfo?.participant;

            if (!novoNivel || !target) return sock.sendMessage(from, { text: "💡 *USE O SEGREDO:* ! up [nível] @membro" });

            if (!dbs[target]) dbs[target] = { xp: 0, level: 1 };
            dbs[target].level = novoNivel;
            dbs[target].xp = 0;
            const patente = obterPatente(novoNivel);
            fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));

            return sock.sendMessage(from, { 
                text: `⚡ *UPGRADE:* @${target.split("@")[0]} elevado ao nível ${novoNivel}!\n🏆 Patente: ${patente}`, 
                mentions: [target] 
            });
        }

        // --- PERFIL (SÓ ADM) ---
        if (messageContent.startsWith("!perfil")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                           msg.message.extendedTextMessage?.contextInfo?.participant || user;
            const data = dbs[target] || { xp: 0, level: 1 };
            const patente = obterPatente(data.level);
            return sock.sendMessage(from, { 
                text: `👤 *FICHA:* @${target.split("@")[0]}\n🏆 Patente: ${patente}\n📊 Nível: ${data.level}\n✨ XP: ${data.xp}/${data.level * 1000}`, 
                mentions: [target] 
            });
        }

        // --- DEMAIS COMANDOS ADM ---
        if (isGroup && isAdm) {
            if (messageContent === "!fechar") await sock.groupSettingUpdate(from, 'announcement');
            if (messageContent === "!abrir") await sock.groupSettingUpdate(from, 'not_announcement');
            if (messageContent.startsWith("!ban")) {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mention) {
                    await sock.groupParticipantsUpdate(from, [mention], "remove");
                    return sock.sendMessage(from, { text: "🔨 *MARTELADA!*" });
                }
            }
        }

        // --- PÚBLICOS ---
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        if (messageContent === "!menu") {
            let statusXp = config.xpAtivo ? "Ativo" : "Inativo";
            return sock.sendMessage(from, { text: `🦆 *PATO MENU*\n\n!ping | !regras\n\n*ADM:*\n!perfil @user | !ban | !fechar | !abrir\n\n*XP:* ${statusXp}` });
        }
        if (messageContent === "!regras") return sock.sendMessage(from, { text: "🎨 *REGRAS:* Respeito, sem +18 e sem spam." });

        if (isGroup && !isAdm && (messageContent.includes("chat.whatsapp.com") || messageContent.includes("http"))) {
            await sock.sendMessage(from, { delete: msg.key });
        }
    });
}

connectToWhatsApp();
