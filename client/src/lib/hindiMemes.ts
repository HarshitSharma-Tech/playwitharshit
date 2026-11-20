import type { VoicePhrase } from '@shared/types';

export interface HindiMemeCallout {
  phrase: VoicePhrase;
  tag: string;
  tone: 'roast' | 'hype' | 'suspect';
}

export interface FamousMemeSticker {
  id: string;
  title: string;
  dialogue: string;
  source: string;
  image: string;
  tag: string;
}

export const FAMOUS_CHAT_MEMES: FamousMemeSticker[] = [
  {
    id: 'baburao-utha',
    title: 'Utha Le Re Baba 🙏',
    dialogue: 'Utha le re baba! Mereko nahi, is jhoothe ko utha le!',
    source: 'Hera Pheri',
    image: '/images/meme-caught.jpg',
    tag: 'HERA PHERI',
  },
  {
    id: 'paisa-hi-paisa',
    title: 'Paisa Hi Paisa Hoga 💸',
    dialogue: '25 din mein double bluff — paisa hi paisa hoga!',
    source: 'Phir Hera Pheri',
    image: '/images/meme-boss.jpg',
    tag: 'CLASSIC',
  },
  {
    id: 'dekh-raha-binod',
    title: 'Dekh Raha Hai Binod? 👀',
    dialogue: 'Dekh raha hai Binod? Kaise khullam-khulla bluff kar raha hai!',
    source: 'Panchayat',
    image: '/images/avatar-detective.jpg',
    tag: 'PANCHAYAT',
  },
  {
    id: 'gajab-beizzati',
    title: 'Gajab Beizzati Hai 💀',
    dialogue: 'Gajab beizzati hai yaar! Poori gaddi utha li!',
    source: 'Panchayat',
    image: '/images/meme-caught.jpg',
    tag: 'ROAST',
  },
  {
    id: 'jalwa-hamara',
    title: 'Jalwa Hai Hamara 👑',
    dialogue: 'Jalwa hai hamara is table pe — aukat mein khelo!',
    source: 'Mirzapur',
    image: '/images/avatar-shark.jpg',
    tag: 'MIRZAPUR',
  },
  {
    id: 'control-uday',
    title: 'Control Uday, Control 😤',
    dialogue: 'Control Uday, control! Challenge mat kar abhi!',
    source: 'Welcome',
    image: '/images/avatar-joker.jpg',
    tag: 'WELCOME',
  },
  {
    id: 'bilkul-riks',
    title: 'Bilkul Riks Nahi Lene Ka 🛑',
    dialogue: 'Bilkul riks nahi lene ka — main Accept kar raha hoon!',
    source: 'Hera Pheri',
    image: '/images/avatar-detective.jpg',
    tag: 'SAFE PLAY',
  },
  {
    id: 'choti-bacchi',
    title: 'Choti Bacchi Ho Kya? 🤨',
    dialogue: 'Choti bacchi ho kya? Samajh nahi aata ye bluff hai!',
    source: 'Bollywood Meme',
    image: '/images/avatar-queen.jpg',
    tag: 'SPICY',
  },
  {
    id: 'khatam-tata',
    title: 'Khatam, Tata, Bye-Bye 👋',
    dialogue: 'Khatam, tata, bye-bye, goodbye, gaya! Game over bhai!',
    source: 'Viral Meme',
    image: '/images/meme-boss.jpg',
    tag: 'FINISH',
  },
  {
    id: 'abbe-saale',
    title: 'Abbe Saale! Harmonium Bajaa 🎹',
    dialogue: 'Abbe saale! Itna ganda jhoot bol diya!',
    source: 'Desi Meme',
    image: '/images/avatar-joker.jpg',
    tag: 'ROAST',
  },
  {
    id: 'seh-lenge',
    title: 'Seh Lenge Thoda 😅',
    dialogue: 'Pile utha liya? Koi baat nahi, seh lenge thoda...',
    source: 'Welcome',
    image: '/images/meme-caught.jpg',
    tag: 'PAIN',
  },
  {
    id: 'baburao-style',
    title: 'Ye Baburao Ka Style Hai 😎',
    dialogue: 'Ye Baburao ka style hai — seedha 3 card bluff!',
    source: 'Hera Pheri',
    image: '/images/avatar-shark.jpg',
    tag: 'BOSS',
  },
];

export const HINDI_MEME_ROASTS: HindiMemeCallout[] = [
  { phrase: "Abbe jhoot bol raha hai saala!", tag: 'ROAST', tone: 'roast' },
  { phrase: "Kya fek raha hai bhai?!", tag: 'SUS', tone: 'suspect' },
  { phrase: "Pakda gaya chomu!", tag: 'MEME', tone: 'roast' },
  { phrase: "Gajab beizzati hai yaar!", tag: 'MEME', tone: 'roast' },
  { phrase: "Chal hat, ullu mat bana!", tag: 'SPICY', tone: 'suspect' },
  { phrase: "Khatam, tata, bye-bye!", tag: 'FINISH', tone: 'hype' },
  { phrase: "Asli khiladi hoon main!", tag: 'BOSS', tone: 'hype' },
  { phrase: "Aukat mein reh bawa!", tag: 'SPICY', tone: 'roast' },
  { phrase: "You're bluffing!", tag: 'CLASSIC', tone: 'suspect' },
  { phrase: "I don't believe you!", tag: 'CLASSIC', tone: 'suspect' },
  { phrase: "Nice try!", tag: 'CLASSIC', tone: 'hype' },
  { phrase: "No way!", tag: 'CLASSIC', tone: 'suspect' },
];

export const BLUFF_CAUGHT_MEMES = [
  {
    headline: 'PAKDA GAYA SAALA! 😂',
    subline: 'Dekh raha hai Binod? Gajab beizzati hai yaar — poori gaddi utha le!',
  },
  {
    headline: 'UTHA LE RE BABA! 🙏',
    subline: 'Khatam, tata, bye-bye! Kya fek raha tha bhai?!',
  },
  {
    headline: 'ABBE SAALE, PAKDA GAYA! 💀',
    subline: 'Choti bacchi ho kya? Aukat mein reh bawa!',
  },
];

export const TRUTH_CONFIRMED_MEMES = [
  {
    headline: 'YE BABURAO KA STYLE HAI! 😎',
    subline: 'Chal hat, shak kar raha tha mujhpe? Ab poora pile utha!',
  },
  {
    headline: 'JALWA HAI HAMARA! 🔥',
    subline: 'Galat panga le liya bhai — seh lenge thoda ab!',
  },
  {
    headline: 'ASLI KHILADI HOON MAIN! 👑',
    subline: 'Control Uday, control! Sach bola tha bhai!',
  },
];

export function pickMemeLine<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}
