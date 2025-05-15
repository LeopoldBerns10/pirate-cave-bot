const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const dataFile = 'event_tracker.json';
let trackerData = {};

// Chargement/Sauvegarde données
function loadData() {
  if (fs.existsSync(dataFile)) {
    trackerData = JSON.parse(fs.readFileSync(dataFile));
  } else {
    trackerData = {};
    saveData();
  }
}
function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(trackerData, null, 2));
}

// Création des boutons personnalisés
function createButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`plus1_${userId}`).setLabel('+1').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`plus5_${userId}`).setLabel('+5').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`white_${userId}`).setLabel('💀 White Drop').setStyle(ButtonStyle.Danger)
  );
}

// Génération de l'embed pour l'utilisateur
function getEmbed(userId, username) {
  const count = trackerData[userId]?.count || 0;
  const drops = trackerData[userId]?.whites || [];
  const positions = trackerData[userId]?.positions || [];
  const dropLines = drops.map((w, i) => `${positions[i]} : ${w}`).join('\n');
  return new EmbedBuilder()
    .setTitle(`📊 Compteur d'événements de ${username || `<@${userId}>`}`)
    .setDescription(
      `• Événements farmés : **${count}**\n` +
      `• White drops :\n${dropLines || "_Aucun pour l'instant_"}`
    )
    .setColor(0x00AE86);
}

// Initialisation unique du tracker (éviter de lier plusieurs fois l'event !)
let trackerInitialized = false;
function initTracker(client) {
  if (trackerInitialized) return;
  trackerInitialized = true;
  loadData();

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    const [action, targetUserId] = interaction.customId.split('_');
    if (!['plus1', 'plus5', 'white'].includes(action)) return;

    // Sécurité : ne laisser que le bon utilisateur cliquer
    if (interaction.user.id !== targetUserId) {
      await interaction.reply({ content: '❌ Pas ton compteur, matelot !', flags: 64 });
      return;
    }
    if (!trackerData[targetUserId]) trackerData[targetUserId] = { count: 0, whites: [], positions: [] };
    const data = trackerData[targetUserId];

    if (action === 'plus1') data.count += 1;
    else if (action === 'plus5') data.count += 5;
    else if (action === 'white') {
      await interaction.reply({ content: 'Quel est le nom de ce white bag ?', flags: 64 });

      // Attendre la réponse de l'utilisateur (un seul message attendu)
      const filter = m => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

      collector.on('collect', msg => {
        data.whites.push(msg.content);
        data.positions.push(data.count);
        saveData();
        msg.reply('💀 White enregistré avec succès !');
        // Mettre à jour le compteur après ajout du white
        interaction.message.edit({ embeds: [getEmbed(targetUserId, interaction.user.username)], components: [createButtons(targetUserId)] });
      });
      collector.on('end', collected => {
        if (!collected.size) interaction.followUp({ content: '⏰ Temps écoulé !', flags: 64 });
      });
      return;
    }

    saveData();
    await interaction.update({
      embeds: [getEmbed(targetUserId, interaction.user.username)],
      components: [createButtons(targetUserId)],
    });
  });
}

// Message principal unique
let mainButtonSent = false;
async function sendMainStartButton(client) {
  if (mainButtonSent) return;
  mainButtonSent = true;

  const channelId = '1370025441930510357'; // À personnaliser si besoin
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error('Salon introuvable !');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start_tracker')
      .setLabel('🚀 Démarrer mon compteur')
      .setStyle(ButtonStyle.Success)
  );
  await channel.send({
    content: `🧮 Héros, veux-tu suivre tes loots et tes événements ? Clique ici pour démarrer ton aventure !`,
    components: [row],
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'start_tracker') return;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    if (!trackerData[userId]) {
      trackerData[userId] = { count: 0, whites: [], positions: [] };
      saveData();
    }
    await interaction.reply({ content: `🧾 Ton compteur est prêt, ${username} !`, flags: 64 });
    await channel.send({ embeds: [getEmbed(userId, username)], components: [createButtons(userId)] });
  });
}

module.exports = { initTracker, sendMainStartButton };
