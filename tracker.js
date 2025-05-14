const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const dataFile = 'event_tracker.json';
let trackerData = {};

if (fs.existsSync(dataFile)) {
  trackerData = JSON.parse(fs.readFileSync(dataFile));
} else {
  fs.writeFileSync(dataFile, JSON.stringify(trackerData, null, 2));
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(trackerData, null, 2));
}

function createButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`plus1_${userId}`).setLabel('+1').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`plus5_${userId}`).setLabel('+5').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`white_${userId}`).setLabel('💀 White Drop').setStyle(ButtonStyle.Danger)
  );
}

function getEmbed(userId, username = null) {
  const count = trackerData[userId]?.count || 0;
  const drops = trackerData[userId]?.whites || [];
  const displayName = username ? username : `<@${userId}>`;

  const dropLines = drops.map((w, i) => `${trackerData[userId].positions[i]} : ${w}`).join('\\n');

  return new EmbedBuilder()
    .setTitle(`📊 Compteur d'événements de ${displayName}`)
    .setDescription(
      `• Événements farmés : **${count}**\\n` +
      `• White drops :\\n${dropLines || "_Aucun pour l'instant_"}`
    )
    .setColor(0x00AE86);
}

function initTracker(client) {
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    const [action, targetUserId] = interaction.customId.split('_');

    // Vérification si l'utilisateur est bien celui qui doit répondre à l'interaction
    if (interaction.user.id !== targetUserId) {
      await interaction.reply({ content: '❌ Pas ton compteur, matelot !', flags: 64 });
      return;
    }

    // Si l'utilisateur n'a pas de données dans le tracker, on en crée
    if (!trackerData[targetUserId]) {
      trackerData[targetUserId] = { count: 0, whites: [], positions: [] };
    }

    const data = trackerData[targetUserId];

    // Gestion des actions des boutons
    if (action === 'plus1') {
      data.count += 1;
    } else if (action === 'plus5') {
      data.count += 5;
    } else if (action === 'white') {
      await interaction.reply({ content: 'Quel est le nom de ce white bag ?', flags: 64 });
      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === interaction.user.id,
        max: 1,
        time: 15000
      });

      collector.on('collect', msg => {
        data.whites.push(msg.content);
        data.positions.push(data.count);
        saveData();
        msg.reply('💀 White enregistré avec succès !');
      });

      return;
    }

    saveData();
    const updatedEmbed = getEmbed(targetUserId, interaction.user.username);
    const row = createButtons(targetUserId);

    try {
      // Important : utiliser deferUpdate() pour éviter l'expiration de l'interaction
      await interaction.deferUpdate();  // Cette ligne "défère" la mise à jour pour répondre plus tard

      // Ensuite, mettre à jour l'interaction avec les nouvelles informations
      await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
    } catch (err) {
      console.error('Interaction expirée ou erreur inconnue:', err);
      await interaction.followUp({ content: 'Désolé, cette interaction a expiré.', flags: 64 });
    }
  });
}

async function sendMainStartButton(client) {
  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.get('1370025441930510357'); // Remplace par l'ID de ton salon

  if (!channel) throw new Error('Salon introuvable !');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start_tracker')
      .setLabel('🚀 Démarrer mon compteur')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({
    content: `🧮 Tu veux suivre tes loots et drops ? Clique ici !`,
    components: [row]
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'start_tracker') return;

    const userId = interaction.user.id;
    const username = interaction.user.username;

    if (!trackerData[userId]) {
      trackerData[userId] = { count: 0, whites: [], positions: [] };
      saveData();
    }

    const embed = getEmbed(userId, username);
    const buttons = createButtons(userId);

    try {
      // Défère la mise à jour de l'interaction
      await interaction.deferUpdate();  // Cela prolonge la validité de l'interaction

      // Envoie de la réponse après avoir différé l'interaction
      await interaction.editReply({ content: `🧾 Ton compteur est prêt, ${username} !`, flags: 64 });
      await channel.send({ embeds: [embed], components: [buttons] });
    } catch (err) {
      console.error('Erreur lors de l\'envoi du message :', err);
      await interaction.followUp({ content: 'Une erreur est survenue. Essaye à nouveau plus tard.', flags: 64 });
    }
  });
}

module.exports = {
  initTracker,
  sendMainStartButton
};
