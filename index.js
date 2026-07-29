const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ==========================================
// 1. PERSISTENCIA EN DISCO (CONFIG, TICKETS, STATS)
// ==========================================
const CONFIG_PATH = path.join(__dirname, 'config.json');
const TICKETS_PATH = path.join(__dirname, 'tickets.json');
const STATS_PATH = path.join(__dirname, 'stats.json');

const DEFAULT_CONFIG = {
  token: "TU_TOKEN_REAL_AQUI",
  staffRoleId: "1528316025320505364",
  logsChannelId: null,
  blacklistChannelId: "1528300586808639518",
  categoryTicketsId: null,
  blacklistRoleId: null,
  panelTitle: "👑 STEAL NATION",
  panelDescription: "Bienvenido al sistema de soporte oficial.\n\nSelecciona una categoría para abrir un ticket.",
  panelMessageId: null,
  panelChannelId: null,
  categories: [
    { id: "soporte", name: "Soporte General", emoji: "🎫", description: "Atención rápida para problemas generales.", questions: [{ id: "p1", label: "¿Cuál es tu problema?", style: "paragraph", required: true }] },
    { id: "postulacion", name: "Postulaciones", emoji: "📝", description: "Aplica para formar parte del equipo.", questions: [{ id: "p1", label: "¿Por qué quieres ser staff?", style: "paragraph", required: true }] },
    { id: "reporte", name: "Reportes", emoji: "⚠️", description: "Denuncia comportamientos inapropiados.", questions: [{ id: "p1", label: "Usuario y Pruebas", style: "paragraph", required: true }] },
    { id: "ventas", name: "Compras y Ventas", emoji: "🛒", description: "Soporte sobre transacciones comerciales.", questions: [{ id: "p1", label: "Detalles de la compra/venta", style: "paragraph", required: true }] },
    { id: "partners", name: "Partners", emoji: "🤝", description: "Solicita alianzas y asociaciones.", questions: [{ id: "p1", label: "Información del servidor", style: "paragraph", required: true }] },
    { id: "eventos", name: "Eventos", emoji: "🎉", description: "Dudas o soporte relacionado con eventos.", questions: [{ id: "p1", label: "Duda o problema del evento", style: "paragraph", required: true }] },
    { id: "donaciones", name: "Donaciones", emoji: "💰", description: "Realizar aportes o reclamar beneficios VIP.", questions: [{ id: "p1", label: "Método de pago / Comprobante", style: "paragraph", required: true }] },
    { id: "apelaciones", name: "Apelaciones Blacklist", emoji: "🚫", description: "Apelar una sanción en la lista negra.", questions: [{ id: "p1", label: "Motivo para remover sanción", style: "paragraph", required: true }] },
    { id: "boost", name: "Boost", emoji: "⭐", description: "Reclamar recompensas por boostear.", questions: [{ id: "p1", label: "Captura de pantalla", style: "short", required: true }] },
    { id: "premios", name: "Reclamar Premio", emoji: "🏆", description: "Reclamación de premios ganados.", questions: [{ id: "p1", label: "Premio y enlace del sorteo", style: "paragraph", required: true }] },
    { id: "estafas", name: "Reportar Estafa", emoji: "🔒", description: "Reporte directo sobre engaños o fraudes.", questions: [{ id: "p1", label: "Pruebas y usuario involucrado", style: "paragraph", required: true }] }
  ]
};

const DEFAULT_STATS = { creados: 0, resueltos: 0, cerrados: 0, ticketCounter: 0 };

if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
if (!fs.existsSync(TICKETS_PATH)) fs.writeFileSync(TICKETS_PATH, JSON.stringify({}, null, 2));
if (!fs.existsSync(STATS_PATH)) fs.writeFileSync(STATS_PATH, JSON.stringify(DEFAULT_STATS, null, 2));

let db = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
let ticketsDB = JSON.parse(fs.readFileSync(TICKETS_PATH, 'utf8'));
let statsDB = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));

// Sanitize Stats
if (typeof statsDB.creados !== 'number') statsDB.creados = 0;
if (typeof statsDB.resueltos !== 'number') statsDB.resueltos = 0;
if (typeof statsDB.cerrados !== 'number') statsDB.cerrados = 0;
if (typeof statsDB.ticketCounter !== 'number') statsDB.ticketCounter = 0;

const activeMdSessions = new Map();

function saveDB() {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(db, null, 2)); } catch (err) { console.error('Error config.json:', err); }
}
function saveTicketsDB() {
  try { fs.writeFileSync(TICKETS_PATH, JSON.stringify(ticketsDB, null, 2)); } catch (err) { console.error('Error tickets.json:', err); }
}
function saveStatsDB() {
  try { fs.writeFileSync(STATS_PATH, JSON.stringify(statsDB, null, 2)); } catch (err) { console.error('Error stats.json:', err); }
}

function getTicketOwnerId(channelId) {
  return ticketsDB[channelId] || null;
}

// ==========================================
// 2. LOGS Y GENERACIÓN COMPLETA DE TRANSCRIPT HTML
// ==========================================
async function sendLog(guild, content, attachment = null) {
  if (!db.logsChannelId) return;
  try {
    const channel = await guild.channels.fetch(db.logsChannelId).catch(() => null);
    if (channel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('📜 LOGS DE SOPORTE')
        .setDescription(content)
        .setColor('#2B2D31')
        .setTimestamp();

      const options = { embeds: [logEmbed] };
      if (attachment) options.files = [attachment];

      await channel.send(options);
    }
  } catch (err) {
    console.error('Error enviando log:', err);
  }
}

async function generateHTMLTranscript(channel) {
  let allMessages = [];
  let lastId;

  // Paginación completa para extraer TODO el historial del canal
  while (true) {
    const fetched = await channel.messages.fetch({ limit: 100, ...(lastId && { before: lastId }) });
    if (fetched.size === 0) break;
    allMessages.push(...fetched.values());
    lastId = fetched.last().id;
  }

  const messages = allMessages.reverse();

  let htmlMessages = '';
  for (const msg of messages) {
    const avatar = msg.author.displayAvatarURL();
    const time = msg.createdAt.toLocaleString('es-ES');
    let content = msg.content || '';

    if (msg.embeds.length > 0) {
      content += msg.embeds.map(e => `<div class="embed"><strong>${e.title || ''}</strong><br>${e.description || ''}</div>`).join('');
    }

    if (msg.attachments.size > 0) {
      content += msg.attachments.map(a => `<br><a href="${a.url}" target="_blank" class="attachment">📎 Adjunto: ${a.name}</a>`).join('');
    }

    htmlMessages += `
      <div class="message">
        <img src="${avatar}" class="avatar" />
        <div class="msg-body">
          <div class="header"><span class="author">${msg.author.tag}</span> <span class="time">${time}</span></div>
          <div class="text">${content.replace(/\n/g, '<br>')}</div>
        </div>
      </div>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Transcript - ${channel.name}</title>
      <style>
        body { background-color: #1e1f22; color: #dbdee1; font-family: 'gg sans', 'Helvetica Neue', Arial, sans-serif; padding: 20px; }
        h1 { color: #ffffff; border-bottom: 2px solid #2b2d31; padding-bottom: 10px; }
        .message { display: flex; margin-bottom: 15px; border-bottom: 1px solid #2b2d31; padding-bottom: 10px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; }
        .header { margin-bottom: 4px; }
        .author { font-weight: bold; color: #f2f3f5; }
        .time { font-size: 0.75rem; color: #949ba4; margin-left: 8px; }
        .text { color: #dbdee1; font-size: 0.95rem; }
        .embed { background: #2b2d31; padding: 10px; border-left: 4px solid #5865f2; border-radius: 4px; margin-top: 5px; }
        .attachment { color: #00a8fc; text-decoration: none; font-size: 0.85rem; }
      </style>
    </head>
    <body>
      <h1>📜 TRANSCRIPT COMPLETO: ${channel.name}</h1>
      <p>Servidor: STEAL NATION | Mensajes Totales: ${messages.length} | Exportado: ${new Date().toLocaleString('es-ES')}</p>
      <hr style="border: 1px solid #2b2d31; margin-bottom: 20px;">
      ${htmlMessages}
    </body>
    </html>
  `;

  return new AttachmentBuilder(Buffer.from(htmlContent, 'utf-8'), { name: `transcript-${channel.name}.html` });
}

// ==========================================
// 3. RENDERIZADO DEL PANEL
// ==========================================
function buildPanelEmbed() {
  const catListText = db.categories.length > 0 
    ? db.categories.map(c => `${c.emoji} **${c.name}**`).join('\n')
    : '*No hay categorías configuradas.*';

  const embed = new EmbedBuilder()
    .setTitle(db.panelTitle || '👑 STEAL NATION')
    .setDescription(`${db.panelDescription || 'Selecciona una categoría.'}\n\n${catListText}\n\n🔒 *Tickets privados*\n⚡ *Atención rápida*\n👨‍💼 *Staff activo*`)
    .setColor('#FFD700')
    .setFooter({ text: '👑 STEAL NATION • Sistema Oficial' });

  const selectOptions = db.categories.map(c => ({
    label: c.name,
    value: c.id,
    emoji: c.emoji,
    description: c.description ? c.description.substring(0, 50) : undefined
  }));

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_ticket_category')
      .setPlaceholder('📂 Selecciona una categoría para abrir un ticket')
      .addOptions(selectOptions.length > 0 ? selectOptions : [{ label: 'Sin categorías disponibles', value: 'none' }])
  );

  const adminButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_admin_panel')
      .setLabel('Administrar Panel')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [selectMenu, adminButton] };
}

async function refreshMainPanel(guild) {
  if (!db.panelChannelId || !db.panelMessageId) return;
  try {
    const channel = await guild.channels.fetch(db.panelChannelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(db.panelMessageId).catch(() => null);
    if (msg) await msg.edit(buildPanelEmbed());
  } catch (err) {
    console.error('Error actualizando el panel:', err);
  }
}

// ==========================================
// 4. REGISTRO DE SLASH COMMANDS & READY
// ==========================================
async function registerSlashCommands(token, clientId) {
  if (!token || token === "TU_TOKEN_REAL_AQUI") {
    return console.error('❌ [CONFIG ERROR] Reemplaza el token en config.json.');
  }

  const commands = [
    new SlashCommandBuilder().setName('panel').setDescription('Despliega el panel principal de tickets').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('logs').setDescription('Configura el canal de logs').addChannelOption(o => o.setName('canal').setDescription('Canal de logs').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('categoria').setDescription('Configura la categoría contenedora').addChannelOption(o => o.setName('categoria').setDescription('Categoría contenedora').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('black').setDescription('Agrega a un usuario a la Blacklist').addUserOption(o => o.setName('usuario').setDescription('Usuario a sancionar').setRequired(true)).addStringOption(o => o.setName('pruebas').setDescription('URL o texto de pruebas').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('stats').setDescription('Muestra las estadísticas de tickets'),
    new SlashCommandBuilder().setName('config').setDescription('Muestra la configuración actual')
  ];

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('🔄 Sincronizando Slash Commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✅ Slash Commands sincronizados.');
  } catch (err) {
    console.error('❌ Error registrando Slash Commands:', err);
  }
}

client.once('ready', async () => {
  console.log(`👑 STEAL NATION Bot iniciado como ${client.user.tag}`);

  // Auto-crear/Verificar Rol Blacklist
  for (const guild of client.guilds.cache.values()) {
    let role = guild.roles.cache.find(r => r.name === '🚫 BLACKLIST');
    if (!role) {
      try {
        role = await guild.roles.create({ name: '🚫 BLACKLIST', color: '#000000', reason: 'Auto-creado para sistema de blacklist' });
        console.log(`✅ Rol '🚫 BLACKLIST' creado en ${guild.name}`);
      } catch (err) {
        console.error(`Error creando rol blacklist en ${guild.name}:`, err);
      }
    }
    if (role && !db.blacklistRoleId) {
      db.blacklistRoleId = role.id;
      saveDB();
    }
  }

  await registerSlashCommands(db.token, client.user.id);
});

// ==========================================
// 5. ATENCIÓN DE COMMANDS
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild } = interaction;

  if (commandName === 'panel') {
    const panelData = buildPanelEmbed();
    const msg = await interaction.channel.send(panelData);

    db.panelMessageId = msg.id;
    db.panelChannelId = interaction.channel.id;
    saveDB();

    await interaction.reply({ content: '✅ Panel desplegado correctamente.', ephemeral: true });
  }

  if (commandName === 'logs') {
    const channel = options.getChannel('canal');
    db.logsChannelId = channel.id;
    saveDB();
    await interaction.reply({ content: `✅ Canal de logs configurado en ${channel}.`, ephemeral: true });
  }

  if (commandName === 'categoria') {
    const category = options.getChannel('categoria');

    if (category.type !== ChannelType.GuildCategory) {
      return interaction.reply({ content: '❌ Debes seleccionar un canal de tipo Categoría.', ephemeral: true });
    }

    db.categoryTicketsId = category.id;
    saveDB();
    await interaction.reply({ content: `✅ Categoría de tickets configurada en **${category.name}**.`, ephemeral: true });
  }

  if (commandName === 'black') {
    const targetUser = options.getUser('usuario');
    const pruebas = options.getString('pruebas');
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    if (targetMember && db.blacklistRoleId) {
      await targetMember.roles.add(db.blacklistRoleId).catch(() => {});
    }

    const blackEmbed = new EmbedBuilder()
      .setTitle('🚫 BLACKLIST REPORT')
      .setDescription(
        `👤 **Usuario:** ${targetUser}\n` +
        `📅 **Fecha:** ${new Date().toLocaleDateString('es-ES')}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `El usuario fue agregado a la blacklist por incumplimiento de las normas.\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📎 **Pruebas:**\n${pruebas}\n\n` +
        `⚠️ **No realizar intercambios con este usuario.**`
      )
      .setColor('#000000')
      .setThumbnail(targetUser.displayAvatarURL());

    const targetChannel = await client.channels.fetch(db.blacklistChannelId).catch(() => null);

    if (targetChannel) {
      const roleMention = db.blacklistRoleId ? `<@&${db.blacklistRoleId}>` : '@everyone';
      await targetChannel.send({ content: `${roleMention} @everyone`, embeds: [blackEmbed] });
      await interaction.reply({ content: `🚫 Usuario ${targetUser.tag} sancionado en la Blacklist.`, ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ Canal de Blacklist no encontrado.', ephemeral: true });
    }
  }

  if (commandName === 'stats') {
    const statsEmbed = new EmbedBuilder()
      .setTitle('📊 ESTADÍSTICAS | STEAL NATION')
      .addFields(
        { name: '📋 Tickets Creados', value: `${statsDB.creados}`, inline: true },
        { name: '✅ Tickets Resueltos', value: `${statsDB.resueltos}`, inline: true },
        { name: '🔒 Tickets Cerrados', value: `${statsDB.cerrados}`, inline: true }
      )
      .setColor('#3498DB');

    await interaction.reply({ embeds: [statsEmbed] });
  }

  if (commandName === 'config') {
    const configEmbed = new EmbedBuilder()
      .setTitle('⚙️ CONFIGURACIÓN DEL SISTEMA')
      .addFields(
        { name: '📜 Canal de Logs', value: db.logsChannelId ? `<#${db.logsChannelId}>` : '❌ Sin configurar', inline: true },
        { name: '📂 Categoría Tickets', value: db.categoryTicketsId ? `<#${db.categoryTicketsId}>` : '❌ Sin configurar', inline: true },
        { name: '👨‍💼 Rol Staff', value: db.staffRoleId ? `<@&${db.staffRoleId}>` : '❌ Sin configurar', inline: true },
        { name: '📢 Canal Blacklist', value: db.blacklistChannelId ? `<#${db.blacklistChannelId}>` : '❌ Sin configurar', inline: true },
        { name: '🚫 Rol Blacklist', value: db.blacklistRoleId ? `<@&${db.blacklistRoleId}>` : '❌ Sin configurar', inline: true }
      )
      .setColor('#9B59B6');

    await interaction.reply({ embeds: [configEmbed], ephemeral: true });
  }
});

// ==========================================
// 6. CREACIÓN DE TICKETS Y MODALES
// ==========================================
client.on('interactionCreate', async (interaction) => {

  if (interaction.isButton() && interaction.customId === 'btn_admin_panel') {
    const isOwner = interaction.guild.ownerId === interaction.user.id || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isOwner) return interaction.reply({ content: '❌ Requiere permisos de Administración.', ephemeral: true });

    const adminEmbed = new EmbedBuilder().setTitle('⚙️ ADMINISTRADOR DE CATEGORÍAS').setDescription('Gestiona las categorías de soporte.').setColor('#2B2D31');
    const adminButtonsRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_add_cat').setLabel('1️⃣ Agregar Categoría').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_del_cat').setLabel('2️⃣ Eliminar Categoría').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [adminEmbed], components: [adminButtonsRow1], ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'admin_add_cat') {
    const modal = new ModalBuilder()
      .setCustomId('modal_admin_add_cat')
      .setTitle('➕ Agregar Categoría')
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_name').setLabel('Nombre').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_emoji').setLabel('Emoji').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_desc').setLabel('Descripción').setStyle(TextInputStyle.Short).setRequired(false))
      );
    await interaction.showModal(modal);
  }

  if (interaction.isButton() && interaction.customId === 'admin_del_cat') {
    if (db.categories.length === 0) return interaction.reply({ content: '❌ No hay categorías.', ephemeral: true });
    const options = db.categories.map(c => ({ label: c.name, value: c.id, emoji: c.emoji }));
    const select = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('select_admin_del_cat').setPlaceholder('🗑 Selecciona categoría a eliminar').addOptions(options)
    );
    await interaction.reply({ content: 'Selecciona la categoría:', components: [select], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_admin_del_cat') {
    db.categories = db.categories.filter(c => c.id !== interaction.values[0]);
    saveDB();
    await interaction.update({ content: '✅ Categoría eliminada.', components: [] });
    await refreshMainPanel(interaction.guild);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'modal_admin_add_cat') {
    const name = interaction.fields.getTextInputValue('cat_name');
    const emoji = interaction.fields.getTextInputValue('cat_emoji');
    const description = interaction.fields.getTextInputValue('cat_desc');
    const id = 'cat_' + Date.now().toString(36);

    db.categories.push({ id, name, emoji, description, questions: [{ id: 'p1', label: 'Describe tu solicitud', style: 'paragraph', required: true }] });
    saveDB();

    await interaction.reply({ content: `✅ Categoría **${name}** agregada.`, ephemeral: true });
    await refreshMainPanel(interaction.guild);
  }

  // --- FORMULARIO Y CREACIÓN CON NOMBRES ORDENADOS (ticket-0001) ---
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_category') {
    const catId = interaction.values[0];
    if (catId === 'none') return interaction.reply({ content: '❌ Categoría no válida.', ephemeral: true });

    // Bloqueo de Múltiples Tickets por Usuario
    const existingTicket = Object.entries(ticketsDB).find(([_, userId]) => userId === interaction.user.id);
    if (existingTicket) {
      return interaction.reply({ content: '❌ Ya tienes un ticket abierto en el servidor.', ephemeral: true });
    }

    const categoryObj = db.categories.find(c => c.id === catId);
    if (!categoryObj) return interaction.reply({ content: 'Categoría no encontrada.', ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`modal_user_ticket_${catId}`).setTitle(`${categoryObj.emoji} ${categoryObj.name.substring(0, 30)}`);
    const questions = categoryObj.questions || [{ id: 'p1', label: 'Describe tu solicitud', style: 'paragraph', required: true }];

    questions.slice(0, 5).forEach(q => {
      const input = new TextInputBuilder().setCustomId(q.id).setLabel(q.label).setStyle(q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(q.required);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
    });

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_user_ticket_')) {
    const catId = interaction.customId.replace('modal_user_ticket_', '');
    const { guild, user } = interaction;

    await interaction.reply({ content: '✅ Se ha creado tu ticket de soporte.', ephemeral: true });

    statsDB.creados++;
    statsDB.ticketCounter++;
    saveStatsDB();

    const formattedCounter = String(statsDB.ticketCounter).padStart(4, '0');

    let targetParent = null;
    if (db.categoryTicketsId) {
      const parentChannel = await guild.channels.fetch(db.categoryTicketsId).catch(() => null);
      if (parentChannel && parentChannel.type === ChannelType.GuildCategory) targetParent = parentChannel.id;
    }

    const permissionOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ];

    if (db.staffRoleId && guild.roles.cache.has(db.staffRoleId)) {
      permissionOverwrites.push({
        id: db.staffRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      });
    }

    try {
      // Nombres Ordenados Incrementales
      const ticketChannel = await guild.channels.create({
        name: `ticket-${formattedCounter}`,
        type: ChannelType.GuildText,
        parent: targetParent,
        permissionOverwrites
      });

      ticketsDB[ticketChannel.id] = user.id;
      saveTicketsDB();

      let answers = '';
      for (const field of interaction.fields.fields.values()) {
        answers += `**${field.label}:**\n${field.value}\n\n`;
      }

      const staffEmbed = new EmbedBuilder()
        .setTitle(`📋 TICKET #${formattedCounter}`)
        .setDescription(`👤 **Usuario:** ${user} (\`${user.id}\`)\n📂 **Categoría:** ${catId.toUpperCase()}\n\n━━━━━━━━━━━━━━\n\n${answers}━━━━━━━━━━━━━━\n\n💬 *Usa !reply <mensaje> para responder por MD.*`)
        .setColor('#2B2D31')
        .setTimestamp();

      const staffButtonsRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_claim').setLabel('Reclamar Ticket').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_md').setLabel('Abrir MD').setEmoji('📩').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_request_info').setLabel('Pedir Datos').setEmoji('📝').setStyle(ButtonStyle.Secondary)
      );

      const staffButtonsRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_resolve').setLabel('Resolver').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_close').setLabel('Cerrar').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_delete').setLabel('Eliminar').setEmoji('🗑').setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ embeds: [staffEmbed], components: [staffButtonsRow1, staffButtonsRow2] });
      await sendLog(guild, `📋 **Ticket Creado** (#${formattedCounter})\n👤 **Usuario:** ${user.tag}\n📂 **Categoría:** ${catId}\n🆔 **Canal:** ${ticketChannel.name}`);

    } catch (createErr) {
      console.error('Error creando el canal:', createErr);
    }
  }

  // --- BOTONES EXCLUSIVOS DEL STAFF ---
  if (interaction.isButton() && ['btn_claim', 'btn_open_md', 'btn_request_info', 'btn_resolve', 'btn_close', 'btn_delete'].includes(interaction.customId)) {
    
    // Control de Acceso: Solo Staff
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || (db.staffRoleId && interaction.member.roles.cache.has(db.staffRoleId));
    if (!isStaff) {
      return interaction.reply({ content: '❌ Solo el Staff de STEAL NATION puede usar estos botones.', ephemeral: true });
    }

    const ticketChannel = interaction.channel;
    const userId = getTicketOwnerId(ticketChannel.id);
    const targetUser = userId ? await client.users.fetch(userId).catch(() => null) : null;

    if (interaction.customId === 'btn_claim') {
      const claimEmbed = new EmbedBuilder()
        .setDescription(`🙋‍♂️ **Atención:** Este ticket ahora está siendo atendido por ${interaction.user}.`)
        .setColor('#3498DB');
      await interaction.reply({ embeds: [claimEmbed] });
      await sendLog(interaction.guild, `🙋‍♂️ **Ticket Reclamado** - #${ticketChannel.name} por ${interaction.user.tag}`);
    }

    if (interaction.customId === 'btn_open_md') {
      if (!targetUser) return interaction.reply({ content: '❌ Usuario dueño del ticket no encontrado.', ephemeral: true });
      activeMdSessions.set(targetUser.id, ticketChannel.id);

      const mdEmbed = new EmbedBuilder().setTitle('👑 STEAL NATION').setDescription('Un miembro del Staff ha iniciado un chat directo contigo por este ticket. Responde a este mensaje.').setColor('#FFD700');
      try {
        await targetUser.send({ embeds: [mdEmbed] });
        await interaction.reply({ content: '📩 **Conversación por MD abierta.**' });
      } catch {
        await interaction.reply({ content: '❌ El usuario tiene sus MDs cerrados.', ephemeral: true });
      }
    }

    if (interaction.customId === 'btn_request_info') {
      if (!targetUser) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });
      try {
        await targetUser.send('👑 **STEAL NATION**\n\nEl staff solicita más información sobre tu caso. Por favor responde a este mensaje.');
        await interaction.reply({ content: '📝 **Solicitud de datos enviada al MD del usuario.**' });
      } catch {
        await interaction.reply({ content: '❌ Imposible enviar MD.', ephemeral: true });
      }
    }

    if (interaction.customId === 'btn_resolve') {
      statsDB.resueltos++;
      saveStatsDB();

      if (targetUser) {
        await targetUser.send('👑 **STEAL NATION**: Tu ticket ha sido marcado como **RESUELTO**. ¡Gracias!').catch(() => {});
      }
      await interaction.reply({ content: '✅ **Ticket RESUELTO.**' });
      await sendLog(interaction.guild, `✅ **Ticket Resuelto** - #${ticketChannel.name} por ${interaction.user.tag}`);
    }

    if (interaction.customId === 'btn_close') {
      statsDB.cerrados++;
      saveStatsDB();

      if (targetUser) {
        activeMdSessions.delete(targetUser.id);
        // Bloquear permisos de envio al usuario en el canal
        await ticketChannel.permissionOverwrites.edit(targetUser.id, { SendMessages: false }).catch(() => {});
      }

      // Renombrar canal
      await ticketChannel.setName(`closed-${ticketChannel.name}`).catch(() => {});

      // Generación y envío inmediato de transcript al cerrar
      const transcriptAttachment = await generateHTMLTranscript(ticketChannel);

      const closeEmbed = new EmbedBuilder().setTitle('🔒 Ticket Cerrado').setDescription(`👨‍💼 **Staff:** ${interaction.user}\n👤 **Usuario:** ${targetUser ? targetUser.tag : 'Desconocido'}\n\n*El canal ha sido bloqueado y renombrado.*`).setColor('#ED4245');
      await interaction.reply({ embeds: [closeEmbed] });
      await sendLog(interaction.guild, `🔒 **Ticket Cerrado** - #${ticketChannel.name} por ${interaction.user.tag}`, transcriptAttachment);
    }

    if (interaction.customId === 'btn_delete') {
      await interaction.reply({ content: '🗑 Generando transcript final y eliminando canal en 5 segundos...' });

      if (targetUser) activeMdSessions.delete(targetUser.id);

      const transcriptAttachment = await generateHTMLTranscript(ticketChannel);

      delete ticketsDB[ticketChannel.id];
      saveTicketsDB();

      await sendLog(interaction.guild, `🗑 **Ticket Eliminado** - #${ticketChannel.name}\n👨‍💼 **Staff:** ${interaction.user.tag}`, transcriptAttachment);

      setTimeout(() => {
        ticketChannel.delete().catch(() => {});
      }, 5000);
    }
  }
});

// ==========================================
// 7. PUENTE DE MENSAJES BIDIRECCIONAL (MD ↔ TICKET Y COMMAND !reply CON SEGURIDAD)
// ==========================================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // A) MENSAJE DESDE EL TICKET DE STAFF HACIA EL USUARIO (!reply)
  if (message.guild && message.content.startsWith('!reply ')) {
    // Verificación de Permiso de Staff
    const isStaff = message.member.permissions.has(PermissionFlagsBits.ManageChannels) || (db.staffRoleId && message.member.roles.cache.has(db.staffRoleId));
    if (!isStaff) return;

    const userId = getTicketOwnerId(message.channel.id);
    if (!userId) return;

    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (!targetUser) return message.reply('❌ Usuario no encontrado.');

    const replyText = message.content.slice(7);
    const staffMdEmbed = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setTitle('👑 Respuesta del Staff')
      .setDescription(replyText)
      .setColor('#FFD700')
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [staffMdEmbed] });
      await message.react('✅');
    } catch {
      await message.reply('❌ No se pudo enviar el MD al usuario (MDs cerrados).');
    }
    return;
  }

  // B) MENSAJE DESDE EL MD DEL USUARIO HACIA EL CANAL DEL TICKET
  if (message.channel.type === ChannelType.DM) {
    let activeTicketId = activeMdSessions.get(message.author.id);

    if (!activeTicketId) {
      const entry = Object.entries(ticketsDB).find(([_, userId]) => userId === message.author.id);
      if (entry) {
        activeTicketId = entry[0];
        activeMdSessions.set(message.author.id, activeTicketId);
      }
    }

    if (!activeTicketId) return;

    const ticketChannel = await client.channels.fetch(activeTicketId).catch(() => null);

    if (ticketChannel) {
      const userMessageEmbed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setTitle('📩 Respuesta del Usuario (MD)')
        .setDescription(message.content || '*[Sin contenido]*')
        .setColor('#5865F2')
        .setTimestamp();

      if (message.attachments.size > 0) {
        userMessageEmbed.addFields({ name: 'Archivos Adjuntos', value: message.attachments.map(a => a.url).join('\n') });
      }

      await ticketChannel.send({ embeds: [userMessageEmbed] });
      await message.react('✅').catch(() => {});
    }
  }
});

client.login(db.token);

