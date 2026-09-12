'use strict';

/**
 * Simple keyword / section matcher over knowledge_md + shop_md.
 * No external LLM. Returns a short French answer string or null.
 */

function splitSections(md) {
  const text = md || '';
  const parts = text.split(/^#{1,3}\s+/m).filter(Boolean);
  const sections = [];
  for (const part of parts) {
    const lines = part.trim().split('\n');
    const title = (lines[0] || '').trim();
    const body = lines.slice(1).join('\n').trim();
    if (title || body) {
      sections.push({ title, body, full: `${title}\n${body}`.trim() });
    }
  }
  // Also keep whole doc as fallback bag of lines
  return sections;
}

function tokenize(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

const STOP = new Set([
  'les', 'des', 'une', 'pour', 'dans', 'avec', 'sur', 'pas', 'qui', 'que',
  'est', 'sont', 'comment', 'quoi', 'quoi', 'avoir', 'etre', 'fait', 'faire',
  'mon', 'ton', 'son', 'nos', 'vos', 'leurs', 'the', 'and', 'for', 'please',
  'bonjour', 'salut', 'merci', 'hello', 'hey', 'bot', 'aide',
]);

function scoreSection(section, queryTokens) {
  const hay = tokenize(`${section.title} ${section.body}`);
  const haySet = new Set(hay);
  let score = 0;
  for (const t of queryTokens) {
    if (STOP.has(t)) continue;
    if (haySet.has(t)) score += 3;
    else if (hay.some((h) => h.includes(t) || t.includes(h))) score += 1;
  }
  // Bonus if title matches
  const titleTokens = new Set(tokenize(section.title));
  for (const t of queryTokens) {
    if (!STOP.has(t) && titleTokens.has(t)) score += 4;
  }
  return score;
}

function trimAnswer(text, maxLen = 900) {
  const cleaned = text
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + '…';
}

function answerFromKnowledge(query, knowledgeMd, shopMd) {
  const q = (query || '').trim();
  if (!q) return null;

  const queryTokens = tokenize(q).filter((t) => !STOP.has(t));
  if (queryTokens.length === 0) return null;

  const sections = [
    ...splitSections(knowledgeMd).map((s) => ({ ...s, source: 'faq' })),
    ...splitSections(shopMd).map((s) => ({ ...s, source: 'shop' })),
  ];

  if (sections.length === 0) return null;

  // Prefer shop keywords
  const shopHints = ['prix', 'boutique', 'shop', 'vip', 'acheter', 'achat', 'paiement', 'euro', 'pack', 'kit'];
  const wantsShop = queryTokens.some((t) => shopHints.includes(t));

  let best = null;
  let bestScore = 0;
  for (const section of sections) {
    let sc = scoreSection(section, queryTokens);
    if (wantsShop && section.source === 'shop') sc += 2;
    if (!wantsShop && section.source === 'faq') sc += 1;
    if (sc > bestScore) {
      bestScore = sc;
      best = section;
    }
  }

  if (!best || bestScore < 3) return null;

  const header = best.title ? `**${best.title}**\n` : '';
  const body = best.body || best.full;
  return trimAnswer(header + body);
}

module.exports = { answerFromKnowledge, tokenize, splitSections };
