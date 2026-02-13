import type { Locale } from './contexts/LocaleContext';

export interface ContentMedia {
  welcomeVideoUrl: string;
  welcomePdfUrl: string;
}

const en: ContentMedia = {
  welcomeVideoUrl: 'https://fast.wistia.net/embed/iframe/itbz1tz9q3?videoFoam=true',
  welcomePdfUrl: 'https://drive.google.com/file/d/1DEP8ABq-vjZfK1TWTYQkhJEAcSasqZn5/view?usp=sharing',
};

const am: ContentMedia = {
  welcomeVideoUrl: 'https://fast.wistia.net/embed/iframe/xerm5log0a?videoFoam=true',
  welcomePdfUrl: 'https://drive.google.com/file/d/1DEP8ABq-vjZfK1TWTYQkhJEAcSasqZn5/view?usp=sharing',
};

const contentMedia: Record<Locale, ContentMedia> = { en, am };

/** Each locale has its own media; no cross-locale fallback for en/am. Unknown locale falls back to en. */
export function getContentMedia(locale: Locale): ContentMedia {
  if (locale === 'en') return contentMedia.en;
  if (locale === 'am') return contentMedia.am;
  return contentMedia[locale] ?? contentMedia.en;
}
