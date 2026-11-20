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

/**
 * 100% REAL iconic internet meme photos (verified live Imgflip CDN templates).
 */
export const FAMOUS_CHAT_MEMES: FamousMemeSticker[] = [
  {
    id: 'uno-draw-25',
    title: 'Poori Gaddi Utha Le! 🃏',
    dialogue: 'Sach bol ya poori gaddi utha le — UNO Draw 25 moment!',
    source: 'UNO Draw 25',
    image: 'https://i.imgflip.com/3lmzyx.jpg',
    tag: 'CARD MEME',
  },
  {
    id: 'monkey-binod',
    title: 'Dekh Raha Hai Binod? 👀',
    dialogue: 'Dekh raha hai Binod? Kaise khullam-khulla bluff kar raha hai!',
    source: 'Side-Eye Puppet',
    image: 'https://i.imgflip.com/2gnnjh.jpg',
    tag: 'SUS',
  },
  {
    id: 'leo-cheers',
    title: 'Asli Khiladi Hoon Main 🥂',
    dialogue: 'Ye Baburao ka style hai — sabko ullu bana diya!',
    source: 'Leo Cheers',
    image: 'https://i.imgflip.com/39t1o.jpg',
    tag: 'BOSS',
  },
  {
    id: 'clown-beizzati',
    title: 'Gajab Beizzati Hai 💀',
    dialogue: 'Gajab beizzati hai yaar! Itna ganda bluff pakda gaya!',
    source: 'Clown Makeup',
    image: 'https://i.imgflip.com/38el31.jpg',
    tag: 'ROAST',
  },
  {
    id: 'spiderman-point',
    title: 'Tu Jhoota! Nahi Tu! 🫵',
    dialogue: 'Abbe tu bluff kar raha hai! Nahi bhai, tu kar raha hai!',
    source: 'Spider-Man Pointing',
    image: 'https://i.imgflip.com/1tkjq9.jpg',
    tag: 'CLASSIC',
  },
  {
    id: 'two-buttons',
    title: 'Accept Ya Challenge?! 😰',
    dialogue: 'Control Uday, control! Accept karu ya Challenge?!',
    source: 'Two Buttons',
    image: 'https://i.imgflip.com/1g8my4.jpg',
    tag: 'TENSION',
  },
  {
    id: 'woman-yelling-cat',
    title: 'Abbe Jhoot Bol Raha Hai! 😤',
    dialogue: 'Abbe jhoot bol raha hai saala! Bilkul sach nahi hai ye!',
    source: 'Yelling At Cat',
    image: 'https://i.imgflip.com/345v97.jpg',
    tag: 'SPICY',
  },
  {
    id: 'roll-safe-brain',
    title: '200 IQ Bluff Strategy 🧠',
    dialogue: 'Koi pakad hi nahi sakta agar mujhe khud nahi pata kya phenka!',
    source: 'Roll Safe',
    image: 'https://i.imgflip.com/1h7in3.jpg',
    tag: 'BIG BRAIN',
  },
  {
    id: 'harold-pain',
    title: 'Seh Lenge Thoda 😅',
    dialogue: '15 patte ka pile utha liya... koi baat nahi, seh lenge thoda.',
    source: 'Hide The Pain Harold',
    image: 'https://i.imgflip.com/gk5el.jpg',
    tag: 'PAIN',
  },
  {
    id: 'disaster-girl',
    title: 'Khatam, Tata, Bye-Bye 🔥',
    dialogue: 'Khatam, tata, bye-bye, goodbye, gaya! Jalwa hai hamara!',
    source: 'Disaster Girl',
    image: 'https://i.imgflip.com/23ls.jpg',
    tag: 'SAVAGE',
  },
  {
    id: 'surprised-pikachu',
    title: 'Pakda Gaya Chomu! 😱',
    dialogue: '4 Aces claim kiya aur pakda gaya — shocking!!',
    source: 'Surprised Pikachu',
    image: 'https://i.imgflip.com/2kbn1e.jpg',
    tag: 'CAUGHT',
  },
  {
    id: 'waiting-skeleton',
    title: 'Jaldi Chal Bhai! 💀',
    dialogue: 'Jaldi patte daal bhai, teri turn ke wait mein budhe ho gaye!',
    source: 'Waiting Skeleton',
    image: 'https://i.imgflip.com/2fm6x.jpg',
    tag: 'HURRY UP',
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
    image: 'https://i.imgflip.com/2kbn1e.jpg',
  },
  {
    headline: 'POORI GADDI UTHA LE! 🃏',
    subline: 'Khatam, tata, bye-bye! Kya fek raha tha bhai?!',
    image: 'https://i.imgflip.com/3lmzyx.jpg',
  },
  {
    headline: 'GAJAB BEIZZATI HAI! 🤡',
    subline: 'Itna ganda bluff? Seh lenge thoda ab!',
    image: 'https://i.imgflip.com/38el31.jpg',
  },
];

export const TRUTH_CONFIRMED_MEMES = [
  {
    headline: 'YE BABURAO KA STYLE HAI! 🥂',
    subline: 'Chal hat, shak kar raha tha mujhpe? Ab poora pile utha!',
    image: 'https://i.imgflip.com/39t1o.jpg',
  },
  {
    headline: 'JALWA HAI HAMARA! 🔥',
    subline: 'Galat panga le liya bhai — seh lenge thoda ab!',
    image: 'https://i.imgflip.com/23ls.jpg',
  },
  {
    headline: '200 IQ ASLI KHILADI! 🧠',
    subline: 'Control Uday, control! Sach bola tha bhai!',
    image: 'https://i.imgflip.com/1h7in3.jpg',
  },
];

export function pickMemeLine<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}
