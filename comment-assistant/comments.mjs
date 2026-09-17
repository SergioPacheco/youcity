import { COMMENT_TEMPLATES } from "../data/comment-templates.mjs";

const LANGUAGE_LABELS = { en: "English", es: "Spanish", pt: "Portuguese" };

function cityLabel(context) {
  return context.city || "this city";
}

function areaLabel(context) {
  return context.area || cityLabel(context);
}

function modeSentences(context) {
  const city = cityLabel(context);
  const area = areaLabel(context);
  const templates = COMMENT_TEMPLATES.modes[context.videoType] || COMMENT_TEMPLATES.modes.walk;
  return templates.map((template) => template.replaceAll("{city}", city).replaceAll("{area}", area));
}

function translatedSentences(context) {
  const city = cityLabel(context);
  const area = areaLabel(context);
  if (context.language === "es") {
    return COMMENT_TEMPLATES.translations.es.map((template) => template.replaceAll("{city}", city).replaceAll("{area}", area));
  }
  if (context.language === "pt") {
    return COMMENT_TEMPLATES.translations.pt.map((template) => template.replaceAll("{city}", city).replaceAll("{area}", area));
  }
  return modeSentences(context);
}

function toneAdjust(sentences, tone) {
  if (tone === "short") return sentences.map((sentence) => sentence.replace(/\.$/, ""));
  if (COMMENT_TEMPLATES.toneSuffixes[tone]) return sentences.map((sentence) => `${sentence}${COMMENT_TEMPLATES.toneSuffixes[tone]}`);
  return sentences;
}

function ctaSentence(context) {
  const city = cityLabel(context);
  const url = context.youCityUrl;
  if (context.cta === "plan-trip") return COMMENT_TEMPLATES.cta.planTrip.replace("{city}", city).replace("{url}", url ? `: ${url}` : ".");
  if (context.cta === "city-link") return url
    ? COMMENT_TEMPLATES.cta.cityLink.replace("{city}", city).replace("{url}", url)
    : `You can explore ${city} on YouCity before travelling.`;
  if (context.cta === "mention") return COMMENT_TEMPLATES.cta.mention.replace("{city}", city);
  if (context.includeCityUrl && url) return COMMENT_TEMPLATES.cta.cityUrl.replace("{city}", city).replace("{url}", url);
  if (context.mentionYouCity) return COMMENT_TEMPLATES.cta.cityMention.replace("{city}", city);
  return "";
}

function rotate(items, offset) {
  const amount = ((offset % items.length) + items.length) % items.length;
  return items.map((_, index) => items[(index + amount) % items.length]);
}

function generateStandardComments(context, variant = 0) {
  const language = LANGUAGE_LABELS[context.language] ? context.language : "en";
  const sentences = toneAdjust(translatedSentences({ ...context, language }), context.tone);
  const cta = ctaSentence(context);
  const comments = rotate(sentences, variant).map((sentence) => `${sentence}${cta ? ` ${cta}` : ""}`.trim());
  return [...new Set(comments)].slice(0, 3);
}

export { generateStandardComments };
