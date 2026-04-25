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
const muralFile = './mural.json';

if (!fs.existsSync(xpFile)) fs.writeFileSync(xpFile, JSON.stringify({}));
if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, JSON.stringify({ xpAtivo: true }));
if (!fs.existsSync(muralFile)) fs.writeFileSync(muralFile, JSON.stringify({ tema: "Nenhum desafio ativo no momento." }));

// --- VARIÁVEIS DE CONTROLE ANTI-SPAM ---
const spamTracker = {};
const avisosSpam = {};

// --- FUNÇÃO DE PATENTES ---
function obterPatente(nivel) {
    if (nivel >= 100) return "🌌 *O ESCOLHIDO*";
    if (nivel >= 90)  return "🔥 *SENHOR SUPREMO*";
    if (nivel >= 80)  return "👾 *CHEFE FINAL*";
    if (nivel >= 70)  return "👑 *IMPERADOR*";
    if (nivel >= 60)  return "🦅 *ASCENDENTE*";
    if (nivel >= 50)  return "🔱 *CONQUISTADOR*";
    if (nivel >= 40)  return "🗿 *MOGGER*";
    if (nivel >= 30)  return "⚡ *CHADE*";
    if (nivel >= 20)  return "🍷 *SIGMA*";
    if (nivel >= 10)  return "🖌️ *VANGUARDA*"; 
    return "🐣 *NOOB*";
}

// --- LOG DE INICIALIZAÇÃO ESTILIZADO (CHAVE DE OURO) ---
console.log(`
\x1b[33m      ,~~.
     (  6 )-_,
      \\___/ \`
       / \` _  \\
      / \` / \`  \\
     (\`  \` |\`   )
      \\___/\\___/
        | |
        |_|\x1b[0m

\x1b[36m ██████╗  █████╗ ████████╗ ██████╗ ██████╗  ██████╗ ████████╗
 ██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
 ██████╔╝███████║   ██║   ██║   ██║██████╔╝██║   ██║   ██║   
 ██╔═══╝ ██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║   ██║   
 ██║     ██║  ██║   ██║   ╚██████╔╝██████╔╝╚██████╔╝   ██║   
 ╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝\x1b[0m

    \x1b[1m> STATUS:\x1b[0m \x1b[32mXERIFE ATIVADO 🦆🛡️\x1b[0m
    \x1b[1m> MODO:\x1b[0m \x1b[35mART OF DUCK PRO\x1b[0m
    \x1b[1m> CRIADOR:\x1b[0m \x1b[34m\x1b[4mLUCAS\x1b[0m
`);

// --- MANTER 24H ONLINE ---
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
            
            setInterval(async () => {
                const agora = new Date();
                const hora = (agora.getUTCHours() - 3 + 24) % 24; 
                const minuto = agora.getUTCMinutes();
                
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
                        console.log("⚠️ Oscilação de rede no Modo Noturno.");
                    }
                }
            }, 60000);
        }
    });

    sock.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            const from = anu.id;
            const person = anu.participants[0];
            const patente = obterPatente(1);
            const textoBoasVindas = `🎨 *BEM-VINDO(A) AO ART OF DUCK!* 🦆\n\nOlá @${person.split("@")[0]}, sinta-se em casa!\n\n⚠️ *REGRA IMPORTANTE:* Você precisa mandar *3 desenhos* no grupo para um ADM avaliar!\n\n🏆 *SUA PATENTE:* ${patente}\n📊 *NÍVEL:* 1\n\nUse *!regras* para ver as diretrizes do grupo! ✨`;
            try {
                await sock.sendMessage(from, { text: textoBoasVindas, mentions: [person] });
            } catch(e) {}
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const user = msg.key.participant || msg.key.remoteJid;
        const agora = Date.now();
        const messageContent = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        // --- BLOCO ANTI-SPAM ---
        if (isGroup) {
            if (spamTracker[user] && (agora - spamTracker[user]) < 1500) {
                if (!avisosSpam[user]) avisosSpam[user] = 0;
                avisosSpam[user]++;

                if (avisosSpam[user] === 5) {
                    await sock.sendMessage(from, { text: `⚠️ *@${user.split("@")[0]}, PARE COM O SPAM! Próxima é ban.*`, mentions: [user] });
                } 
                else if (avisosSpam[user] >= 10) {
                    try {
                        const meta = await sock.groupMetadata(from);
                        const isAdmSpam = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
                        if (!isAdmSpam) {
                            await sock.sendMessage(from, { text: "🔨 *SPAM DETECTADO. ADEUS!*" });
                            await sock.groupParticipantsUpdate(from, [user], "remove");
                        }
                    } catch (e) {}
                }
                return; 
            }
            spamTracker[user] = agora;
            setTimeout(() => { if (Date.now() - spamTracker[user] > 5000) avisosSpam[user] = 0; }, 5000);
        }

        let config = JSON.parse(fs.readFileSync(configFile));
        let dbs = JSON.parse(fs.readFileSync(xpFile));
        let mural = JSON.parse(fs.readFileSync(muralFile));

        let isAdm = false;
        const comandosAdm = ["! up", "!perfil", "!fechar", "!abrir", "!ban", "!ranking", "!aviso", "!settema", "!limparxp"];
        const requerAdm = comandosAdm.some(cmd => messageContent.startsWith(cmd));

        if (isGroup && requerAdm) {
            try {
                const meta = await sock.groupMetadata(from);
                isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
            } catch (e) { isAdm = false; }
        }

        // --- SISTEMA DE XP ---
        if (config.xpAtivo && isGroup) {
            const sorteio = Math.floor(Math.random() * 20);
            if (sorteio === 0) { 
                if (!dbs[user]) dbs[user] = { xp: 0, level: 1 };
                const ganhoXP = 500 + Math.floor(Math.random() * 501); 
                dbs[user].xp += ganhoXP;
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

        // --- COMANDOS ADM (MURAL E AVISO) ---
        if (messageContent.startsWith("!aviso")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const avisoTexto = messageContent.replace("!aviso", "").trim();
            if (!avisoTexto) return sock.sendMessage(from, { text: "💡 Use: !aviso [texto]" });
            const meta = await sock.groupMetadata(from);
            return sock.sendMessage(from, { 
                text: `📢 *AVISO IMPORTANTE* 📢\n\n${avisoTexto.toUpperCase()}\n\n@everyone`,
                mentions: meta.participants.map(p => p.id)
            });
        }

        if (messageContent.startsWith("!settema")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const novoTema = messageContent.replace("!settema", "").trim();
            if (!novoTema) return sock.sendMessage(from, { text: "💡 Use: !settema [descrição do desafio]" });
            mural.tema = novoTema;
            fs.writeFileSync(muralFile, JSON.stringify(mural, null, 2));
            return sock.sendMessage(from, { text: `✅ *MURAL ATUALIZADO:* \n${novoTema}` });
        }

        // --- RANKING ---
        if (messageContent === "!ranking") {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            let arr = Object.keys(dbs).map(key => ({ id: key, ...dbs[key] }));
            arr.sort((a, b) => b.level - a.level || b.xp - a.xp);
            let top5 = arr.slice(0, 5);
            let txt = "🏆 *RANKING ART OF DUCK* 🏆\n\n";
            top5.forEach((u, i) => {
                txt += `${i + 1}º - @${u.id.split("@")[0]}\n📊 Nível: ${u.level} | ${obterPatente(u.level)}\n\n`;
            });
            return sock.sendMessage(from, { text: txt, mentions: top5.map(u => u.id) });
        }

        // --- CONTROLE DE XP ---
        if (messageContent.startsWith("! up")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const args = messageContent.split(/ +/); 
            const novoNivel = parseInt(args[2]); 
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                           msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!novoNivel || !target) return sock.sendMessage(from, { text: "💡 *USE:* ! up [nível] @membro" });
            if (!dbs[target]) dbs[target] = { xp: 0, level: 1 };
            dbs[target].level = novoNivel;
            dbs[target].xp = 0;
            const patente = obterPatente(novoNivel);
            fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));
            return sock.sendMessage(from, { text: `⚡ *UPGRADE:* @${target.split("@")[0]} agora é nível ${novoNivel}!\n🏆 Patente: ${patente}`, mentions: [target] });
        }

        if (messageContent.startsWith("!limparxp")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return sock.sendMessage(from, { text: "💡 Marque alguém para resetar o XP." });
            delete dbs[target];
            fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));
            return sock.sendMessage(from, { text: `🧹 *XP RESETADO:* @${target.split("@")[0]} voltou ao início.`, mentions: [target] });
        }

        if (messageContent.startsWith("!perfil")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                           msg.message.extendedTextMessage?.contextInfo?.participant || user;
            const data = dbs[target] || { xp: 0, level: 1 };
            const patente = obterPatente(data.level);
            return sock.sendMessage(from, { text: `👤 *FICHA:* @${target.split("@")[0]}\n🏆 Patente: ${patente}\n📊 Nível: ${data.level}\n✨ XP: ${data.xp}/${data.level * 1000}`, mentions: [target] });
        }

        // --- MODERAÇÃO DE GRUPO ---
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
        if (messageContent === "!tema") return sock.sendMessage(from, { text: `🎨 *DESAFIO DA SEMANA:* \n\n${mural.tema}` });
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        if (messageContent === "!menu") {
            const menuTxt = `🦆 *PATOBOT MENU PRO* 🦆\n\n` +
            `🔹 *GERAL:*\n` +
            `!ping | !regras | !tema\n\n` +
            `🔸 *ADMINISTRAÇÃO:*\n` +
            `!perfil @user | !ban\n` +
            `!fechar | !abrir\n` +
            `!ranking | !aviso\n\n` +
            `🔹 *CONTROLE XP:*\n` +
            `! up [nível] @user\n` +
            `!limparxp @user\n` +
            `!settema [texto]`;
            return sock.sendMessage(from, { text: menuTxt });
        }
        
        if (messageContent === "!regras") {
            const textoRegras = `🎨 *ART OF DUCK - ESSENCIAL* 🦆\n\n` +
            `1️⃣ *RESPEITO:* Proibido ofensas ou humilhação.\n` +
            `2️⃣ *CONTEÚDO:* Proibido +18 ou Gore.\n` +
            `3️⃣ *SPAM:* Não flode figurinhas.\n` +
            `4️⃣ *LINKS:* Proibido convites de outros grupos.\n` +
            `5️⃣ *DESENHOS:* Novos membros mandam *3 artes* para avaliação.\n\n` +
            `⚠️ *BAN:* Violar as regras gera ban imediato!`;
            return sock.sendMessage(from, { text: textoRegras });
        }
    });
}

connectToWhatsApp();
