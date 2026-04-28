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
if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, JSON.stringify({ xpAtivo: true, mutados: [] }));
if (!fs.existsSync(muralFile)) fs.writeFileSync(muralFile, JSON.stringify({ tema: "Nenhum desafio ativo no momento.", calendario: "Nenhum evento marcado." }));

// --- VARIÁVEIS DE CONTROLE ---
const spamTracker = {};
const avisosSpam = {};
const cmdSpamTracker = {}; // NOVO: Rastreador de Spam de Comandos (147)
const cooldowns = new Set();
const processadas = new Set(); 
const uptimeBot = Date.now();

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
    return "🐣 *PRO*";
}

// --- LOG DE INICIALIZAÇÃO ---
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
    \x1b[1m> MODO:\x1b[0m \x1b[35mART OF DUCK PRO V3\x1b[0m
    \x1b[1m> CRIADOR:\x1b[0m \x1b[34m\x1b[4mLUCAS\x1b[0m
`);

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
        const from = anu.id;
        const person = anu.participants[0];

        if (anu.action === 'add') {
            const patente = obterPatente(1);
            const textoBoasVindas = `🎨 *BEM-VINDO(A) AO ART OF DUCK!* 🦆\n\nOlá @${person.split("@")[0]}, sinta-se em casa!\n\n⚠️ *REGRA IMPORTANTE:* Você precisa mandar *3 desenhos* no grupo para um ADM avaliar!\n\n🏆 *SUA PATENTE:* ${patente}\n📊 *NÍVEL:* 1\n\nUse *!regras* para ver as diretrizes do grupo! ✨`;
            try { await sock.sendMessage(from, { text: textoBoasVindas, mentions: [person] }); } catch(e) {}
        }

        // NOVO: 98. Adeus (Sarcástico)
        if (anu.action === 'remove') {
            try { await sock.sendMessage(from, { text: `🦆 @${person.split("@")[0]} meteu o pé! Já vai tarde, menos um pra gastar o grafite da galera.`, mentions: [person] }); } catch(e) {}
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const msgId = msg.key.id;
        if (processadas.has(msgId)) return;
        processadas.add(msgId);
        setTimeout(() => processadas.delete(msgId), 10000);

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const user = msg.key.participant || msg.key.remoteJid;
        const agora = Date.now();

        const messageContent = (
            msg.message.conversation || 
            msg.message.extendedTextMessage?.text || 
            msg.message.imageMessage?.caption || 
            msg.message.videoMessage?.caption || 
            ""
        ).toLowerCase();

        if (!messageContent && !msg.message.imageMessage) return; 
        
        const isComando = messageContent.startsWith("!");
        let config = JSON.parse(fs.readFileSync(configFile));
        if (!config.mutados) config.mutados = [];

        // --- SISTEMA DE MUTE ---
        if (config.mutados.includes(user)) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch(e) {}
            return;
        }

        // --- LOCKDOWN & SPAM DE COMANDO (147) ---
        if (isComando) {
            if (cooldowns.has(user)) return;
            cooldowns.add(user);
            setTimeout(() => cooldowns.delete(user), 2000);

            if (isGroup) {
                if (!cmdSpamTracker[user]) cmdSpamTracker[user] = [];
                cmdSpamTracker[user].push(agora);
                cmdSpamTracker[user] = cmdSpamTracker[user].filter(t => agora - t < 10000); // Msgs nos ultimos 10s
                
                if (cmdSpamTracker[user].length >= 5) { // 5 comandos em 10 seg
                    if (!config.mutados.includes(user)) {
                        config.mutados.push(user);
                        fs.writeFileSync(configFile, JSON.stringify(config));
                        await sock.sendMessage(from, { text: `🚨 @${user.split("@")[0]} tomou MUTE AUTOMÁTICO de 1 minuto por SPAM de comandos!`, mentions: [user] });
                        setTimeout(() => {
                            let cfg = JSON.parse(fs.readFileSync(configFile));
                            cfg.mutados = cfg.mutados.filter(u => u !== user);
                            fs.writeFileSync(configFile, JSON.stringify(cfg));
                            sock.sendMessage(from, { text: `🔊 @${user.split("@")[0]}, seu mute de flood acabou. Calma no teclado!`, mentions: [user] });
                        }, 60000);
                    }
                    return;
                }
            }
        }

        // --- REAÇÕES ---
        if (isGroup && !isComando) {
            if (Math.floor(Math.random() * 20) === 0) {
                const emojis = ["🦆", "🎨", "🔥", "🗿", "🍷", "👾", "✨", "👀"];
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                try { await sock.sendMessage(from, { react: { text: emoji, key: msg.key } }); } catch(e) {}
            }
        }

        // --- ANTI-SPAM DE MENSAGENS NORMAIS ---
        if (isGroup) {
            if (spamTracker[user] && (agora - spamTracker[user]) < 1500) {
                if (!avisosSpam[user]) avisosSpam[user] = 0;
                avisosSpam[user]++;
                if (avisosSpam[user] === 5) {
                    await sock.sendMessage(from, { text: `⚠️ *@${user.split("@")[0]}, PARE COM O SPAM! Próxima é ban.*`, mentions: [user] });
                } else if (avisosSpam[user] >= 10) {
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

        let dbs = JSON.parse(fs.readFileSync(xpFile));
        let mural = JSON.parse(fs.readFileSync(muralFile));

        let isAdm = false;
        if (isGroup) {
            try {
                const meta = await sock.groupMetadata(from);
                isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
            } catch (e) { isAdm = false; }
        }

        // --- SISTEMA DE XP ---
        if (config.xpAtivo && isGroup && !isComando) {
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
                        text: `🆙 *LEVEL UP!* @${user.split("@")[0]}\n📊 Nível: *${dbs[user].level}*\n🏆 Patente: ${patente}`, 
                        mentions: [user] 
                    });
                }
                fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));
            }
        }

        // NOVO: 122. Comando Escondido (Easter Egg)
        if (!isComando && isGroup && messageContent.includes("pato de borracha")) {
            if (!dbs[user]) dbs[user] = { xp: 0, level: 1 };
            dbs[user].xp += 1000;
            fs.writeFileSync(xpFile, JSON.stringify(dbs, null, 2));
            return sock.sendMessage(from, { text: `🥚 *EASTER EGG ENCONTRADO!* @${user.split("@")[0]} invocou o sagrado PATO DE BORRACHA e ganhou +1000 XP!`, mentions: [user] });
        }

        // --- COMANDOS ADM ---
        if (messageContent.startsWith("!aviso")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const avisoTexto = messageContent.replace("!aviso", "").trim();
            if (!avisoTexto) return sock.sendMessage(from, { text: "💡 Use: !aviso [texto]" });
            const meta = await sock.groupMetadata(from);
            return sock.sendMessage(from, { text: `📢 *AVISO IMPORTANTE* 📢\n\n${avisoTexto.toUpperCase()}\n\n@everyone`, mentions: meta.participants.map(p => p.id) });
        }

        if (messageContent.startsWith("!settema")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const novoTema = messageContent.replace("!settema", "").trim();
            if (!novoTema) return sock.sendMessage(from, { text: "💡 Use: !settema [descrição]" });
            mural.tema = novoTema;
            fs.writeFileSync(muralFile, JSON.stringify(mural, null, 2));
            return sock.sendMessage(from, { text: `✅ *MURAL ATUALIZADO:* \n${novoTema}` });
        }

        // NOVO: 108. Setar Calendário
        if (messageContent.startsWith("!setcalendario")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const cal = messageContent.replace("!setcalendario", "").trim();
            if (!cal) return sock.sendMessage(from, { text: "💡 Use: !setcalendario [data e evento]" });
            mural.calendario = cal;
            fs.writeFileSync(muralFile, JSON.stringify(mural, null, 2));
            return sock.sendMessage(from, { text: `✅ *CALENDÁRIO ATUALIZADO!*` });
        }

        // NOVO: 6. Modo Silêncio Temporário
        if (messageContent.startsWith("!shiu")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const args = messageContent.split(" ");
            const mins = parseInt(args[1]) || 5;
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: `🤫 *XERIFE MANDOU CALAR A BOCA!* \nGrupo fechado por ${mins} minutos.` });
            setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    await sock.sendMessage(from, { text: `🔊 *CERCADO ABERTO!* Podem voltar a grasnar.` });
                } catch(e) {}
            }, mins * 60000);
            return;
        }

        // NOVO: 57. Contagem Regressiva
        if (messageContent.startsWith("!contagem")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const args = messageContent.split(" ");
            const mins = parseInt(args[1]);
            const motivo = args.slice(2).join(" ") || "Evento surpresa!";
            if (!mins) return sock.sendMessage(from, { text: "💡 *Uso:* !contagem [minutos] [motivo]" });
            
            await sock.sendMessage(from, { text: `⏳ *CONTAGEM INICIADA!* \nMotivo: ${motivo}\nTempo: ${mins} minutos.` });
            setTimeout(async () => {
                const meta = await sock.groupMetadata(from);
                await sock.sendMessage(from, { text: `⏰ *ACABOU O TEMPO!* \n\n${motivo.toUpperCase()}`, mentions: meta.participants.map(p => p.id) });
            }, mins * 60000);
            return;
        }

        if (messageContent === "!ranking") {
            let arr = Object.keys(dbs).map(key => ({ id: key, ...dbs[key] }));
            arr.sort((a, b) => b.level - a.level || b.xp - a.xp);
            let top5 = arr.slice(0, 5);
            let txt = "🏆 *RANKING ART OF DUCK* 🏆\n\n";
            top5.forEach((u, i) => { txt += `${i + 1}º - @${u.id.split("@")[0]}\n📊 Nível: ${u.level} | ${obterPatente(u.level)}\n\n`; });
            return sock.sendMessage(from, { text: txt, mentions: top5.map(u => u.id) });
        }

        if (messageContent.startsWith("! up")) {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const args = messageContent.split(/ +/); 
            const novoNivel = parseInt(args[2]); 
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
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
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant || user;
            const data = dbs[target] || { xp: 0, level: 1 };
            const patente = obterPatente(data.level);
            
            // NOVO: 43. Nível de Aura Visual
            let aura = "🌫️ Aura Comum";
            if (data.level >= 50) aura = "🔥 Chama Ancestral";
            else if (data.level >= 30) aura = "⚡ Relâmpago Divino";
            else if (data.level >= 10) aura = "✨ Aura Neon";

            return sock.sendMessage(from, { text: `👤 *FICHA:* @${target.split("@")[0]}\n🏆 Patente: ${patente}\n🌀 Aura: ${aura}\n📊 Nível: ${data.level}\n✨ XP: ${data.xp}/${data.level * 1000}`, mentions: [target] });
        }

        if (messageContent === "!backup") {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            try {
                return sock.sendMessage(from, { 
                    document: fs.readFileSync(xpFile), 
                    mimetype: 'application/json', 
                    fileName: 'backup_xp_patobot.json',
                    caption: '📦 *AQUI ESTÁ O BACKUP DO SISTEMA DE XP!*'
                });
            } catch (e) {
                return sock.sendMessage(from, { text: "❌ *Erro ao gerar o backup.*" });
            }
        }

        if (messageContent.startsWith("!mutar") && isAdm) {
            const alvo = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvo) return sock.sendMessage(from, { text: "💡 Marque quem deve ser mutado." });
            if (!config.mutados.includes(alvo)) config.mutados.push(alvo);
            fs.writeFileSync(configFile, JSON.stringify(config));
            return sock.sendMessage(from, { text: `🤐 @${alvo.split("@")[0]} foi silenciado pelo Xerife.`, mentions: [alvo] });
        }

        if (messageContent.startsWith("!desmutar") && isAdm) {
            const alvo = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvo) return sock.sendMessage(from, { text: "💡 Marque quem deseja desmutar." });
            config.mutados = config.mutados.filter(u => u !== alvo);
            fs.writeFileSync(configFile, JSON.stringify(config));
            return sock.sendMessage(from, { text: `🔊 @${alvo.split("@")[0]} foi perdoado e pode falar.`, mentions: [alvo] });
        }

        if (messageContent === "!tempo") {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const totalMs = Date.now() - uptimeBot;
            const horas = Math.floor(totalMs / 3600000);
            const mins = Math.floor((totalMs % 3600000) / 60000);
            return sock.sendMessage(from, { text: `⏳ *UPTIME:* Pato rodando liso há ${horas}h e ${mins}min.` });
        }

        if (messageContent === "!memoria") {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const usado = process.memoryUsage().heapUsed / 1024 / 1024;
            return sock.sendMessage(from, { text: `🧠 *RAM:* ${usado.toFixed(2)} MB queimando no Render.` });
        }

        // NOVO: 139. Saúde do Bot (ADM)
        if (messageContent === "!saude") {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const usadoMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const totalMs = Date.now() - uptimeBot;
            const horas = Math.floor(totalMs / 3600000);
            const mins = Math.floor((totalMs % 3600000) / 60000);
            return sock.sendMessage(from, { text: `🏥 *SAÚDE DO PATO:*\n\n🔋 RAM: ${usadoMB} MB\n⏱️ Uptime: ${horas}h ${mins}m\n🛡️ Mute Spam: ON\n🦆 Status: 100% Grasno` });
        }

        // NOVO: 140. Ping Real (ADM)
        if (messageContent === "!pingreal") {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const timestamp = msg.messageTimestamp * 1000;
            const ping = Date.now() - timestamp;
            return sock.sendMessage(from, { text: `🏓 *Ping Real:* ${ping}ms da mensagem até o cérebro do pato.` });
        }

        if (messageContent === "!sorteiopremio" && isAdm) {
            const meta = await sock.groupMetadata(from);
            const sorteado = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;
            return sock.sendMessage(from, { text: `🏆 *ROLETA DA ARTE:*\n\nO grande vencedor é... @${sorteado.split("@")[0]}! 🎉`, mentions: [sorteado] });
        }

        if (messageContent.startsWith("!votação") && isAdm) {
            const pauta = messageContent.replace("!votação", "").trim();
            return sock.sendMessage(from, { text: `🗳️ *NOVA VOTAÇÃO:*\n\n"${pauta || 'Qual a melhor arte?'}"\n\n👍 Aprovo | 👎 Reprovo` });
        }

        // --- COMANDOS PARA TODOS ---

        // NOVO: 108. Ver Calendário
        if (messageContent === "!calendario") {
            return sock.sendMessage(from, { text: `📅 *CALENDÁRIO ART OF DUCK:*\n\n${mural.calendario}` });
        }

        // NOVO: 19. Collab Aleatório
        if (messageContent === "!collab" && isGroup) {
            const meta = await sock.groupMetadata(from);
            const membros = meta.participants.map(p => p.id).filter(id => id !== sock.user.id.split(":")[0]+"@s.whatsapp.net");
            if (membros.length < 2) return;
            const art1 = membros[Math.floor(Math.random() * membros.length)];
            let art2 = membros[Math.floor(Math.random() * membros.length)];
            while (art2 === art1) art2 = membros[Math.floor(Math.random() * membros.length)];
            
            return sock.sendMessage(from, { 
                text: `🎨 *ROLETA DA COLLAB!* 🎨\n\nO destino escolheu vocês para desenharem juntos:\n👉 @${art1.split("@")[0]}\n👉 @${art2.split("@")[0]}\n\nBora trabalhar!`, 
                mentions: [art1, art2] 
            });
        }

        // NOVO: 55. Roleta Russa
        if (messageContent === "!roletarussa" && isGroup) {
            const sorte = Math.floor(Math.random() * 6);
            if (sorte === 0) {
                if (!config.mutados.includes(user)) config.mutados.push(user);
                fs.writeFileSync(configFile, JSON.stringify(config));
                await sock.sendMessage(from, { text: `💥 *BAM!* A arma disparou! @${user.split("@")[0]} levou um tiro e está MUTADO por 1 minuto.`, mentions: [user] });
                setTimeout(() => {
                     let cfg = JSON.parse(fs.readFileSync(configFile));
                     cfg.mutados = cfg.mutados.filter(u => u !== user);
                     fs.writeFileSync(configFile, JSON.stringify(cfg));
                }, 60000);
            } else {
                await sock.sendMessage(from, { text: `😅 *Click...* Vazio! @${user.split("@")[0]} sobreviveu à roleta russa.`, mentions: [user] });
            }
            return;
        }

        // NOVO: 69. Lembrete
        if (messageContent.startsWith("!lembrar")) {
            const args = messageContent.split(" ");
            const tempoStr = args[1]; 
            const texto = args.slice(2).join(" ") || "Lembrete do Pato!";
            if (!tempoStr || !tempoStr.endsWith('m')) return sock.sendMessage(from, { text: "💡 *Uso:* !lembrar 10m [texto]" });
            const mins = parseInt(tempoStr.replace("m", ""));
            if (isNaN(mins) || mins <= 0 || mins > 120) return sock.sendMessage(from, { text: "⚠️ Use um tempo válido (1m a 120m)." });
            await sock.sendMessage(from, { text: `⏰ Ok! Daqui a ${mins} minutos eu te chamo.` });
            setTimeout(async () => {
                await sock.sendMessage(from, { text: `⏰ *BIP BIP!* @${user.split("@")[0]}, seu lembrete:\n\n"${texto}"`, mentions: [user] });
            }, mins * 60000);
            return;
        }

        // NOVO: 76. Frase do Dia
        if (messageContent === "!frasedodia") {
            const frases = [
                "A arte diz o inominável; exprime o inexprimível. - Salvador Dalí",
                "Beba água e vá treinar fundamento!",
                "Um esboço ruim é o primeiro passo para uma obra-prima.",
                "O talento é mentira, o que existe é horas de bunda na cadeira desenhando.",
                "A inspiração existe, mas tem que te encontrar trabalhando. - Picasso"
            ];
            const f = frases[Math.floor(Math.random() * frases.length)];
            return sock.sendMessage(from, { text: `📖 *SABEDORIA DO PATO:*\n\n"${f}"` });
        }

        // NOVO: 78. Elogio Aleatório
        if (messageContent === "!elogio") {
            const elogios = ["é um monstro sagrado nas artes!", "tem o traço abençoado pelos deuses do nanquim.", "é a lenda viva desse grupo.", "tem uma aura de puro talento.", "desenha tanto que dá inveja no Da Vinci."];
            const elg = elogios[Math.floor(Math.random() * elogios.length)];
            return sock.sendMessage(from, { text: `✨ Pato Xerife declara: @${user.split("@")[0]} ${elg}`, mentions: [user] });
        }

        if (messageContent === "!loja") {
            return sock.sendMessage(from, { text: `🛒 *MERCADO DO PATO*\n\n1️⃣ Mudar Nick (5k XP)\n2️⃣ Escolher Tema (10k XP)\n3️⃣ Status VIP (50k XP)\n\n_Chame um ADM para comprar!_` });
        }

        if (messageContent === "!pato") return sock.sendMessage(from, { text: "Quack! 🦆" });
        
        if (messageContent.startsWith("!pergunta")) {
            const respostas = ["Com certeza!", "Nem pensar.", "Talvez...", "Pergunta lá no posto Ipiranga.", "O Pato aprova!"];
            const r = respostas[Math.floor(Math.random() * respostas.length)];
            return sock.sendMessage(from, { text: `🦆 🔮 *O Pato Diz:* ${r}` });
        }

        if (isGroup && isAdm) {
            if (messageContent === "!fechar") await sock.groupSettingUpdate(from, 'announcement');
            if (messageContent === "!abrir") await sock.groupSettingUpdate(from, 'not_announcement');
            if (messageContent.startsWith("!ban")) {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mention) { await sock.groupParticipantsUpdate(from, [mention], "remove"); return sock.sendMessage(from, { text: "🔨 *MARTELADA!*" }); }
            }
        }

        // --- MENU ATUALIZADO ---
        if (messageContent === "!tema") return sock.sendMessage(from, { text: `🎨 *DESAFIO DA SEMANA:* \n\n${mural.tema}` });
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Pong! Tanque cheio ⛽" });
        if (messageContent === "!menu") {
            if (!isAdm) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" }); 
            const menuTxt = `🦆 *MENU PATOBOT PRO V3* 🦆

🔹 *GERAL:*
!ping | !regras | !tema
!perfil | !ranking | !loja
!calendario | !collab 
!frasedodia | !elogio
!lembrar | !roletarussa

🔸 *GAMES/ZUEIRA:*
!pato | !pergunta 

🛡️ *ADM GERAL:*
!saude | !pingreal | !tempo | !memoria
!ban | !mutar | !desmutar | !shiu
!fechar | !abrir | !aviso
!votação | !sorteiopremio | !contagem

✨ *XP/MURAL (ADM):*
! up | !limparxp | !settema 
!setcalendario | !backup`;
            return sock.sendMessage(from, { text: menuTxt });
        }
        
        if (messageContent === "!regras") {
            const textoRegras = `🎨 *ART OF DUCK - ESSENCIAL* 🦆\n\n1️⃣ *RESPEITO:* Proibido ofensas.\n2️⃣ *CONTEÚDO:* Proibido +18.\n3️⃣ *SPAM:* Não flode.\n4️⃣ *LINKS:* Proibido convites.\n5️⃣ *DESENHOS:* Novos mandam *3 artes*.\n\n⚠️ *BAN:* Violar gera ban imediato!`;
            return sock.sendMessage(from, { text: textoRegras });
        }
    });
}

connectToWhatsApp();
