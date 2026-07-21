// Builds tappable "Ice Breakers" suggestions from a matched user's own
// profile content (prompts answered during onboarding, tagged interests).
// Deliberately profile-based only, not live-conversation-based. Rule-based
// phrasing and categorization — no AI call.

const MAX_STARTERS = 3;
const MAX_QUOTE_LENGTH = 42;

// Keyword -> icon categories, checked in order. Keep this list short; add a
// new { id, icon, keywords } entry to cover a common topic that keeps
// landing in the fallback bucket.
export const STARTER_CATEGORIES = [
  { id: 'tv', icon: '📺', keywords: ['tv', 'show', 'shows', 'movie', 'movies', 'film', 'films', 'series', 'netflix', 'binge', 'watch', 'watching'] },
  { id: 'sleep', icon: '🌙', keywords: ['sleep', 'sleeping', 'nap', 'napping', 'rest', 'resting', 'relax', 'relaxing', 'bed', 'lounge', 'lounging', 'chill', 'chilling'] },
  { id: 'music', icon: '🎵', keywords: ['music', 'song', 'songs', 'band', 'concert', 'playlist', 'listen', 'listening', 'guitar', 'piano', 'sing', 'singing'] },
  { id: 'food', icon: '🍳', keywords: ['food', 'cook', 'cooking', 'bake', 'baking', 'recipe', 'restaurant', 'eating', 'foodie', 'coffee', 'brunch', 'dinner', 'kitchen'] },
  { id: 'outdoors', icon: '🌿', keywords: ['hike', 'hiking', 'outdoors', 'nature', 'camping', 'trail', 'park', 'beach', 'mountain', 'garden', 'gardening', 'walk', 'walking'] },
  { id: 'reading', icon: '📚', keywords: ['book', 'books', 'reading', 'read', 'novel', 'author', 'library'] },
];
const FALLBACK_CATEGORY = { id: 'general', icon: '💬' };

function categorize(sourceText) {
  const lower = (sourceText || '').toLowerCase();
  for (const category of STARTER_CATEGORIES) {
    if (category.keywords.some((kw) => lower.includes(kw))) return category;
  }
  return FALLBACK_CATEGORY;
}

function truncate(text, max) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  // Only break on the word boundary if it doesn't throw away most of the
  // budget (e.g. one long leading word) — otherwise fall back to a hard cut.
  const safeCut = lastSpace > max * 0.4 ? cut.slice(0, lastSpace) : cut;
  return `${safeCut.trimEnd()}…`;
}

// Turns a raw prompt answer (often a full sentence) into a short, natural
// quote suitable for a bubble — not a summary (no AI), just clause-trimming:
// drop trailing punctuation, cut at the first strong clause boundary so a
// multi-part answer doesn't become a run-on, then hard-truncate as a backstop.
function extractExcerpt(rawText, maxLen) {
  let text = (rawText || '').trim();
  if (!text) return '';
  text = text.replace(/[.!?]+$/, '');
  const boundary = text.search(/[.!?;]|,\s|\s(?:but|because|while|so|though|when|although)\s/i);
  if (boundary > 0) text = text.slice(0, boundary);
  text = text.replace(/^(a|an|the|some)\s+/i, '').trim();
  if (!text) return '';
  text = text.charAt(0).toLowerCase() + text.slice(1);
  return truncate(text, maxLen);
}

// The text that actually gets dropped into the compose box. Deliberately a
// single, simple, safe template — "into <phrase>" reads naturally after
// almost any short noun/gerund phrase, unlike a per-category set of
// templates that risks producing something grammatically awkward for
// whatever phrase shape a given profile answer happens to produce.
function buildLeadIn(quote) {
  return `Saw you're into ${quote} — `;
}

function promptToStarter(prompt, index) {
  const rawAnswer = (prompt.prompt_answer ?? prompt.answer ?? '').trim();
  if (!rawAnswer) return null;
  const quote = extractExcerpt(rawAnswer, MAX_QUOTE_LENGTH);
  if (!quote) return null;
  const category = categorize(rawAnswer);
  return {
    id: `prompt-${prompt.prompt_question ?? index}`,
    quote,
    icon: category.icon,
    category: category.id,
    composeText: buildLeadIn(quote),
  };
}

function interestToStarter(interest) {
  const quote = truncate(interest.trim(), MAX_QUOTE_LENGTH);
  const category = categorize(interest);
  return {
    id: `interest-${interest}`,
    quote,
    icon: category.icon,
    category: category.id,
    composeText: buildLeadIn(quote),
  };
}

// prompts: [{ prompt_question, prompt_answer | answer }], in display order
// interests: [string]
export function buildConversationStarters(prompts = [], interests = []) {
  const starters = [];

  for (const prompt of prompts) {
    if (starters.length >= MAX_STARTERS) break;
    const starter = promptToStarter(prompt, starters.length);
    if (starter) starters.push(starter);
  }

  if (starters.length < MAX_STARTERS) {
    for (const interest of interests) {
      if (starters.length >= MAX_STARTERS) break;
      if (!interest) continue;
      starters.push(interestToStarter(interest));
    }
  }

  return starters;
}
