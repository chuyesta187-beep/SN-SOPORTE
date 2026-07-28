const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('black')
        .setDescription('Agrega un usuario a la blacklist')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuario a agregar')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('motivo')
                .setDescription('Motivo de la blacklist')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('pruebas')
                .setDescription('Link de pruebas')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        const usuario =
            interaction.options.getUser('usuario');

        const motivo =
            interaction.options.getString('motivo');

        const pruebas =
            interaction.options.getString('pruebas');

        const blacklist = JSON.parse(
            fs.readFileSync(
                './data/blacklist.json',
                'utf8'
            )
        );

        blacklist.users.push({
            userId: usuario.id,
            moderatorId: interaction.user.id,
            reason: motivo,
            evidence: pruebas,
            date: new Date().toISOString()
        });

        fs.writeFileSync(
            './data/blacklist.json',
            JSON.stringify(
                blacklist,
                null,
                2
            )
        );

        await interaction.reply({
            content:
                `✅ ${usuario.tag} agregado a la blacklist.`,
            ephemeral: true
        });
    }
};
