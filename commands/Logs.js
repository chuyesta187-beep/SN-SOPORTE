const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Configura el canal de logs')
        .addChannelOption(option =>
            option
                .setName('canal')
                .setDescription('Canal de logs')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const canal = interaction.options.getChannel('canal');

        const config = JSON.parse(fs.readFileSync('./data/config.json', 'utf8'));

        config.logsChannel = canal.id;

        fs.writeFileSync(
            './data/config.json',
            JSON.stringify(config, null, 2)
        );

        await interaction.reply({
            content: `✅ Canal de logs configurado en ${canal}.`,
            ephemeral: true
        });
    }
};
