const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Muestra la configuración del bot'),

    async execute(interaction) {

        const config = JSON.parse(
            fs.readFileSync('./data/config.json', 'utf8')
        );

        await interaction.reply({
            content:
`⚙️ CONFIGURACIÓN

📜 Canal Logs:
${config.logsChannel || 'No configurado'}

📂 Categoría Tickets:
${config.ticketsCategory || 'No configurada'}

🚫 Canal Blacklist:
${config.blacklistChannel || 'No configurado'}

👨‍💼 Rol Staff:
${config.staffRole || 'No configurado'}`,
            ephemeral: true
        });
    }
};
