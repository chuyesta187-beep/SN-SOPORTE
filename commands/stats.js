const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Muestra estadísticas del bot'),

    async execute(interaction) {

        const tickets = JSON.parse(
            fs.readFileSync('./data/tickets.json', 'utf8')
        );

        const blacklist = JSON.parse(
            fs.readFileSync('./data/blacklist.json', 'utf8')
        );

        const totalTickets = tickets.tickets.length;
        const totalBlacklist = blacklist.users.length;

        await interaction.reply({
            content:
`📊 ESTADÍSTICAS

🎫 Tickets Totales: ${totalTickets}
🚫 Usuarios en Blacklist: ${totalBlacklist}
👥 Miembros del Servidor: ${interaction.guild.memberCount}`,
            ephemeral: true
        });
    }
};
