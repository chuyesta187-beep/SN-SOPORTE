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

// ARCHIVO DE CONFIGURACIÓN DINÁMICA
const CONFIG_PATH = path.join(__dirname, 'config.json');
let db = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Guardar cambios en el JSON
function saveDB() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(db, null, 2));
}

// Mapas de sesiones en memoria
const userToTicketMap = new Map();
const ticketToUserMap = new Map();

// ==========================================
// FUNCIÓN PARA CONSTRUIR Y ACTUALIZAR EL PANEL
// ==========================================
function buildPanelEmbed() {
  let catListText = db.categories.map(c => `${c.emoji} **${c.name}**`).join('\n');
  
  const embed = new EmbedBuilder()
    .setTitle(db.panelTitle)
    .setDescription(`${db.panelDescription}\n\n${catListText}\n\n🔒 *Tickets privados*\n⚡ *Atención rápida*\n👨‍💼 *Staff activo*`)
    .setColor('#FFD700')
    .setFooter({ text: '👑 STEAL NATION • Sistema Oficial' });

  // Menú de opciones dinámico
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
      .addOptions(selectOptions.length > 0 ? selectOptions : [{ label: 'Sin categorías', value: 'none' }])
  );

  // Botón dinámico de administración
  const adminButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_admin_panel')
      .setLabel('Administrar Panel')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [selectMenu, adminButton] };
}

// Refrescar el mensaje del panel automáticamente si fue editado
async function refreshMainPanel(guild) {
  if (!db.panelChannelId || !db.panelMessageId) return;
  try {
    const channel = await guild.channels.fetch(db.panelChannelId);
    const msg = await channel.messages.fetch(db.panelMessageId);
    if (msg) {
      await msg.edit(buildPanelEmbed());
    }
  } catch (err) {
    console.error('Error al refrescar el panel principal:', err);
  }
}

// ==========================================
// READY & CREACIÓN DE ROL BLACKLIST
// ==========================================
client.once('ready', async () => {
  console.log(`👑 STEAL NATION Bot iniciado como ${client.user.tag}`);

  client.guilds.cache.forEach(async (guild) => {
    try {
      let role = guild.roles.cache.find(r => r.name === '🚫 BLACKLIST');
      if (!role) {
        role = await guild.roles.create({
          name: '🚫 BLACKLIST',
          color: '#000000',
          reason: 'Rol del sistema de sanción de STEAL NATION'
        });
      }
      db.blacklistRoleId = role.id;
      saveDB();
    } catch (err) {
      console.error(err);
    }
  });
});

// ==========================================
// SLASH COMMANDS: /panel, /logs, /categoria, /black
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

    await interaction.reply({ content: '✅ Panel desplegado y guardado en la base de datos.', ephemeral: true });
  }

  if (commandName === 'logs') {
    const channel = options.getChannel('canal');
    db.logsChannelId = channel.id;
    saveDB();
    await interaction.reply({ content: `✅ Canal de logs configurado en ${channel}.`, ephemeral: true });
  }

  if (commandName === 'categoria') {
    const category = options.getChannel('categoria');
    db.categoryTicketsId = category.id;
    saveDB();
    await interaction.reply({ content: `✅ Categoría contenedora configurada en **${category.name}**.`, ephemeral: true });
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
        `El usuario fue agregado a la blacklist por incumplimiento de las normas de la comunidad.\n\n` +
        `Tras revisar las pruebas proporcionadas y verificar la situación, el equipo de STEAL NATION determinó que la sanción es válida.\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📎 **Pruebas:**\n${pruebas}\n\n` +
        `⚠️ **No realizar intercambios o negocios con este usuario.**`
      )
      .setColor('#000000')
      .setThumbnail(targetUser.displayAvatarURL());

    const targetChannel = await client.channels.fetch(db.blacklistChannelId).catch(() => null);

    if (targetChannel) {
      await targetChannel.send({ content: `<@&${db.blacklistRoleId || ''}> @everyone`, embeds: [blackEmbed] });
      await interaction.reply({ content: `🚫 Usuario ${targetUser.tag} sancionado e informado en la Blacklist.`, ephemeral: true });
    }
  }
});

// ==========================================
// INTERACCIONES Y PANEL DE ADMINISTRACIÓN
// ==========================================
client.on('interactionCreate', async (interaction) => {

  // --- BOTÓN "⚙️ ADMINISTRAR PANEL" ---
  if (interaction.isButton() && interaction.customId === 'btn_admin_panel') {
    // Verificar si es Owner o Dueño del Servidor
    const isOwner = interaction.guild.ownerId === interaction.user.id || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner) {
      return interaction.reply({ content: '❌ No tienes permisos para usar esta función.', ephemeral: true });
    }

    const adminEmbed = new EmbedBuilder()
      .setTitle('⚙️ ADMINISTRADOR DE CATEGORÍAS')
      .setDescription('Desde aquí puedes modificar la estructura del panel sin tocar el código.')
      .setColor('#2B2D31');

    const adminButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_add_cat').setLabel('1️⃣ Agregar Categoría').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_edit_desc').setLabel('4️⃣ Cambiar Descripción').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_del_cat').setLabel('3️⃣ Eliminar Categoría').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [adminEmbed], components: [adminButtons], ephemeral: true });
  }

  // --- ACCIÓN: CAMBIAR DESCRIPCIÓN DEL PANEL ---
  if (interaction.isButton() && interaction.customId === 'admin_edit_desc') {
    const modal = new ModalBuilder()
      .setCustomId('modal_admin_edit_desc')
      .setTitle('📝 Cambiar Descripción del Panel')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('new_desc')
            .setLabel('Nueva Descripción')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(db.panelDescription)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
  }

  // --- ACCIÓN: AGREGAR CATEGORÍA ---
  if (interaction.isButton() && interaction.customId === 'admin_add_cat') {
    const modal = new ModalBuilder()
      .setCustomId('modal_admin_add_cat')
      .setTitle('➕ Agregar Categoría')
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_name').setLabel('Nombre (ej: 💰 Donaciones)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_emoji').setLabel('Emoji (ej: 💰)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_desc').setLabel('Descripción breve').setStyle(TextInputStyle.Short).setRequired(false))
      );
    await interaction.showModal(modal);
  }

  // --- ACCIÓN: ELIMINAR CATEGORÍA ---
  if (interaction.isButton() && interaction.customId === 'admin_del_cat') {
    if (db.categories.length === 0) return interaction.reply({ content: '❌ No hay categorías para eliminar.', ephemeral: true });

    const options = db.categories.map(c => ({ label: c.name, value: c.id, emoji: c.emoji }));
    const select = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('select_admin_del_cat').setPlaceholder('🗑 Selecciona la categoría a eliminar').addOptions(options)
    );

    await interaction.reply({ content: 'Selecciona la categoría que deseas eliminar:', components: [select], ephemeral: true });
  }

  // --- PROCESAR SELECCIÓN DE ELIMINAR ---
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_admin_del_cat') {
    const catId = interaction.values[0];
    db.categories = db.categories.filter(c => c.id !== catId);
    saveDB();

    await interaction.update({ content: '✅ Categoría eliminada correctamente.', components: [] });
    await refreshMainPanel(interaction.guild);
  }

  // --- PROCESAR MODALES DE ADMINISTRACIÓN ---
  if (interaction.isModalSubmit()) {
    
    // Guardar Nueva Descripción
    if (interaction.customId === 'modal_admin_edit_desc') {
      db.panelDescription = interaction.fields.getTextInputValue('new_desc');
      saveDB();

      await interaction.reply({ content: '✅ **Panel actualizado.** Todos los cambios fueron guardados correctamente.', ephemeral: true });
      await refreshMainPanel(interaction.guild);
    }

    // Guardar Nueva Categoría
    if (interaction.customId === 'modal_admin_add_cat') {
      const name = interaction.fields.getTextInputValue('cat_name');
      const emoji = interaction.fields.getTextInputValue('cat_emoji');
      const description = interaction.fields.getTextInputValue('cat_desc');
      const id = name.toLowerCase().replace(/[^a-z0-0]/g, '');

      db.categories.push({ id, name, emoji, description });
      saveDB();

      await interaction.reply({ content: `✅ Categoría **${name}** agregada correctamente.`, ephemeral: true });
      await refreshMainPanel(interaction.guild);
    }

    // --- PROCESAR FORMULARIO GENERADO DE UN TICKET ABRIRSE ---
    if (interaction.customId.startsWith('modal_user_ticket_')) {
      const guild = interaction.guild;
      const user = interaction.user;

      await interaction.reply({ content: '✅ **Formulario completado.** Tu solicitud fue enviada al Staff.', ephemeral: true });

      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`,
        type: ChannelType.GuildText,
        parent: db.categoryTicketsId || null,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.guild.roles.premiumSubscriberRoleHeader || guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel] } 
        ]
      });

      ticketToUserMap.set(ticketChannel.id, user.id);

      let answers = '';
      interaction.fields.fields.forEach(f => { answers += `**${f.label}:**\n${f.value}\n\n`; });

      const staffEmbed = new EmbedBuilder()
        .setTitle('📋 NUEVA SOLICITUD')
        .setDescription(`👤 **Usuario:** ${user}\n🆔 **Ticket:** #${ticketChannel.name}\n\n━━━━━━━━━━━━━━\n\n${answers}━━━━━━━━━━━━━━`)
        .setColor('#2B2D31');

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_md').setLabel('Abrir Chat MD').setEmoji('📩').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_resolve').setLabel('Resolver').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_close').setLabel('Cerrar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_delete').setLabel('Eliminar Ticket').setEmoji('🗑').setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ embeds: [staffEmbed], components: [buttons] });
    }
  }

  // --- SELECCIÓN DEL USUARIO PARA ABRIR TICKET ---
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_category') {
    const catId = interaction.values[0];
    const categoryObj = db.categories.find(c => c.id === catId);

    if (!categoryObj) return interaction.reply({ content: 'Categoría no válida.', ephemeral: true });

    // Desplegar Modal Genérico Dinámico
    const modal = new ModalBuilder()
      .setCustomId(`modal_user_ticket_${catId}`)
      .setTitle(`${categoryObj.emoji} ${categoryObj.name}`)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('field_details').setLabel('Describe tu solicitud / problema').setStyle(TextInputStyle.Paragraph).setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }
});

// ==========================================
// CHAT BIDIRECCIONAL POR MD (STAFF <-> USUARIO)
// ==========================================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.channel.type === ChannelType.DM) {
    const activeTicketId = userToTicketMap.get(message.author.id);
    if (!activeTicketId) return;

    const ticketChannel = await client.channels.fetch(activeTicketId).catch(() => null);
    if (ticketChannel) {
      const embed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setTitle('📩 Respuesta del Usuario')
        .setDescription(message.content || '*[Archivo / Imagen]*')
        .setColor('#5865F2');

      await ticketChannel.send({ embeds: [embed] });
      await message.react('✅').catch(() => {});
    }
  }
});

client.login('TU_BOT_TOKEN_AQUI');
