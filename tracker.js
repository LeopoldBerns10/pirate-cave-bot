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

    if (interaction.user.id !== targetUserId) {
      await interaction.reply({ content: '❌ Pas ton compteur, matelot !', ephemeral: true });
      return;
    }

    if (!trackerData[targetUserId]) {
      trackerData[targetUserId] = { count: 0, whites: [], positions: [] };
    }

    const data = trackerData[targetUserId];

    if (action === 'plus1') {
      data.count += 1;
    } else if (action === 'plus5') {
      data.count += 5;
    } else if (action === 'white') {
      await interaction.reply({ content: 'Quel est le nom de ce white bag ?', ephemeral: true });
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
    await interaction.update({ embeds: [updatedEmbed], components: [row] });
  });
}

async function sendMainStartButton(client) {
  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.get('1370025441930510357'); // salon

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
    await interaction.reply({ content: `🧾 Ton compteur est prêt, ${username} !`, ephemeral: true });
    await channel.send({ embeds: [embed], components: [buttons]()
