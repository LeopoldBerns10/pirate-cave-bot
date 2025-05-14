require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { initTracker } = require('./tracker');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once('ready', () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  initTracker(client);
});

client.login(process.env.DISCORD_TOKEN);
