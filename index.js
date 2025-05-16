require('dotenv').config();

const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const { initTracker, sendMainStartButton } = require('./tracker');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const MESSAGE_ID = process.env.MESSAGE_ID;

// Création du client Discord
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

client.once('ready', async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  console.log("🔧 En attente d'une réaction 📜 sur le message ID :", MESSAGE_ID);

  client.guilds.cache.forEach(guild => {
    console.log(`➡️ Serveur : ${guild.name} (ID: ${guild.id})`);
  });

  // 1. Initialise le système de compteur personnalisé
  initTracker(client);

  // 2. Envoie automatiquement le bouton de démarrage dans le canal voulu (si besoin)
  try {
    await sendMainStartButton(client);
    console.log("✅ Message principal du tracker envoyé !");
  } catch (e) {
    console.error("⚠️ Impossible d'envoyer le bouton principal :", e.message);
  }
});

// Création du journal de bord sur réaction
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
      },
      // Tes IDs spéciaux restent, c'est propre
      {
        id: '1355909769776337177',
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions]
      },
      {
        id: '1355909983572856952',
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions]
      },
      {
        id: '1355917623778480269',
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.AddReactions],
        deny: [PermissionsBitField.Flags.SendMessages]
      },
      {
        id: '1355918648782360617',
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.AddReactions],
        deny: [PermissionsBitField.Flags.SendMessages]
      },
      {
        id: '1355919088844538038',
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.AddReactions],
        deny: [PermissionsBitField.Flags.SendMessages]
      }
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: 0,
      parent: category.id,
      permissionOverwrites: overwrites
    });

    const msg = await channel.send({
      content: `🏴‍☠️ **Bienvenue dans ta cale personnelle, matelot <@${member.id}> !**

T’as hérité de ta propre coque. Tu peux t’y étaler comme un Kraken sur son trône.  
C’est chez toi ici. **Pas de règles. Pas de limites.** Tu fais ce que tu veux… sauf couler 😏

🪙 Ce journal, c’est ton histoire. Tes loots. Tes légendes. Tes erreurs aussi.  
Et qui sait ? Peut-être que les regards curieux de la guilde passeront par la fenêtre ouverte…

---

⚓ **Fixe-toi un objectif, un vrai.**

> ⚔️ Vaincre O3 en solo  
> 💥 Réussir un Shatters HM les yeux fermés  
> 🎯 Atteindre le White Star  
> 🐉 Avoir le pet le plus massif de tout le navire  
> 🏴‍☠️ Ou juste impressionner les autres avec ton style de jeu unique

Quoi que tu choisisses...  
**Fais-le bien. Fais-le grand. Fais-le Pirate Cave.**

— 🦜 *Le scribe automatique, plume trempée dans le rhum*`
    });

    await msg.pin();
    console.log(`✅ Salon ${channelName} créé avec succès.`);

  } catch (err) {
    console.error("❌ ERREUR pendant la création du journal :", err);
  }
});

// Commande spéciale pour renvoyer le bouton tracker à la main (optionnel)
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

// 🚀 Connexion à Discord
client.login(TOKEN);
