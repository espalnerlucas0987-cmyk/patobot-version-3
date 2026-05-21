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
const GRUPO_ID = "120363404586258584@g.us"; // Seu grupo oficial (Geral)
const DONO_ID = "558291583743@s.whatsapp.net"; // SEU NÚMERO COMO DONO SUPREMO

// ARQUIVOS DE DADOS (XP removido, novos controles de Portaria e Inatividade adicionados)
const configFile = './config.json';
const muralFile = './mural.json';
const atividadeFile = './atividade.json';

if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({ 
        mutados: [], 
        grupoPortaria: "", 
        ficha: "🪜 *𝐙𝐄𝐍𝐈𝐓𝐇 𝐒𝐘𝐍𝐃𝐈𝐂𝐀𝐓𝐄 — PORTARIA* 👑\n\nSeja bem-vindo(a) ao setor de triagem.\n\nPara iniciarmos a avaliação e liberação de acesso ao Sindicato oficial, preencha a ficha abaixo:\n\n• *Nome/Nick:* \n• *Idade:* \n• *Área (Desenho/Design/Gestão):* \n• *Objetivo:* \n\n_Aguarde a avaliação da Diretoria._" 
    }, null, 2));
} else {
    let conf = JSON.parse(fs.readFileSync(configFile));
    let alterou = false;
    if (!conf.mutados) { conf.mutados = []; alterou = true; }
    if (!conf.hasOwnProperty("grupoPortaria")) { conf.grupoPortaria = ""; alterou = true; }
    if (!conf.hasOwnProperty("ficha")) { 
        conf.ficha = "🪜 *𝐙𝐄𝐍𝐈𝐓𝐇 𝐒𝐘𝐍𝐃𝐈𝐂𝐀𝐓𝐄 — PORTARIA* 👑\n\nSeja bem-vindo(a) ao setor de triagem.\n\nPara iniciarmos a avaliação e liberação de acesso ao Sindicato oficial, preencha a ficha abaixo:\n\n• *Nome/Nick:* \n• *Idade:* \n• *Área (Desenho/Design/Gestão):* \n• *Objetivo:* \n\n_Aguarde a avaliação da Diretoria._"; 
        alterou = true; 
    }
    if (alterou) fs.writeFileSync(configFile, JSON.stringify(conf, null, 2));
}
if (!fs.existsSync(muralFile)) fs.writeFileSync(muralFile, JSON.stringify({ tema: "Nenhuma pauta ativa no momento.", calendario: "Nenhum evento marcado." }));
if (!fs.existsSync(atividadeFile)) fs.writeFileSync(atividadeFile, JSON.stringify({}));

// --- VARIÁVEIS DE CONTROLE ---
let modoManutencao = false; 
const spamTracker = {};
const avisosSpam = {};
const cmdSpamTracker = {}; 
const cooldowns = new Set();
const processadas = new Set(); 
const uptimeBot = Date.now();

// --- LOG DE INICIALIZAÇÃO CORPORATIVO ---
console.log(`
\x1b[36m███████╗███████╗███╗   ██╗██╗████████╗██╗  ██╗
╚══███╔╝██╔════╝████╗  ██║██║╚══██╔══╝██║  ██║
  ███╔╝ █████╗  ██╔██╗ ██║██║   ██║   ███████║
 ███╔╝  ██╔══╝  ██║╚██╗██║██║   ██║   ██╔══██║
███████╗███████╗██║ ╚████║██║   ██║   ██║  ██║
╚══════╝╚══════╝╚═╝  ╚═══╝╚═╝   ╚═╝   ╚═╝  ╚═╝\x1b[0m
    \x1b[1m> STATUS:\x1b[0m \x1b[32mSISTEMA ATIVADO 🛡️\x1b[0m
    \x1b[1m> UNIDADE:\x1b[0m \x1b[35m𝐙𝐄𝐍𝐈𝐓𝐇 𝐒𝐘𝐍𝐃𝐈𝐂𝐀𝐓𝐄\x1b[0m
    \x1b[1m> CRIADOR:\x1b[0m \x1b[34m\x1b[4mLUCAS\x1b[0m
`);

app.get("/", (req, res) => res.send("𝐙𝐄𝐍𝐈𝐓𝐇 bot online! 👑🪜"));
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
            console.log("✅ CONEXÃO ESTABELECIDA COM O SINDICATO!");
            
            setInterval(async () => {
                const agora = new Date();
                const hora = (agora.getUTCHours() - 3 + 24) % 24; 
                const minuto = agora.getUTCMinutes();
                
                if (sock && sock.authState && sock.authState.creds && sock.authState.creds.registered) {
                    try {
                        if (hora === 0 && minuto === 0) {
                            await sock.groupSettingUpdate(GRUPO_ID, 'announcement');
                            await sock.sendMessage(GRUPO_ID, { text: "🌙 *TOQUE DE RECOLHER!*\n\nOperações encerradas. Sindicato fechado." });
                        }
                        if (hora === 6 && minuto === 0) {
                            await sock.groupSettingUpdate(GRUPO_ID, 'not_announcement');
                            await sock.sendMessage(GRUPO_ID, { text: "☀️ *TURNO INICIADO!*\n\nSindicato aberto para o expediente de hoje." });
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
        const jidNumero = person.split("@")[0];
        let config = JSON.parse(fs.readFileSync(configFile));

        // --- SISTEMA DE DUPLA PORTARIA REFORMULADO ---
        if (anu.action === 'add') {
            // Se entrar na Portaria cadastrada dinamicamente
            if (config.grupoPortaria && from === config.grupoPortaria) {
                let textoFicha = config.ficha || "Ficha pendente de configuração.";
                try { await sock.sendMessage(from, { text: textoFicha, mentions: [person] }); } catch(e) {}
            }
            
            // Se for aprovado e entrar no grupo Geral
            if (from === GRUPO_ID) {
                const textoBoasVindas = `👑 *𝐁𝐄𝐌-𝐕𝐈𝐍𝐃𝐎 𝐀𝐎 𝐙𝐄𝐍𝐈𝐓𝐇 𝐒𝐘𝐍𝐃𝐈𝐂𝐀𝐓𝐄* 🪜\n\nDiretoria atualizada. @${jidNumero} agora faz parte da nossa divisão oficial.\n\n🚨 *DIRETRIZES:* Foco em profissionalismo e cooperação. Evite spam e condutas inadequadas.\n\nUse *!regras* para ver as diretrizes do grupo! ✨`;
                try { await sock.sendMessage(from, { text: textoBoasVindas, mentions: [person] }); } catch(e) {}
                
                // Registra o novo membro na inatividade
                let atv = JSON.parse(fs.readFileSync(atividadeFile));
                atv[person] = Date.now();
                fs.writeFileSync(atividadeFile, JSON.stringify(atv, null, 2));
            }
        }

        if (anu.action === 'remove' && from === GRUPO_ID) {
            try { await sock.sendMessage(from, { text: `📉 *BAIXA DETECTADA*\n\n@${jidNumero} foi desligado(a) ou abandonou o sindicato. Registro encerrado.`, mentions: [person] }); } catch(e) {}
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

        const rawText = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || 
                         msg.message.videoMessage?.caption || 
                         "";

        const messageContent = rawText.toLowerCase();

        if (!messageContent && !msg.message.imageMessage) return; 
        
        const isComando = messageContent.startsWith("!");
        const isDono = user === DONO_ID || user.includes("558291754240"); 

        let config = JSON.parse(fs.readFileSync(configFile));
        if (!config.mutados) config.mutados = [];

        // --- PROTEÇÃO ANTI-QUEDA PARA BUSCAR ADMs ---
        let isAdm = false;
        if (isGroup) {
            try {
                const meta = await sock.groupMetadata(from).catch(() => null);
                if (meta) {
                    isAdm = meta.participants.filter(p => p.admin).map(p => p.id).includes(user);
                }
            } catch (e) { 
                isAdm = false; 
                console.log("⚠️ Erro ao buscar ADMs, mas o bot continua vivo.");
            }
        }

        // --- SISTEMA DE MONITORAMENTO DE INATIVIDADE ---
        if (isGroup && from === GRUPO_ID) {
            let atv = JSON.parse(fs.readFileSync(atividadeFile));
            atv[user] = agora;
            fs.writeFileSync(atividadeFile, JSON.stringify(atv, null, 2));
        }

        // --- SISTEMA DE MUTE ---
        if (config.mutados.includes(user)) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch(e) {}
            return;
        }

        // --- FILTRO VIGILANTE: ANTI-LINK OCULTO ---
        if (isGroup && !isAdm && !isDono && (messageContent.includes('chat.whatsapp.com/') || messageContent.includes('http://') || messageContent.includes('https://'))) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch(e) {}
            return; 
        }

        // --- TRAVA DE MANUTENÇÃO ---
        if (isComando && modoManutencao && !isAdm && !isDono) {
            return sock.sendMessage(from, { text: "🚧 *ACESSO NEGADO:* O sistema do Sindicato está bloqueado pela Diretoria para monitoramento." });
        }

        // --- LOCKDOWN & SPAM DE COMANDO (MANTIDO INTACTO) ---
        if (isComando) {
            if (cooldowns.has(user)) return;
            cooldowns.add(user);
            const tempoEspera = (isAdm || isDono) ? 2000 : 5000;
            setTimeout(() => cooldowns.delete(user), tempoEspera);

            if (isGroup) {
                if (!cmdSpamTracker[user]) cmdSpamTracker[user] = [];
                cmdSpamTracker[user].push(agora);
                cmdSpamTracker[user] = cmdSpamTracker[user].filter(t => agora - t < 10000); 
                
                if (cmdSpamTracker[user].length >= 5) { 
                    if (!config.mutados.includes(user)) {
                        config.mutados.push(user);
                        fs.writeFileSync(configFile, JSON.stringify(config));
                        await sock.sendMessage(from, { text: `🚨 @${user.split("@")[0]} FOI SILENCIADO por quebra de protocolo (Spam de Comandos).`, mentions: [user] });
                        setTimeout(() => {
                            let cfg = JSON.parse(fs.readFileSync(configFile));
                            cfg.mutados = cfg.mutados.filter(u => u !== user);
                            fs.writeFileSync(configFile, JSON.stringify(cfg));
                            sock.sendMessage(from, { text: `🔊 @${user.split("@")[0]}, sua comunicação foi restabelecida. Mantenha a ordem.`, mentions: [user] });
                        }, 60000);
                    }
                    return;
                }
            }
        }

        // --- REAÇÕES CORPORATIVAS ---
        if (isGroup && !isComando) {
            if (Math.floor(Math.random() * 25) === 0) {
                const emojis = ["🪜", "👑", "🛡️", "⚙️", "✅", "👀"];
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                try { await sock.sendMessage(from, { react: { text: emoji, key: msg.key } }); } catch(e) {}
            }
        }

        // --- ANTI-SPAM DE MENSAGENS NORMAIS (MANTIDO INTACTO) ---
        if (isGroup && !msg.message.imageMessage) {
            if (spamTracker[user] && (agora - spamTracker[user]) < 1500) {
                if (!avisosSpam[user]) avisosSpam[user] = 0;
                avisosSpam[user]++;
                if (avisosSpam[user] === 5) {
                    await sock.sendMessage(from, { text: `⚠️ *@${user.split("@")[0]}, ALERTA DE SPAM.* Contenha-se ou será removido.`, mentions: [user] });
                } else if (avisosSpam[user] >= 10) {
                    try {
                        const meta = await sock.groupMetadata(from).catch(() => null);
                        const isAdmSpam = meta ? meta.participants.filter(p => p.admin).map(p => p.id).includes(user) : false;
                        if (!isAdmSpam && !isDono) {
                            await sock.sendMessage(from, { text: "🔨 *PROTOCOLO DE SEGURANÇA ATIVADO. REMOVIDO.*" });
                            await sock.groupParticipantsUpdate(from, [user], "remove");
                        }
                    } catch (e) {}
                }
                return; 
            }
            spamTracker[user] = agora;
            setTimeout(() => { if (Date.now() - spamTracker[user] > 5000) avisosSpam[user] = 0; }, 5000);
        }

        let mural = JSON.parse(fs.readFileSync(muralFile));

        // --- COMANDOS ADM & SEGUROS ---

        if (messageContent === "!id") {
            if (!isAdm && !isDono) return;
            return sock.sendMessage(from, { text: `🪜 *𝐙𝐄𝐍𝐈𝐓𝐇 INFO:* O ID deste chat é:\n\`${from}\`` });
        }

        if (messageContent === "!setportaria") {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            config.grupoPortaria = from;
            fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
            return sock.sendMessage(from, { text: `✅ *PORTARIA CONFIGURADA:* Este grupo agora está operando como o setor de triagem oficial do Sindicato.` });
        }

        if (messageContent.startsWith("!setficha")) {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const novaFicha = rawText.substring(9).trim(); // Captura com quebras de linha e letras maiúsculas intactas
            if (!novaFicha) return sock.sendMessage(from, { text: "💡 Use: !setficha [Escreva aqui o modelo de ficha completo]" });
            config.ficha = novaFicha;
            fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
            return sock.sendMessage(from, { text: `✅ *FICHA DE CADASTRO ATUALIZADA COM SUCESSO!*` });
        }

        if (messageContent === "!ficha") {
            return sock.sendMessage(from, { text: config.ficha });
        }

        if (messageContent.startsWith("!inativos")) {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const args = messageContent.split(" ");
            const diasLimite = parseInt(args[1]) || 7;
            const limiteMs = diasLimite * 24 * 60 * 60 * 1000;
            let atv = JSON.parse(fs.readFileSync(atividadeFile));
            
            let listaInativos = `🪜 *MONITORAMENTO DE INATIVIDADE (${diasLimite} dias ou mais):*\n\n`;
            let contagem = 0;
            let mencoes = [];

            for (const jid in atv) {
                const diff = agora - atv[jid];
                if (diff > limiteMs) {
                    listaInativos += `🚫 @${jid.split("@")[0]} (Ausente há ${Math.floor(diff / (24 * 60 * 60 * 1000))} dias)\n`;
                    mencoes.push(jid);
                    contagem++;
                }
            }

            if (contagem === 0) listaInativos = `✅ *STATUS:* Sindicato 100% operacional. Nenhuma inatividade acima de ${diasLimite} dias detectada.`;
            else listaInativos += `\n📊 *Total:* ${contagem} membros pendentes de auditoria/baixa.`;

            return sock.sendMessage(from, { text: listaInativos, mentions: mencoes });
        }

        if (messageContent === "!manutencao" || messageContent === "!parou") {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            modoManutencao = !modoManutencao;
            const status = modoManutencao ? "ATIVADO 🚧" : "DESATIVADO ✅";
            return sock.sendMessage(from, { text: `🛡️ *LOCKDOWN SISTEMA:* ${status}\n\n${modoManutencao ? "Interações bloqueadas para membros comuns." : "Sistema liberado para operações normais."}` });
        }

        if (messageContent.startsWith("!aviso")) {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const avisoTexto = messageContent.replace("!aviso", "").trim();
            if (!avisoTexto) return sock.sendMessage(from, { text: "💡 Use: !aviso [texto]" });
            const meta = await sock.groupMetadata(from).catch(() => null);
            if (meta) {
                return sock.sendMessage(from, { text: `📢 *COMUNICADO OFICIAL DA DIRETORIA* 📢\n\n${avisoTexto.toUpperCase()}\n\n@everyone`, mentions: meta.participants.map(p => p.id) });
            }
        }

        if (messageContent.startsWith("!settema")) {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const novoTema = messageContent.replace("!settema", "").trim();
            if (!novoTema) return sock.sendMessage(from, { text: "💡 Use: !settema [descrição]" });
            mural.tema = novoTema;
            fs.writeFileSync(muralFile, JSON.stringify(mural, null, 2));
            return sock.sendMessage(from, { text: `✅ *PAUTA ATUALIZADA:* \n${novoTema}` });
        }

        if (messageContent.startsWith("!setcalendario")) {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const cal = messageContent.replace("!setcalendario", "").trim();
            if (!cal) return sock.sendMessage(from, { text: "💡 Use: !setcalendario [data e evento]" });
            mural.calendario = cal;
            fs.writeFileSync(muralFile, JSON.stringify(mural, null, 2));
            return sock.sendMessage(from, { text: `✅ *AGENDA ATUALIZADA!*` });
        }

        if (messageContent.startsWith("!shiu")) {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const args = messageContent.split(" ");
            const mins = parseInt(args[1]) || 5;
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: `🤫 *ORDEM DE SILÊNCIO!* \nComunicações suspensas por ${mins} minutes.` });
            setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    await sock.sendMessage(from, { text: `🔊 *SISTEMA RESTABELECIDO!* Comunicações liberadas.` });
                } catch(e) {}
            }, mins * 60000);
            return;
        }

        if (messageContent.startsWith("!contagem")) {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const args = messageContent.split(" ");
            const mins = parseInt(args[1]);
            const motivo = args.slice(2).join(" ") || "Operação iniciada!";
            if (!mins) return sock.sendMessage(from, { text: "💡 *Uso:* !contagem [minutos] [motivo]" });
            
            await sock.sendMessage(from, { text: `⏳ *CONTAGEM REGRESSIVA!* \nMotivo: ${motivo}\nTempo: ${mins} minutos.` });
            setTimeout(async () => {
                const meta = await sock.groupMetadata(from).catch(() => null);
                if (meta) {
                    await sock.sendMessage(from, { text: `⏰ *TEMPO ESGOTADO!* \n\n${motivo.toUpperCase()}`, mentions: meta.participants.map(p => p.id) });
                }
            }, mins * 60000);
            return;
        }

        if (messageContent.startsWith("!mutar") && (isAdm || isDono)) {
            const alvo = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvo) return sock.sendMessage(from, { text: "💡 Marque quem deve ser neutralizado." });
            if (!config.mutados.includes(alvo)) config.mutados.push(alvo);
            fs.writeFileSync(configFile, JSON.stringify(config));
            return sock.sendMessage(from, { text: `🤐 @${alvo.split("@")[0]} teve suas permissões de fala revogadas.`, mentions: [alvo] });
        }

        if (messageContent.startsWith("!desmutar") && (isAdm || isDono)) {
            const alvo = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvo) return sock.sendMessage(from, { text: "💡 Marque quem deseja restabelecer." });
            config.mutados = config.mutados.filter(u => u !== alvo);
            fs.writeFileSync(configFile, JSON.stringify(config));
            return sock.sendMessage(from, { text: `🔊 @${alvo.split("@")[0]} teve suas permissões restauradas.`, mentions: [alvo] });
        }

        if (messageContent === "!tempo") {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const totalMs = Date.now() - uptimeBot;
            const horas = Math.floor(totalMs / 3600000);
            const mins = Math.floor((totalMs % 3600000) / 60000);
            return sock.sendMessage(from, { text: `⏳ *ESTABILIDADE:* Sistema online e vigiando há ${horas}h e ${mins}min.` });
        }

        if (messageContent === "!memoria") {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const usado = process.memoryUsage().heapUsed / 1024 / 1024;
            return sock.sendMessage(from, { text: `🧠 *USO DE REDE:* ${usado.toFixed(2)} MB alocados no servidor.` });
        }

        if (messageContent === "!status" || messageContent === "!saude") {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const usadoMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const totalMs = Date.now() - uptimeBot;
            const horas = Math.floor(totalMs / 3600000);
            const mins = Math.floor((totalMs % 3600000) / 60000);
            return sock.sendMessage(from, { text: `🏥 *DIAGNÓSTICO 𝐙𝐄𝐍𝐈𝐓𝐇:*\n\n🔋 RAM: ${usadoMB} MB\n⏱️ Uptime: ${horas}h ${mins}m\n🛡️ Segurança: Nível Máximo\n⚙️ Lockdown: ${modoManutencao ? "ON" : "OFF"}` });
        }

        if (messageContent === "!pingreal") {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const timestamp = msg.messageTimestamp * 1000;
            const ping = Date.now() - timestamp;
            return sock.sendMessage(from, { text: `🏓 *Latência:* ${ping}ms.` });
        }

        if (messageContent.startsWith("!votação") && (isAdm || isDono)) {
            const pauta = messageContent.replace("!votação", "").trim();
            return sock.sendMessage(from, { text: `🗳️ *ASSEMBLÉIA CONVOCADA:*\n\n"${pauta || 'Pauta não definida'}"\n\n👍 De acordo | 👎 Contra` });
        }

        // --- COMANDOS PARA TODOS ---

        if (messageContent === "!calendario") {
            return sock.sendMessage(from, { text: `📅 *AGENDA 𝐙𝐄𝐍𝐈𝐓𝐇:*\n\n${mural.calendario}` });
        }

        if (messageContent.startsWith("!lembrar")) {
            const args = messageContent.split(" ");
            const tempoStr = args[1]; 
            const texto = args.slice(2).join(" ") || "Anotação do sistema.";
            if (!tempoStr || !tempoStr.endsWith('m')) return sock.sendMessage(from, { text: "💡 *Uso:* !lembrar 10m [texto]" });
            const mins = parseInt(tempoStr.replace("m", ""));
            if (isNaN(mins) || mins <= 0 || mins > 120) return sock.sendMessage(from, { text: "⚠️ Defina um parâmetro válido (1m a 120m)." });
            await sock.sendMessage(from, { text: `⏰ Registro feito. Alerta programado para ${mins} minutos.` });
            setTimeout(async () => {
                await sock.sendMessage(from, { text: `⏰ *ALERTA DO SISTEMA!* @${user.split("@")[0]}:\n\n"${texto}"`, mentions: [user] });
            }, mins * 60000);
            return;
        }

        if (isGroup && (isAdm || isDono)) {
            if (messageContent === "!fechar") await sock.groupSettingUpdate(from, 'announcement');
            if (messageContent === "!abrir") await sock.groupSettingUpdate(from, 'not_announcement');
            if (messageContent.startsWith("!ban")) {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mention) { await sock.groupParticipantsUpdate(from, [mention], "remove"); return sock.sendMessage(from, { text: "🔨 *ELIMINADO DO SINDICATO.*" }); }
            }
        }

        if (messageContent === "!tema") return sock.sendMessage(from, { text: `🎨 *PAUTA ATUAL:* \n\n${mural.tema}` });
        if (messageContent === "!ping") return sock.sendMessage(from, { text: "🏓 Operacional." });
        
        if (messageContent === "!menu") {
            if (!isAdm && !isDono) return sock.sendMessage(from, { text: "❌ *ACESSO NEGADO.*" });
            const menuTxt = `👑 *SISTEMA 𝐙𝐄𝐍𝐈𝐓𝐇 𝐒𝐘𝐍𝐃𝐈𝐂𝐀𝐓𝐄* 🪜

🔹 *ACESSO GERAL:*
!ping | !regras | !tema
!calendario | !lembrar | !ficha

🛡️ *GESTÃO & SEGURANÇA (ADM):*
!status | !pingreal | !tempo | !memoria
!parou | !ban | !mutar | !desmutar | !shiu
!fechar | !abrir | !aviso | !inativos [dias]
!votação | !contagem | !id | !setportaria

✨ *MURAL & PORTARIA (ADM):*
!settema | !setcalendario | !setficha [texto]`;
            return sock.sendMessage(from, { text: menuTxt });
        }
        
        if (messageContent === "!regras") {
            const textoRegras = `🪜 *DIRETRIZES 𝐙𝐄𝐍𝐈𝐓𝐇 𝐒𝐘𝐍𝐃𝐈𝐂𝐀𝐓𝐄* 👑\n\n1️⃣ *PROFISSIONALISMO:* Mantenha o respeito mútuo.\n2️⃣ *CONTEÚDO:* Proibido material explícito (+18).\n3️⃣ *COMUNICAÇÃO:* Proibido flood/spam.\n4️⃣ *SEGURANÇA:* Links externos serão deletados de forma preventiva.\n\n⚠️ O descumprimento resultará em medidas disciplinares ou expulsão imediata.`;
            return sock.sendMessage(from, { text: textoRegras });
        }
    });
}

connectToWhatsApp();
