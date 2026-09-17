const encode = (value) => encodeURIComponent(String(value || ""));

const withQuery = (base, params) => {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encode(value)}`)
    .join("&");
  return `${base}?${query}`;
};

const prefilled = (id, label, icon, build, { featured = false, category = "social" } = {}) => ({
  id, label, icon, featured, category, requiresCopy: false, build
});

const copyFirst = (id, label, icon, homeUrl, { featured = false, category = "social" } = {}) => ({
  id, label, icon, featured, category, requiresCopy: true, homeUrl,
  build: () => homeUrl
});

export const COMMENT_SHARE_DESTINATIONS = [
  prefilled("whatsapp", "WhatsApp", "WA", ({ text, url }) => withQuery("https://api.whatsapp.com/send", { text: url ? `${text}\n${url}` : text }), { featured: true, category: "messaging" }),
  prefilled("x", "X", "𝕏", ({ text, url }) => withQuery("https://twitter.com/intent/tweet", { text, url }), { featured: true }),
  prefilled("facebook", "Facebook", "f", ({ text, url }) => withQuery("https://www.facebook.com/sharer/sharer.php", { u: url, quote: text }), { featured: true }),
  prefilled("telegram", "Telegram", "TG", ({ text, url }) => withQuery("https://t.me/share/url", { url, text }), { featured: true, category: "messaging" }),
  prefilled("linkedin", "LinkedIn", "in", ({ url }) => withQuery("https://www.linkedin.com/sharing/share-offsite/", { url }), { featured: true, category: "professional" }),
  prefilled("reddit", "Reddit", "r/", ({ text, title, url }) => withQuery("https://www.reddit.com/submit", { url, title: title || text }), { featured: true, category: "community" }),
  prefilled("pinterest", "Pinterest", "P", ({ text, url }) => withQuery("https://www.pinterest.com/pin/create/button/", { url, description: text }), { featured: true }),
  prefilled("tumblr", "Tumblr", "t", ({ text, title, url }) => withQuery("https://www.tumblr.com/widgets/share/tool", { canonicalUrl: url, title, caption: text }), { featured: true }),
  prefilled("line", "LINE", "LINE", ({ text, url }) => withQuery("https://line.me/R/share", { text: url ? `${text}\n${url}` : text }), { category: "messaging" }),
  prefilled("vk", "VK", "VK", ({ text, title, url }) => withQuery("https://vk.com/share.php", { url, title, comment: text }), { category: "regional" }),
  prefilled("weibo", "Weibo", "微", ({ text, title, url }) => withQuery("https://service.weibo.com/share/share.php", { url, title: title ? `${title} ${text}` : text }), { category: "regional" }),
  prefilled("ok", "Odnoklassniki", "OK", ({ text, title, url }) => withQuery("https://connect.ok.ru/offer", { url, title, description: text }), { category: "regional" }),
  prefilled("qzone", "Qzone", "Q", ({ text, title, url }) => withQuery("https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey", { url, title, summary: text }), { category: "regional" }),
  copyFirst("threads", "Threads", "@", "https://www.threads.net/", { category: "social" }),
  prefilled("bluesky", "Bluesky", "BS", ({ text, url }) => withQuery("https://bsky.app/intent/compose", { text: url ? `${text}\n${url}` : text }), { category: "social" }),
  prefilled("mastodon", "Mastodon", "M", ({ text, url }) => withQuery("https://mastodon.social/share", { text: url ? `${text}\n${url}` : text }), { category: "social" }),
  prefilled("hacker-news", "Hacker News", "Y", ({ title, url }) => withQuery("https://news.ycombinator.com/submitlink", { u: url, t: title }), { category: "community" }),
  prefilled("flipboard", "Flipboard", "F", ({ title, url }) => withQuery("https://share.flipboard.com/bookmarklet/popout", { v: "2", title, url }), { category: "community" }),
  prefilled("pocket", "Pocket", "PK", ({ url }) => withQuery("https://getpocket.com/save", { url }), { category: "save" }),
  prefilled("instapaper", "Instapaper", "IP", ({ text, title, url }) => withQuery("https://www.instapaper.com/edit", { url, title, description: text }), { category: "save" }),
  prefilled("evernote", "Evernote", "EN", ({ title, url }) => withQuery("https://www.evernote.com/clip.action", { url, title }), { category: "save" }),
  prefilled("trello", "Trello", "TR", ({ title, url }) => withQuery("https://trello.com/add-card", { url, name: title }), { category: "save" }),
  prefilled("email", "Email", "✉", ({ text, title, url }) => withQuery("mailto:", { subject: title, body: url ? `${text}\n${url}` : text }), { category: "messaging" }),
  prefilled("gmail", "Gmail", "GM", ({ text, title, url }) => withQuery("https://mail.google.com/mail/", { view: "cm", fs: "1", su: title, body: url ? `${text}\n${url}` : text }), { category: "messaging" }),
  prefilled("outlook", "Outlook", "OL", ({ text, title, url }) => withQuery("https://outlook.live.com/mail/0/deeplink/compose", { subject: title, body: url ? `${text}\n${url}` : text }), { category: "messaging" }),
  prefilled("yahoo-mail", "Yahoo Mail", "YM", ({ text, title, url }) => withQuery("https://compose.mail.yahoo.com/", { subject: title, body: url ? `${text}\n${url}` : text }), { category: "messaging" }),
  prefilled("sms", "SMS", "SMS", ({ text, url }) => withQuery("sms:", { body: url ? `${text}\n${url}` : text }), { category: "messaging" }),
  prefilled("skype", "Skype", "SK", ({ text, url }) => withQuery("https://web.skype.com/share", { url, text }), { category: "messaging" }),
  prefilled("blogger", "Blogger", "B", ({ text, title, url }) => withQuery("https://www.blogger.com/blog-this.g", { u: url, n: title, t: text }), { category: "publishing" }),
  prefilled("livejournal", "LiveJournal", "LJ", ({ text, title, url }) => withQuery("https://www.livejournal.com/update.bml", { subject: title, event: `${text}\n${url}` }), { category: "publishing" }),
  prefilled("douban", "Douban", "豆", ({ text, title, url }) => withQuery("https://www.douban.com/share/service", { href: url, name: title, text }), { category: "regional" }),
  prefilled("xing", "XING", "XG", ({ url }) => withQuery("https://www.xing.com/spi/shares/new", { url }), { category: "professional" }),
  copyFirst("threema", "Threema", "TH", "https://threema.ch/en", { category: "messaging" }),
  copyFirst("wordpress", "WordPress", "WP", "https://wordpress.com/", { category: "publishing" }),
  copyFirst("quora", "Quora", "Q", "https://www.quora.com/", { category: "community" }),
  copyFirst("medium", "Medium", "M", "https://medium.com/", { category: "publishing" }),
  copyFirst("substack", "Substack", "SS", "https://substack.com/", { category: "publishing" }),
  copyFirst("instagram", "Instagram", "IG", "https://www.instagram.com/", { category: "social" }),
  copyFirst("tiktok", "TikTok", "TT", "https://www.tiktok.com/", { category: "social" }),
  copyFirst("youtube", "YouTube", "YT", "https://www.youtube.com/", { category: "social" }),
  copyFirst("snapchat", "Snapchat", "SC", "https://www.snapchat.com/", { category: "social" }),
  copyFirst("discord", "Discord", "DS", "https://discord.com/app", { category: "messaging" }),
  copyFirst("wechat", "WeChat", "微", "https://www.wechat.com/", { category: "messaging" }),
  copyFirst("kakao-talk", "KakaoTalk", "KT", "https://www.kakaocorp.com/page/service/service/KakaoTalk", { category: "messaging" }),
  copyFirst("zalo", "Zalo", "ZL", "https://zalo.me/", { category: "messaging" }),
  copyFirst("nostr", "Nostr", "NS", "https://nostr.com/", { category: "social" }),
  copyFirst("lemmy", "Lemmy", "LM", "https://join-lemmy.org/", { category: "community" }),
  copyFirst("pixelfed", "Pixelfed", "PX", "https://pixelfed.social/", { category: "social" }),
  copyFirst("bereal", "BeReal", "BR", "https://bere.al/", { category: "social" }),
  copyFirst("nextdoor", "Nextdoor", "ND", "https://nextdoor.com/", { category: "community" })
];

export const FEATURED_COMMENT_SHARE_IDS = COMMENT_SHARE_DESTINATIONS
  .filter(({ featured }) => featured)
  .map(({ id }) => id);

export function getCommentShareDestinations({ expanded = false } = {}) {
  return expanded
    ? [...COMMENT_SHARE_DESTINATIONS]
    : COMMENT_SHARE_DESTINATIONS.filter(({ featured }) => featured);
}

export function buildCommentShareLink(id, data = {}) {
  const destination = COMMENT_SHARE_DESTINATIONS.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown comment share destination: ${id}`);
  return {
    id: destination.id,
    label: destination.label,
    href: destination.build(data),
    requiresCopy: destination.requiresCopy,
    category: destination.category
  };
}
