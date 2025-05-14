require('dotenv').config(); // 📦 Charge les variables d’environnement

const { Client, GatewayIntentBits, Partials, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');

// 🔐 Variables d’environnement
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const MESSAGE_ID = process.env.MESSAGE_ID;
const dataFile = 'event_tracker.json';
let trackerData = {};

// ⚙️ Création du client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// 🚀 Connexion à Discord
client.login(TOKEN);

// Chargement des données depuis le fichier JSON si elles existent, sinon initialisation
if (fs.existsSync(dataFile)) {
  trackerData = JSON.parse(fs.readFileSync(dataFile));
} else {
  fs.writeFileSync(dataFile, JSON.stringify(trackerData, null, 2));
}

// Sauvegarde des données dans le fichier JSON
function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(trackerData, null, 2));
  console.log('Données sauvegardées dans event_tracker.json');
}

// Création des boutons pour interagir avec le compteur
function createButtons(userId) {
  console.log(`Création des boutons pour l'utilisateur ${userId}`);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`plus1_${userId}`).setLabel('+1').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`plus5_${userId}`).setLabel('+5').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`white_${userId}`).setLabel('💀 White Drop').setStyle(ButtonStyle.Danger)
  );
}

// Génération de l'embed qui affiche le compteur et les white drops
function getEmbed(userId, username = null) {
  console.log(`Génération de l'embed pour l'utilisateur ${userId}`);
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

// Fonction principale pour initialiser le suivi de l'utilisateur
function initTracker(client) {
  console.log('Initialisation du suivi des interactions');
  
  client.on(Events.InteractionCreate, async interaction => {
    console.log('Interaction reçue:', interaction.customId);

    if (!interaction.isButton()) return;

    const [action, targetUserId] = interaction.customId.split('_');

    // Vérification si l'utilisateur est bien celui qui doit répondre à l'interaction
    if (interaction.user.id !== targetUserId) {
      console.log(`Interaction non autorisée de ${interaction.user.id}`);
      await interaction.reply({ content: '❌ Pas ton compteur, matelot !', flags: 64 });
      return;
    }

    console.log(`Traitement de l'interaction pour l'utilisateur ${targetUserId}`);

    // Si l'utilisateur n'a pas de données dans le tracker, on en crée
    if (!trackerData[targetUserId]) {
      trackerData[targetUserId] = { count: 0, whites: [], positions: [] };
    }

    const data = trackerData[targetUserId];

    // Gestion des actions des boutons
    if (action === 'plus1') {
      console.log(`Augmentation de 1 pour l'utilisateur ${targetUserId}`);
      data.count += 1;
    } else if (action === 'plus5') {
      console.log(`Augmentation de 5 pour l'utilisateur ${targetUserId}`);
      data.count += 5;
    } else if (action === 'white') {
      console.log(`Demande de white drop pour l'utilisateur ${targetUserId}`);
      await interaction.deferUpdate();  // Différer l'interaction avant de répondre

      // Demander le nom du "white drop"
      await interaction.followUp({ content: 'Quel est le nom de ce white bag ?', ephemeral: true });

      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === interaction.user.id,
        max: 1,
        time: 15000
      });

      collector.on('collect', msg => {
        console.log(`White drop collecté : ${msg.content}`);
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
      await interaction.deferUpdate();  // Différer avant de répondre
      await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
      console.log('Réponse mise à jour avec succès');
    } catch (err) {
      console.error('Erreur lors de l\'interaction:', err);
      await interaction.followUp({ content: 'Une erreur est survenue. Essaye à nouveau plus tard.', flags: 64 });
    }
  });
}

// 📌 Création de journal de bord sur réaction 📜
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.message.id !== MESSAGE_ID || reaction.emoji.name !== '📜') return;

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(user.id);
    const category = await guild.channels.fetch(CATEGORY_ID);
    const botMember = await guild.members.fetch(client.user.id);

    const channelName = `journal-${member.user.username.toLowerCase()}`;
    const existing = guild.channels.cache.find(c => c.name === channelName);

    if (existing) {
      await member.send("📝 Tu as déjà un journal, moussaillon !");
      return;
    }

    const overwrites = [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.AddReactions,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.UseExternalEmojis
        ]
      },
      {
        id: botMember.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.AddReactions
        ]
      }
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: 0,
      parent: category.id,
      permissionOverwrites: overwrites
    });

    const msg = await channel.send({
      content: `🏴‍☠️ **Bienvenue dans ta cale personnelle, matelot <@${member.id}> !**\n\nT’as hérité de ta propre coque. Tu peux t’y étaler comme un Kraken sur son trône. C’est chez toi ici. **Pas de règles. Pas de limites.** Tu fais ce que tu veux… sauf couler 😏\n\n🪙 Ce journal, c’est ton histoire. Tes loots. Tes légendes. Tes erreurs aussi.\n\nQuoi que tu choisisses...\n**Fais-le bien. Fais-le grand. Fais-le Pirate Cave.**\n\n— 🦜 *Le scribe automatique, plume trempée dans le rhum*`
    });

    await msg.pin();
    console.log(`✅ Salon ${channelName} créé avec succès.`);

  } catch (err) {
    console.error("❌ ERREUR pendant la création du journal :", err);
  }
});

// 📦 Commande spéciale pour envoyer le bouton tracker
client.on('messageCreate', async (message) => {
  if (message.content === '!sendtrackerbutton') {
    const ownerId = '278245562191577088';

    if (message.author.id !== ownerId) {
      await message.reply("🛑 Seul le capitaine peut invoquer le bouton du destin !");
      return;
    }

    try {
      await sendMainStartButton(client);
      await message.reply("✅ Bouton du compteur envoyé !");
    } catch (err) {
      console.error("❌ Erreur en envoyant le bouton de compteur :", err);
      await message.reply("❌ Erreur lors de l’envoi du bouton.");
    }
  }
});

// Fonction pour envoyer le message permanent avec le bouton
async function sendMainStartButton(client) {
  console.log('Envoi du message permanent avec le bouton');

  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.get('1370025441930510357'); // Remplace par l'ID de ton salon

  if (!channel) {
    console.log('Le salon est introuvable !');
    throw new Error('Salon introuvable !');
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start_tracker')
      .setLabel('🚀 Démarrer mon compteur')
      .setStyle(ButtonStyle.Success)
  );

  // Envoi du message permanent
  await channel.send({
    content: `🧮 Héros, veux-tu suivre tes loots et tes événements ? Clique ici pour démarrer ton aventure !`,
    components: [row]
  });

  console.log('Message envoyé avec succès.');
}

