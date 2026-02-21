# Certificate code that goes through email

Код живёт в **`server/index.cjs`**: переводы, генерация SVG/PNG и отправка письма с сертификатом.

---

## 1. Переводы (EN/AM) — `CERT_TRANSLATIONS`

```javascript
const CERT_TRANSLATIONS = {
    en: {
        certTitle: 'MY DECLARATION',
        certIntroPrefix: 'I, ',
        certIntroSuffix: ', declare the following:',
        decl1: 'I am done getting stopped out.',
        decl2: 'I am done watching price move without me.',
        decl3: 'I am done being the exit liquidity.',
        decl4: 'Today, I choose a different path.',
        decl5: 'I will learn to see what Smart Money sees.',
        decl6: 'I will wait for the trap to complete before I strike.',
        decl7: 'I will trade with patience, discipline, and precision.',
        decl8: 'I will follow my rules, not emotions.',
        decl9: 'I will not quit when it gets hard.',
        decl10: 'I will become consistently profitable.',
        decl11: 'This is not a hope. This is a decision.',
        certCommitment: '[ THIS IS MY COMMITMENT → ]',
        shareTitle: 'My Declaration — SuperEngulfing',
        shareDescription: 'This is my commitment.',
        shareAlt: 'Certificate of Commitment',
        emailSubject: 'Your Declaration — SuperEngulfing',
        emailTitle: 'Your Declaration',
        emailLedger: 'This declaration is stored on the SuperEngulfing secure ledger.',
        emailFooter: 'SuperEngulfing. All rights reserved.'
    },
    am: {
        certTitle: 'ԻՄ ՀԱՅՏԱՐԱՐՈՒԹՅՈՒՆԸ',
        certIntroPrefix: 'Ես՝ ',
        certIntroSuffix: '-ս, հայտարարում եմ հետևյալը.',
        decl1: 'Բավական է դուրս մնալ խաղից:',
        decl2: 'Բավական է հետևել գնին առանց իմ մասնակցության:',
        decl3: 'Բավական է լինել «սնունդ» (exit liquidity) խոշորների համար:',
        decl4: 'Այսօր ես ընտրում եմ այլ ճանապարհ:',
        decl5: 'Կսովորեմ տեսնել այն, ինչ տեսնում է «Խելացի փողը»:',
        decl6: 'Կսպասեմ թակարդի ավարտին, նախքան գործարք բացելը:',
        decl7: 'Կվարեմ առևտուր համբերությամբ, կարգապահությամբ և ճշգրտությամբ:',
        decl8: 'Կհետևեմ իմ կանոններին, ոչ թե էմոցիաներին:',
        decl9: 'Չեմ հանձնվի, երբ դժվար լինի:',
        decl10: 'Կդառնամ կայուն շահույթով աշխատող թրեյդեր:',
        decl11: 'Սա հույս չէ: Սա որոշում է:',
        certCommitment: '[ ՍԱ ԻՄ ՈՐՈՇՈՒՄՆ Է → ]',
        shareTitle: 'Սա իմ որոշումն է — SuperEngulfing',
        shareDescription: 'Սա իմ հանձնառությունն է:',
        shareAlt: 'Հանձնառության վկայական',
        emailSubject: 'Ձեր Հայտարարությունը — SuperEngulfing',
        emailTitle: 'Ձեր Հայտարարությունը',
        emailLedger: 'Այս հայտարարությունը պահպանված է SuperEngulfing-ի ապահով գրանցամատյանում (ledger):',
        emailFooter: 'SuperEngulfing. Բոլոր իրավունքները պաշտպանված են:'
    }
};

function getCertTr(locale) {
    return CERT_TRANSLATIONS[locale === 'am' ? 'am' : 'en'] || CERT_TRANSLATIONS.en;
}
```

---

## 2. Вспомогательные функции

```javascript
function escapeForSvg(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function getCertificateUser(userId) {
    const r = await pool.query(
        "SELECT COALESCE(first_name, '') AS first_name, COALESCE(locale, 'en') AS locale FROM dashboard_users WHERE id = $1",
        [userId]
    );
    if (r.rows.length === 0) return null;
    const row = r.rows[0];
    return {
        firstName: (row.first_name || '').trim() || 'Trader',
        locale: (row.locale === 'am') ? 'am' : 'en'
    };
}
```

---

## 3. Генерация SVG сертификата — `buildCertificateSvg(firstName, locale)`

Возвращает строку SVG 640×880. Используется для:
- **GET /api/me/certificate** — отдача PNG в дашборде;
- **GET /api/certificate-image/:token** — PNG по ссылке для шаринга;
- **POST /api/me/send-certificate** — конвертация в PNG и вложение в письмо.

```javascript
function buildCertificateSvg(firstName, locale) {
    const tr = getCertTr(locale);
    const name = escapeForSvg(firstName);
    const date = new Date().toISOString().split('T')[0];
    const e = (s) => escapeForSvg(tr[s] || s);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="880" viewBox="0 0 640 880">
  <defs>
    <linearGradient id="bgCert" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#080c14"/>
      <stop offset="35%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#020617"/>
    </linearGradient>
    <linearGradient id="goldMain" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fde68a"/>
      <stop offset="35%" style="stop-color:#d4af37"/>
      <stop offset="100%" style="stop-color:#92400e"/>
    </linearGradient>
    <linearGradient id="goldSoft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(212,175,55,0.5)"/>
      <stop offset="100%" style="stop-color:rgba(212,175,55,0.15)"/>
    </linearGradient>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="640" height="880" fill="url(#bgCert)"/>
  <rect x="0" y="0" width="640" height="880" fill="none" stroke="url(#goldMain)" stroke-width="3"/>
  <rect x="8" y="8" width="624" height="864" fill="none" stroke="url(#goldSoft)" stroke-width="1" opacity="0.6"/>
  <!-- Corner lines -->
  <line x1="20" y1="20" x2="20" y2="68" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="20" y1="20" x2="68" y2="20" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="620" y1="20" x2="620" y2="68" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="572" y1="20" x2="620" y2="20" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="20" y1="812" x2="20" y2="860" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="20" y1="860" x2="68" y2="860" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="620" y1="812" x2="620" y2="860" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="572" y1="860" x2="620" y2="860" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="100" y1="56" x2="540" y2="56" stroke="url(#goldMain)" stroke-width="2" opacity="0.9"/>
  <text x="320" y="100" text-anchor="middle" font-family="Georgia, serif" font-size="10" fill="rgba(212,175,55,0.85)" letter-spacing="0.35em">${e('certTitle')}</text>
  <line x1="100" y1="118" x2="540" y2="118" stroke="url(#goldMain)" stroke-width="1" opacity="0.6"/>
  <text x="320" y="162" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#f1f5f9">${e('certIntroPrefix')}<tspan fill="#fbbf24" font-weight="bold">${name}</tspan>${e('certIntroSuffix')}</text>
  <line x1="80" y1="188" x2="560" y2="188" stroke="rgba(212,175,55,0.25)" stroke-width="1"/>
  <text x="320" y="222" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl1')}</text>
  <text x="320" y="252" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl2')}</text>
  <text x="320" y="282" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl3')}</text>
  <text x="320" y="324" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#fbbf24" font-weight="bold">${e('decl4')}</text>
  <text x="320" y="364" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl5')}</text>
  <text x="320" y="394" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl6')}</text>
  <text x="320" y="424" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl7')}</text>
  <text x="320" y="454" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl8')}</text>
  <text x="320" y="484" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl9')}</text>
  <text x="320" y="514" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl10')}</text>
  <text x="320" y="556" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#f8fafc" font-weight="bold">${e('decl11')}</text>
  <line x1="80" y1="598" x2="560" y2="598" stroke="url(#goldSoft)" stroke-width="1"/>
  <text x="320" y="638" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="url(#goldMain)" filter="url(#softGlow)" letter-spacing="0.12em">${e('certCommitment')}</text>
  <line x1="120" y1="668" x2="520" y2="668" stroke="url(#goldMain)" stroke-width="1" opacity="0.6"/>
  <circle cx="320" cy="758" r="40" fill="none" stroke="url(#goldMain)" stroke-width="2.5" opacity="0.95"/>
  <circle cx="320" cy="758" r="34" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>
  <text x="320" y="766" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#d4af37" font-weight="bold">SE</text>
  <text x="320" y="818" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="#64748b">${date}</text>
  <text x="320" y="848" text-anchor="middle" font-family="Georgia, serif" font-size="9" fill="#475569" letter-spacing="0.08em">SuperEngulfing</text>
</svg>`;
}
```

---

## 4. Отправка сертификата на email — `POST /api/me/send-certificate`

- Берёт пользователя из БД (`email`, `first_name`, `locale`).
- Строит SVG → конвертирует в PNG (sharp) и при необходимости прикрепляет к письму.
- Тело письма — HTML `certificateHtml` (ниже), тема и тексты из `CERT_TRANSLATIONS` по `locale`.
- После успешной отправки: `UPDATE dashboard_users SET onboarding_completed = true WHERE id = $1`.

Логика (без полного кода БД):

```javascript
// 1) Проверить onboarding_completed, не слать повторно
// 2) SELECT email, first_name, locale FROM dashboard_users WHERE id = $1
// 3) tr = getCertTr(locale)
// 4) certificatePngBuffer = sharp(buildCertificateSvg(firstName, locale)).png().toBuffer()
// 5) Сформировать certificateHtml (см. ниже)
// 6) transporter.sendMail({ from, to: email, subject: tr.emailSubject, html: certificateHtml, attachments: [{ filename: 'certificate.png', content: certificatePngBuffer }] })
// 7) UPDATE dashboard_users SET onboarding_completed = true WHERE id = $1
```

---

## 5. HTML письма с сертификатом — `certificateHtml`

Используется в `POST /api/me/send-certificate`. Переменные: `tr` (getCertTr(locale)), `firstName`, `esc(s)` — экранирование HTML.

```html
<!DOCTYPE html>
<html lang="${locale === 'am' ? 'hy' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(tr.emailTitle)}</title></head>
<body style="margin:0; background:#f8fafc; color:#0f172a; font-family: Georgia, 'Times New Roman', serif;">
  <div style="max-width:620px; margin:0 auto; padding: 32px 20px;">
    <div style="text-align: center; margin-bottom: 28px;">
      <span style="color: #059669; font-size: 20px; font-weight: 700; letter-spacing: 0.05em;">SuperEngulfing</span>
      <div style="color: #64748b; font-size: 11px; margin-top: 6px; letter-spacing: 0.2em;">${esc(tr.certTitle)}</div>
    </div>
    <div style="background:#ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      <div style="border: 2px solid #fbbf24; padding: 36px 28px; background:#fffbeb; border-radius: 8px; text-align: center;">
        <div style="height: 2px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); margin: 0 auto 16px; max-width: 280px;"></div>
        <h1 style="font-family: Georgia, serif; color: #b45309; font-size: 15px; font-weight: 400; margin: 0 0 12px 0; letter-spacing: 0.15em;">${esc(tr.certTitle)}</h1>
        <div style="height: 2px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); margin: 0 auto 24px; max-width: 280px;"></div>
        <p style="font-size: 14px; line-height: 1.8; color: #334155; margin: 0 0 20px 0;">${esc(tr.certIntroPrefix)}<strong style="color: #b45309;">${esc(firstName)}</strong>${esc(tr.certIntroSuffix)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl1)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl2)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl3)}</p>
        <p style="font-size: 13px; line-height: 2; color: #b45309; font-weight: bold; margin: 16px 0 4px 0;">${esc(tr.decl4)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl5)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl6)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl7)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl8)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl9)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl10)}</p>
        <p style="font-size: 14px; line-height: 1.8; color: #0f172a; font-weight: bold; margin: 20px 0 24px 0;">${esc(tr.decl11)}</p>
        <div style="height: 2px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); margin: 0 auto 16px; max-width: 240px;"></div>
        <p style="font-size: 12px; color: #b45309; letter-spacing: 0.1em; margin: 0 0 16px 0;">${esc(tr.certCommitment)}</p>
        <div style="height: 2px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); margin: 0 auto 24px; max-width: 240px;"></div>
        <div style="width: 56px; height: 56px; margin: 0 auto 10px; border: 2px solid #f59e0b; border-radius: 50%; line-height: 52px; text-align: center; background: #fef3c7;"><span style="color: #b45309; font-size: 16px; font-weight: bold;">SE</span></div>
        <p style="margin: 0; font-size: 11px; color: #64748b;">${new Date().toISOString().split('T')[0]}</p>
      </div>
      <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 24px;">${esc(tr.emailLedger)}</p>
    </div>
    <div style="text-align: center; margin-top: 28px; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} ${esc(tr.emailFooter)}</div>
  </div>
</body>
</html>
```

`esc(s)` в сервере:  
`(s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')`

---

## Где что лежит в проекте

| Что | Файл |
|-----|------|
| Переводы + SVG + send-certificate + HTML письма | `server/index.cjs` (строки ~1047–1442) |
| Запрос «отправить сертификат» | Dashboard → MagicCertificate → `handleAgree` → `POST /api/me/send-certificate` |
| Просмотр PNG в дашборде | `CertificateSection` → `GET /api/me/certificate` (blob → object URL) |
| Публичная картинка по ссылке из письма/шаринга | `GET /api/certificate-image/:token` |
| Страница шаринга | `GET /share/c/:token` (HTML с og:image на certificate-image) |
