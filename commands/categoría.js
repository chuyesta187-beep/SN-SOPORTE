const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('categoria')
        .setDescription('Configura la categoría donde se crearán los tickets')
        .addChannelOption(option =>
            option
                .setName('categoria')
                .setDescription('Categoría de tickets')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const categoria = interaction.options.getChannel('categoria');

        const config = JSON.parse(
            fs.readFileSync('./data/config.json', 'utf8')
        );

        config.ticketsCategory = categoria.id;

        fs.writeFileSync(
            './data/config.json',
            JSON.stringify(config, null, 2)
        );

        await interaction.reply({
            content: `✅ Categoría configurada: ${categoria.name}`,
            ephemeral: true
        });
    }
};
