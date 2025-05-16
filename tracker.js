// --- Définition des grades pour attribution de rôle auto
const gradeRoles = [
  { min: 100, name: "🔥 Drop éternel" },
  { min: 90,  name: "🧠 Roi de la caverne" },
  { min: 80,  name: "👑 Héritier du loot" },
  { min: 70,  name: "✨ Bénédiction divine" },
  { min: 60,  name: "👁️ Légende du néant" },
  { min: 50,  name: "🧜‍♂️ Maître des abysses" },
  { min: 40,  name: "🏴‍☠️ Capitaine white drop" },
  { min: 30,  name: "🐙 Terreur des mers" },
  { min: 20,  name: "💰 Chasseur de butin" },
  { min: 10,  name: "⚔️ Corsaire débutant" },
  { min: 0,   name: "🐀 Novice naufragé" }
];

function getGradeRoleName(whiteCount) {
  return gradeRoles.find(g => whiteCount >= g.min).name;
}

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');
const { getUserData, saveUserData } = require('./db'); // <--- Import DB

// Création des boutons personnalisés
function createButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`plus1_${userId}`).setLabel('+1').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`plus5_${userId}`).setLabel('+5').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`white_${userId}`).setLabel('💀 White Drop').setStyle(ButtonStyle.Danger)
  );
}

function getWhiteGrade(whiteCount) {
  const grades = [
    { min: 0, title: "Novice naufragé", emoji: "🐀" },
    { min: 10, title: "Corsaire débutant", emoji: "⚔️" },
    { min: 20, title: "Chasseur de butin", emoji: "💰" },
    { min: 30, title: "Terreur des mers", emoji: "🐙" },
    { min: 40, title: "Capitaine white drop", emoji: "🏴‍☠️" },
    { min: 50, title: "Maître des abysses", emoji: "🧜‍♂️" },
    { min: 60, title: "Légende du néant", emoji: "👁️" },
    { min: 70, title: "Bénédiction divine", emoji: "✨" },
    { min: 80, title: "Héritier du loot", emoji: "👑" },
    { min: 90, title: "Roi de la caverne", emoji: "🧠" },
    { min: 100, title: "Drop éternel", emoji: "🔥" }
  ];
  return grades.slice().reverse().find(g => whiteCount >= g.min) || grades[0];
}

function getEmbed(userId, username, data) {
  const count = data?.count || 0;
  const whites = data?.whites || [];
  const positions = data?.positions || [];
  const whiteCount = whites.length;

  const grade = getWhiteGrade(whiteCount);
  const ratio = count > 0 ? ((whiteCount / count) * 100).toFixed(2) : "0";
  const estimation = whiteCount > 0 ? (count / whiteCount).toFixed(2) : "∞";
  const dropLines = whites.length
    ? whites.map((w, i) => `${positions[i]} : ${w}`).join('\n')
    : "_Aucun pour l'instant_";

  return new EmbedBuilder()
    .setTitle(`${grade.emoji} ${grade.title} — Tableau de ${username || `<@${userId}>`}`)
    .setDescription(
      `**🎯 Total events :** \`${count}\`\n` +
      `**✨ White drops :** \`${whiteCount}\`\n` +
      `**📊 Ratio :** \`${ratio}%\`\n` +
      `**🧪 Estimation :** \`1 white / ~${estimation} events\`\n\n` +
      `__White drops :__\n${dropLines}\n\n` +
      `*${grade.title === "Drop éternel" ? "🔥 Tu es une légende vivante du loot !" : "Continue de farmer, la mer t’observe..."}*`
    )
    .setColor(0x0099ff);
}

// Initialisation unique du tracker
let trackerInitialized = false;
function initTracker(client) {
  if (trackerInitialized) return;
  trackerInitialized = true;

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    const [action, targetUserId] = interaction.customId.split('_');
    if (!['plus1', 'plus5', 'white'].includes(action)) return;

    if (interaction.user.id !== targetUserId) {
      await interaction.reply({ content: '❌ Pas ton compteur, matelot !', flags: 64 });
      return;
    }

    // --- DB : chargement des données utilisateur
    let data = await getUserData(targetUserId);
    if (!data) data = { count: 0, whites: [], positions: [] };

    if (action === 'plus1') data.count += 1;
    else if (action === 'plus5') data.count += 5;
    else if (action === 'white') {
  // 1. Le bot pose la question et stocke le message pour suppression
  const questionMsg = await interaction.reply({ 
    content: '⚓ Quel est le nom de ce white bag ? (réponds juste en-dessous — tout sera supprimé dans 15 secondes après validation !) 🧹', 
    fetchReply: true, // Pour récupérer l'ID du message bot
    flags: 64 
  });

  // 2. Prépare le collector pour UNE réponse
  const filter = m => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 15000 });

collector.on('collect', async msg => {
  // 1. Mise à jour DB et tableau
  data.whites.push(msg.content);
  data.positions.push(data.count);
  await saveUserData(targetUserId, interaction.user.username, data.count, data.whites, data.positions);

  // --- Attribution automatique du rôle pirate selon le nombre de whites
  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const allRoleNames = gradeRoles.map(g => g.name);
    const gradeRoleName = getGradeRoleName(data.whites.length);

    // Cherche tous les rôles pirates existants
    const pirateRoles = guild.roles.cache.filter(r => allRoleNames.includes(r.name));

    // === LOGS DEBUG COMPLETS ===
    console.log("------ [DEBUG PROMOTION PIRATE] ------");
    console.log("Utilisateur :", interaction.user.username, "| ID :", interaction.user.id);
    console.log("Nombre de white drops :", data.whites.length);
    console.log("Grade cible :", gradeRoleName);
    console.log("Rôles pirates existants :", pirateRoles.map(r => r.name));
    console.log("Rôles possédés actuellement :", member.roles.cache.map(r => r.name));
    // ===========================

    // Supprime tous les anciens rôles pirates du membre
    const toRemove = member.roles.cache.filter(r => allRoleNames.includes(r.name));
    if (toRemove.size > 0) {
      await member.roles.remove(toRemove);
      console.log("Rôles supprimés du membre :", toRemove.map(r => r.name));
    }

    // Attribue le nouveau rôle si trouvé
    const newRole = pirateRoles.find(r => r.name === gradeRoleName);
    if (newRole) {
      await member.roles.add(newRole);
      console.log("✅ Attribution du rôle :", newRole.name);
      await msg.reply(`🏴‍☠️ **Nouveau grade obtenu** : ${gradeRoleName} !`);
    } else {
      console.log("❌ Le rôle cible n'a pas été trouvé sur le serveur !");
      await msg.reply(`⚓ Le rôle "${gradeRoleName}" n'a pas été trouvé sur le serveur (contacte un admin).`);
    }
  } catch (err) {
    console.error("Erreur attribution rôle pirate :", err);
    await msg.reply("⚠️ Impossible de mettre à jour ton grade, permissions manquantes ou autre souci.");
  }

  // 3. Confirmation du bot et stockage pour suppression
  const confirmMsg = await msg.reply('💀 White enregistré avec succès ! (tous ces messages disparaîtront dans 15 secondes ⏳)');
  // 4. MAJ du tableau embed
  interaction.message.edit({ embeds: [getEmbed(targetUserId, interaction.user.username, data)], components: [createButtons(targetUserId)] });

  // 5. Suppression clean de toute l’interaction après 15 secondes
  setTimeout(async () => {
    try { await questionMsg.delete(); } catch (e) {}
    try { await msg.delete(); } catch (e) {}
    try { 
      // Supprime tous les messages envoyés par le bot en réponse à ce drop (upgrade de grade, white enregistré, etc.)
      const fetched = await msg.channel.messages.fetch({ after: msg.id, limit: 5 });
      fetched.forEach(m => { if (m.author.id === interaction.client.user.id) m.delete().catch(()=>{}); });
    } catch (e) {}
  }, 15000);
});


  collector.on('end', collected => {
    if (!collected.size) interaction.followUp({ content: '⏰ Temps écoulé !', flags: 64 });
  });
  return;
}


    await saveUserData(targetUserId, interaction.user.username, data.count, data.whites, data.positions);

    await interaction.update({
      embeds: [getEmbed(targetUserId, interaction.user.username, data)],
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

    let data = await getUserData(userId);
    if (!data) {
      data = { count: 0, whites: [], positions: [] };
      await saveUserData(userId, username, data.count, data.whites, data.positions);
    }

    await interaction.reply({ content: `🧾 Ton compteur est prêt, ${username} !`, flags: 64 });
    await channel.send({ embeds: [getEmbed(userId, username, data)], components: [createButtons(userId)] });
  });
}

module.exports = { initTracker, sendMainStartButton };
