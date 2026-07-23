const fs = require('fs');
const path = require('path');

const trCommon = {
  "webTitle": "KaymakTV — İzlediklerinin kaymağını çıkar",
  "webDesc": "KaymakTV, sinema ve dizi tutkunları için kişisel izleme günlüğü, takip ve keşif platformudur.",
  "features": "Özellikler",
  "statistics": "İstatistikler",
  "exploreAsGuest": "Misafir Olarak İncele",
  "diaryEyebrow": "Sinema & dizi günlüğün",
  "heroTitle1": "İzlediklerinin",
  "heroTitle2": "kaymağını",
  "heroTitle3": " çıkar.",
  "heroSubtitle": "Her filmi, her diziyi kaydet. Puanla, yorumla, tartış. KaymakTV; dağınık izleme alışkanlığını tek bir yerde toplayan, sana ait bir sinema günlüğü.",
  "howItWorks": "Nasıl Çalışır?",
  "oneApp": "Bir uygulama, bütün izleme hayatın.",
  "viewingDiary": "İzleme Günlüğü",
  "viewingDiaryDesc": "Bir filmi bitirir bitirmez kaydet. Hangi tarihte, hangi platformda izlediğin — hepsi profilinde, kronolojik bir arşivde birikir.",
  "fastSearch": "Film, dizi, bölüm, oyuncu, yönetmen — aradığın her şey saniyeler içinde karşında.",
  "director": "Yönetmen",
  "actor": "Oyuncu",
  "episode": "Bölüm",
  "genre": "Tür",
  "statsPanel": "İstatistik Paneli",
  "statsPanelDesc": "Toplam izleme süren, favori türün, en çok izlediğin yönetmen — sayılarla önünde.",
  "ratingReview": "Puanlama & İnceleme",
  "ratingReviewDesc": "Puanla, düşüncelerini yaz. Spoiler'lı ya da spoiler'sız — seçim tamamen sana ait.",
  "personalLists": "Kişisel Listeler",
  "personalListsDesc": "Kendi koleksiyonlarını oluştur, diğer kullanıcılarla paylaş.",
  "weekendWatchlist": "Hafta Sonu İzleyeceklerim",
  "socialFeed": "Zevkine güvendiğin kişileri takip et, onların neler izlediğini akışında gör — bir sonraki filmine karar vermek hiç bu kadar kolay olmamıştı.",
  "dataVis": "Kişisel veri görselleştirme",
  "endOfYear": "Yıl sonunda seni sayılar şaşırtsın.",
  "screenTime": "Ekranda geçirdiğin zamanı görünce gülümseyeceksin — ya da biraz şaşıracaksın.",
  "summary2026": "2026 İzleme Özeti",
  "sampleProfile": "Örnek profil · Deniz K.",
  "other": "Diğer",
  "trendingNow": "Neler İzleniyor?",
  "trendingNowDesc": "Şu an tüm dünyada en çok izlenen popüler dizi ve filmleri keşfet.",
  "startToday1": "Bugün başla,",
  "startToday2": "ilk filmini kaydet.",
  "digitalDiary": "Sinema ve dizi tutkunları için dijital izleme günlüğü. İzlediklerinin kaymağını çıkar.",
  "product": "Ürün",
  "company": "Şirket",
  "justNow": "Şimdi",
  "minutesAgo": "dakika önce",
  "hoursAgo": "saat önce",
  "daysAgo": "gün önce",
  "weeksAgo": "hafta önce",
  "monthsAgo": "ay önce",
  "yearsAgo": "yıl önce",
  "containsSpoilers": "Spoiler İçeriyor",
  "tapToView": "Görmek için dokun",
  "replyError": "Cevap gönderilirken bir hata oluştu.",
  "loginToReply": "Cevap yazmak için giriş yapın.",
  "loadingComments": "Yorumlar yükleniyor...",
  "noCommentsYet": "Henüz yorum yok",
  "firstCommentPrompt": "Bu içerik için ilk yorumu sen yapabilirsin.",
  "guestAccess": "Misafir Erişimi",
  "guestAccessDesc": "Kendi listenizi oluşturmak, dizileri takip etmek ve kişisel takviminize erişmek için aramıza katılın!",
  "signupLogin": "Kayıt Ol / Giriş Yap",
  "items": "öğe",
  "loginToComment": "Yorum yapmak için giriş yapın"
};

const enCommon = {
  "webTitle": "KaymakTV — Extract the best of what you watch",
  "webDesc": "KaymakTV is a personal viewing diary, tracking, and discovery platform for movie and TV enthusiasts.",
  "features": "Features",
  "statistics": "Statistics",
  "exploreAsGuest": "Explore as Guest",
  "diaryEyebrow": "Your movie & TV diary",
  "heroTitle1": "Extract the",
  "heroTitle2": "best",
  "heroTitle3": " of what you watch.",
  "heroSubtitle": "Log every movie and show. Rate, review, and discuss. KaymakTV is your personal cinema diary that organizes your scattered viewing habits.",
  "howItWorks": "How it works?",
  "oneApp": "One app, your entire viewing life.",
  "viewingDiary": "Viewing Diary",
  "viewingDiaryDesc": "Log a movie as soon as you finish it. The date, the platform you watched it on — everything accumulates in a chronological archive on your profile.",
  "fastSearch": "Movies, shows, episodes, actors, directors — everything you're looking for is seconds away.",
  "director": "Director",
  "actor": "Actor",
  "episode": "Episode",
  "genre": "Genre",
  "statsPanel": "Statistics Panel",
  "statsPanelDesc": "Your total watch time, favorite genre, most watched director — all presented in numbers.",
  "ratingReview": "Rating & Review",
  "ratingReviewDesc": "Rate and write your thoughts. With or without spoilers — the choice is completely yours.",
  "personalLists": "Personal Lists",
  "personalListsDesc": "Create your own collections and share them with other users.",
  "weekendWatchlist": "Weekend Watchlist",
  "socialFeed": "Follow people whose taste you trust, see what they're watching in your feed — deciding on your next movie has never been easier.",
  "dataVis": "Personal data visualization",
  "endOfYear": "Let the numbers surprise you at the end of the year.",
  "screenTime": "You'll smile when you see the time you've spent on screen — or perhaps you'll be a little surprised.",
  "summary2026": "2026 Watching Summary",
  "sampleProfile": "Sample profile · Deniz K.",
  "other": "Other",
  "trendingNow": "What's Trending?",
  "trendingNowDesc": "Discover the most watched popular shows and movies around the world right now.",
  "startToday1": "Start today,",
  "startToday2": "log your first movie.",
  "digitalDiary": "A digital viewing diary for movie and TV enthusiasts. Extract the best of what you watch.",
  "product": "Product",
  "company": "Company",
  "justNow": "Just now",
  "minutesAgo": "minutes ago",
  "hoursAgo": "hours ago",
  "daysAgo": "days ago",
  "weeksAgo": "weeks ago",
  "monthsAgo": "months ago",
  "yearsAgo": "years ago",
  "containsSpoilers": "Contains Spoilers",
  "tapToView": "Tap to view",
  "replyError": "An error occurred while posting the reply.",
  "loginToReply": "Log in to post a reply.",
  "loadingComments": "Loading comments...",
  "noCommentsYet": "No comments yet",
  "firstCommentPrompt": "You can be the first to comment on this content.",
  "guestAccess": "Guest Access",
  "guestAccessDesc": "Join us to create your own list, track shows, and access your personal calendar!",
  "signupLogin": "Sign Up / Log In",
  "items": "items",
  "loginToComment": "Log in to comment"
};

function read(file) { return fs.readFileSync(path.resolve(file), 'utf8'); }
function write(file, data) { fs.writeFileSync(path.resolve(file), data, 'utf8'); }

function injectTranslationImport(content, ns) {
  if (!content.includes('useTranslation')) {
    content = content.replace(/(import React.*?from 'react';)/, `$1\nimport { useTranslation } from 'react-i18next';`);
  }
  // Inject const { t } = useTranslation() if not exists
  if (!content.includes('const { t }')) {
    content = content.replace(/(export default function [A-Za-z0-9_]+\(.*?\)\s*\{)/s, `$1\n  const { t } = useTranslation('${ns}');`);
  }
  return content;
}

// 1. INDEX.WEB.TSX
let indexWeb = read('app/(public)/index.web.tsx');
indexWeb = injectTranslationImport(indexWeb, 'common');
indexWeb = indexWeb.replace(/<title>KaymakTV — İzlediklerinin kaymağını çıkar<\/title>/g, `<title>{t('webTitle')}</title>`);
indexWeb = indexWeb.replace(/content="KaymakTV, sinema ve dizi tutkunları için kişisel izleme günlüğü, takip ve keşif platformudur\."/g, `content={t('webDesc')}`);
indexWeb = indexWeb.replace(/content="KaymakTV — İzlediklerinin kaymağını çıkar"/g, `content={t('webTitle')}`);
indexWeb = indexWeb.replace(/>Özellikler<\/a>/g, `>{t('features')}</a>`);
indexWeb = indexWeb.replace(/>İstatistikler<\/a>/g, `>{t('statistics')}</a>`);
indexWeb = indexWeb.replace(/>Misafir Olarak İncele<\/a>/g, `>{t('exploreAsGuest')}</a>`);
indexWeb = indexWeb.replace(/>Sinema & dizi günlüğün<\/span>/g, `>{t('diaryEyebrow')}</span>`);
indexWeb = indexWeb.replace(/İzlediklerinin<br\/><em>kaymağını<\/em> çıkar\./g, `{t('heroTitle1')}<br/><em>{t('heroTitle2')}</em>{t('heroTitle3')}`);
indexWeb = indexWeb.replace(/>Her filmi, her diziyi kaydet\. Puanla, yorumla, tartış\. KaymakTV; dağınık izleme alışkanlığını tek bir yerde toplayan, sana ait bir sinema günlüğü\.</g, `>{t('heroSubtitle')}<`);
indexWeb = indexWeb.replace(/>Nasıl Çalışır\?<\/a>/g, `>{t('howItWorks')}</a>`);
indexWeb = indexWeb.replace(/>Bir uygulama, bütün izleme hayatın\.</g, `>{t('oneApp')}<`);
indexWeb = indexWeb.replace(/>İzleme Günlüğü<\/h3>/g, `>{t('viewingDiary')}</h3>`);
indexWeb = indexWeb.replace(/>Bir filmi bitirir bitirmez kaydet\. Hangi tarihte, hangi platformda izlediğin — hepsi profilinde, kronolojik bir arşivde birikir\.</g, `>{t('viewingDiaryDesc')}<`);
indexWeb = indexWeb.replace(/>Film, dizi, bölüm, oyuncu, yönetmen — aradığın her şey saniyeler içinde karşında\.</g, `>{t('fastSearch')}<`);
indexWeb = indexWeb.replace(/>Yönetmen<\/span>/g, `>{t('director')}</span>`);
indexWeb = indexWeb.replace(/>Oyuncu<\/span>/g, `>{t('actor')}</span>`);
indexWeb = indexWeb.replace(/>Bölüm<\/span><span/g, `>{t('episode')}</span><span`);
indexWeb = indexWeb.replace(/>Bölüm<\/div>/g, `>{t('episode')}</div>`);
indexWeb = indexWeb.replace(/>Tür<\/span>/g, `>{t('genre')}</span>`);
indexWeb = indexWeb.replace(/>İstatistik Paneli<\/h3>/g, `>{t('statsPanel')}</h3>`);
indexWeb = indexWeb.replace(/>Toplam izleme süren, favori türün, en çok izlediğin yönetmen — sayılarla önünde\.</g, `>{t('statsPanelDesc')}<`);
indexWeb = indexWeb.replace(/>Puanlama & İnceleme<\/h3>/g, `>{t('ratingReview')}</h3>`);
indexWeb = indexWeb.replace(/>Puanla, düşüncelerini yaz\. Spoiler'lı ya da spoiler'sız — seçim tamamen sana ait\.</g, `>{t('ratingReviewDesc')}<`);
indexWeb = indexWeb.replace(/>Kişisel Listeler<\/h3>/g, `>{t('personalLists')}</h3>`);
indexWeb = indexWeb.replace(/>Kendi koleksiyonlarını oluştur, diğer kullanıcılarla paylaş\.</g, `>{t('personalListsDesc')}<`);
indexWeb = indexWeb.replace(/>Hafta Sonu İzleyeceklerim<\/div>/g, `>{t('weekendWatchlist')}</div>`);
indexWeb = indexWeb.replace(/>Zevkine güvendiğin kişileri takip et, onların neler izlediğini akışında gör — bir sonraki filmine karar vermek hiç bu kadar kolay olmamıştı\.</g, `>{t('socialFeed')}<`);
indexWeb = indexWeb.replace(/>Kişisel veri görselleştirme<\/span>/g, `>{t('dataVis')}</span>`);
indexWeb = indexWeb.replace(/>Yıl sonunda seni sayılar şaşırtsın\.</g, `>{t('endOfYear')}<`);
indexWeb = indexWeb.replace(/>Ekranda geçirdiğin zamanı görünce gülümseyeceksin — ya da biraz şaşıracaksın\.</g, `>{t('screenTime')}<`);
indexWeb = indexWeb.replace(/>2026 İzleme Özeti<\/h4>/g, `>{t('summary2026')}</h4>`);
indexWeb = indexWeb.replace(/>Örnek profil · Deniz K\.<\/span>/g, `>{t('sampleProfile')}</span>`);
indexWeb = indexWeb.replace(/>Diğer<\/span>/g, `>{t('other')}</span>`);
indexWeb = indexWeb.replace(/>Neler İzleniyor\?<\/h2>/g, `>{t('trendingNow')}</h2>`);
indexWeb = indexWeb.replace(/>Şu an tüm dünyada en çok izlenen popüler dizi ve filmleri keşfet\.</g, `>{t('trendingNowDesc')}<`);
indexWeb = indexWeb.replace(/Bugün başla,<br\/>ilk filmini kaydet\./g, `{t('startToday1')}<br/>{t('startToday2')}`);
indexWeb = indexWeb.replace(/>Sinema ve dizi tutkunları için dijital izleme günlüğü\. İzlediklerinin kaymağını çıkar\.</g, `>{t('digitalDiary')}<`);
indexWeb = indexWeb.replace(/>Ürün<\/h5>/g, `>{t('product')}</h5>`);
indexWeb = indexWeb.replace(/>Şirket<\/h5>/g, `>{t('company')}</h5>`);
write('app/(public)/index.web.tsx', indexWeb);

// 2. COMMENT ITEM
let commentItem = read('components/comments/CommentItem.tsx');
commentItem = injectTranslationImport(commentItem, 'common');
commentItem = commentItem.replace(/'Şimdi'/g, `t('justNow')`);
commentItem = commentItem.replace(/ dakika önce/g, ` \${t('minutesAgo')}`);
commentItem = commentItem.replace(/ saat önce/g, ` \${t('hoursAgo')}`);
commentItem = commentItem.replace(/ gün önce/g, ` \${t('daysAgo')}`);
commentItem = commentItem.replace(/ hafta önce/g, ` \${t('weeksAgo')}`);
commentItem = commentItem.replace(/ ay önce/g, ` \${t('monthsAgo')}`);
commentItem = commentItem.replace(/ yıl önce/g, ` \${t('yearsAgo')}`);
commentItem = commentItem.replace(/>Spoiler İçeriyor<\/Text>/g, `>{t('containsSpoilers')}</Text>`);
commentItem = commentItem.replace(/>Görmek için dokun<\/Text>/g, `>{t('tapToView')}</Text>`);
// Check if timeAgo helper exists outside component and t isn't in scope.
if (commentItem.includes('function timeAgo(')) {
  // Pass t to timeAgo
  commentItem = commentItem.replace(/function timeAgo\(dateString: string\)/g, `function timeAgo(dateString: string, t: any)`);
  commentItem = commentItem.replace(/timeAgo\(c\.created_at\)/g, `timeAgo(c.created_at, t)`);
}
write('components/comments/CommentItem.tsx', commentItem);

// 3. COMMENT REPLIES
let commentReplies = read('components/comments/CommentReplies.tsx');
commentReplies = injectTranslationImport(commentReplies, 'common');
commentReplies = commentReplies.replace(/'Cevap gönderilirken bir hata oluştu\.'/g, `t('replyError')`);
commentReplies = commentReplies.replace(/>Cevap yazmak için giriş yapın\.</g, `>{t('loginToReply')}<`);
commentReplies = commentReplies.replace(/`\$\{localCount\} cevabı gör · Cevapla`/g, `t('viewReplies', { count: localCount, defaultValue: \`\${localCount} cevabı gör · Cevapla\` })`); 
write('components/comments/CommentReplies.tsx', commentReplies);

// 4. COMMENT SHEET
let commentSheet = read('components/CommentSheet.tsx');
commentSheet = injectTranslationImport(commentSheet, 'common');
commentSheet = commentSheet.replace(/>Yorumlar yükleniyor...<\/Text>/g, `>{t('loadingComments')}</Text>`);
commentSheet = commentSheet.replace(/>Henüz yorum yok<\/Text>/g, `>{t('noCommentsYet')}</Text>`);
commentSheet = commentSheet.replace(/>\s*Bu içerik için ilk yorumu sen yapabilirsin\.\s*<\/Text>/g, `>{t('firstCommentPrompt')}</Text>`);
write('components/CommentSheet.tsx', commentSheet);

// 5. LOGIN PAYWALL
let loginPaywall = read('components/LoginPaywall.tsx');
loginPaywall = injectTranslationImport(loginPaywall, 'common');
loginPaywall = loginPaywall.replace(/>Misafir Erişimi<\/Text>/g, `>{t('guestAccess')}</Text>`);
loginPaywall = loginPaywall.replace(/'Kendi listenizi oluşturmak, dizileri takip etmek ve kişisel takviminize erişmek için aramıza katılın!'/g, `t('guestAccessDesc')`);
loginPaywall = loginPaywall.replace(/>Kayıt Ol \/ Giriş Yap<\/Text>/g, `>{t('signupLogin')}</Text>`);
write('components/LoginPaywall.tsx', loginPaywall);

// 6. LIST CARD
let listCard = read('components/profile/ListCard.tsx');
listCard = injectTranslationImport(listCard, 'common');
listCard = listCard.replace(/\{data\.itemCount\} öğe/g, `{data.itemCount} {t('items')}`);
write('components/profile/ListCard.tsx', listCard);

// 7. MY INLINE COMMENT
let myInline = read('components/MyInlineComment.tsx');
myInline = injectTranslationImport(myInline, 'common');
myInline = myInline.replace(/>Yorum yapmak için giriş yapın<\/Text>/g, `>{t('loginToComment')}</Text>`);
write('components/MyInlineComment.tsx', myInline);

// Update JSONs
function updateJson(filePath, additions) {
  const content = fs.readFileSync(path.resolve(filePath), 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(content);
  for (const [key, val] of Object.entries(additions)) {
    data[key] = val;
  }
  data['viewReplies'] = filePath.includes('en/') ? 'View {{count}} replies · Reply' : '{{count}} cevabı gör · Cevapla';
  fs.writeFileSync(path.resolve(filePath), JSON.stringify(data, null, 2), 'utf8');
}

updateJson('locales/tr/common.json', trCommon);
updateJson('locales/en/common.json', enCommon);

console.log('Successfully completed translations.');
