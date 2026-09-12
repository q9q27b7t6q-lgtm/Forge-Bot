'use strict';

require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require('discord.js');
const { getTenantByGuildId } = require('../db');
const { answerFromKnowledge } = require('./matcher');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PREFIX = process.env.BOT_PREFIX || '!';

if (!TOKEN) {
  console.error(
    '[ForgeBot Bot] DISCORD_BOT_TOKEN manquant dans .env — arrêt.'
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

function extractQuery(message, clientUser) {
  const content = message.content.trim();
  const mention = `<@${clientUser.id}>`;
  const mentionNick = `<@!${clientUser.id}>`;

  if (content.startsWith(mention) || content.startsWith(mentionNick)) {
    return content
      .replace(mention, '')
      .replace(mentionNick, '')
      .trim();
  }
  if (content.startsWith(PREFIX)) {
    // !faq ..., !shop ..., or !ask ...
    const rest = content.slice(PREFIX.length).trim();
    const m = rest.match(/^(faq|shop|ask|aide|help)\s+(.+)/i);
    if (m) return m[2].trim();
    // bare !question
    if (rest.length >= 3) return rest;
  }
  return null;
}

client.once(Events.ClientReady, (c) => {
  console.log(`[ForgeBot Bot] Connecté en tant que ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const query = extractQuery(message, client.user);
    if (query == null) return;

    const tenant = getTenantByGuildId(message.guild.id);
    if (!tenant) {
      // Unknown guild: short message once if mentioned, else ignore
      if (message.mentions.has(client.user)) {
        await message.reply({
          content:
            'Ce serveur n’est pas encore configuré sur ForgeBot. Le propriétaire doit créer un tenant sur le tableau de bord.',
          allowedMentions: { repliedUser: false },
        });
      }
      return;
    }

    if (!query) {
      await message.reply({
        content:
          `Bonjour ! Posez une question après la mention, ou utilisez \`${PREFIX}faq …\` / \`${PREFIX}shop …\`.`,
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    const answer = answerFromKnowledge(
      query,
      tenant.knowledge_md,
      tenant.shop_md
    );

    if (answer) {
      await message.reply({
        content: answer.slice(0, 1900),
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    let staffHint = 'le staff';
    if (tenant.staff_role_ids) {
      const roles = tenant.staff_role_ids
        .split(',')
        .filter(Boolean)
        .map((id) => `<@&${id}>`)
        .join(' ');
      if (roles) staffHint = roles;
    }

    await message.reply({
      content: `Je n’ai pas trouvé de réponse dans la FAQ / boutique. Contactez ${staffHint} pour plus d’aide.`,
      allowedMentions: { repliedUser: false, roles: [] },
    });
  } catch (err) {
    console.error('[ForgeBot Bot] Erreur message:', err.message);
  }
});

client.login(TOKEN).catch((err) => {
  console.error('[ForgeBot Bot] Connexion impossible:', err.message);
  process.exit(1);
});
