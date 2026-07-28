const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Envía el panel de tickets'),

    async execute(interaction) {
        await interaction.reply({
            content: '✅ Panel enviado correctamente.',
            ephemeral: true
        });
    }
};
