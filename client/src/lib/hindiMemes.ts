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

export interface ChallengeMemeReaction {
  character: string;
  headline: string;
  subline: string;
  image: string;
  fallbackImage: string;
}

/**
 * 100% REAL iconic Indian & internet meme photos (verified live URLs).
 */
export const FAMOUS_CHAT_MEMES: FamousMemeSticker[] = [
  {
    id: 'deepak-kalal-bhikmangya',
    title: 'Kya Re Bhikmangya?! 💅',
    dialogue: 'Kya re bhikmangya?! Aise saste bluff leke aaya hai table pe!',
    source: 'Deepak Kalal',
    image: 'https://indianmemetemplates.com/wp-content/uploads/kya-re-bhikmangey.jpg',
    tag: 'DEEPAK KALAL',
  },
  {
    id: 'jethalal-soch',
    title: 'Jaisi Jiski Soch! 🤷',
    dialogue: 'Jaisi jiski soch! Abbe kuch bhi fek raha hai bhai!',
    source: 'Jethalal · TMKOC',
    image: 'https://indianmemetemplates.com/wp-content/uploads/jaisi-jiski-soch-800x600.jpg',
    tag: 'JETHALAL',
  },
  {
    id: 'ashneer-doglapan',
    title: 'Ye Sab Doglapan Hai! 😤',
    dialogue: 'Bhai kya kar raha hai yaar tu? Ye sab doglapan hai!',
    source: 'Ashneer Grover',
    image: 'https://indianmemetemplates.com/wp-content/uploads/ye-sab-doglapan-hai.jpg',
    tag: 'SHARK TANK',
  },
  {
    id: 'baburao-daro',
    title: 'Bhagwan Se To Daro! 🙏',
    dialogue: 'Arre baba, itna bada jhoot bolne se pehle Bhagwan se to daro!',
    source: 'Babu Rao · Hera Pheri',
    image: 'https://indianmemetemplates.com/wp-content/uploads/bhagwan-se-to-daro.jpg',
    tag: 'HERA PHERI',
  },
  {
    id: 'hindustani-bhau-sabar',
    title: 'Ruko Zara, Sabar Karo! ✋',
    dialogue: 'Ruko zara, sabar karo — abhi poora bhanda phodta hoon!',
    source: 'Hindustani Bhau',
    image: 'https://indianmemetemplates.com/wp-content/uploads/ruko-zara-sabar-karo.jpg',
    tag: 'BHAU',
  },
  {
    id: 'binod-panchayat',
    title: 'Dekh Raha Hai Binod? 👀',
    dialogue: 'Dekh raha hai Binod? Kaise khullam-khulla bluff maara ja raha hai!',
    source: 'Panchayat · Binod',
    image: 'https://indianmemetemplates.com/wp-content/uploads/dekh-raha-hai-binod.jpg',
    tag: 'PANCHAYAT',
  },
  {
    id: 'akshay-scheme',
    title: 'Ye Scheme Tere Liye Nahi! 😎',
    dialogue: 'Tu ja yaha se, ye bluff wali scheme tere liye hai hi nahi!',
    source: 'Akshay Kumar · Hera Pheri',
    image:
      'https://indianmemetemplates.com/wp-content/uploads/2019/01/tu-ja-yaha-se-ye-scheme-tere-liye-hai-hi-nahi.jpg',
    tag: 'HERA PHERI',
  },
  {
    id: 'uday-control',
    title: 'Control Uday, Control! 😰',
    dialogue: 'Control Uday, control! Pass karu ya Call Bluff daba du?!',
    source: 'Uday Shetty · Welcome',
    image: 'https://indianmemetemplates.com/wp-content/uploads/control-uday-control.jpg',
    tag: 'WELCOME',
  },
  {
    id: 'mirzapur-badhiya',
    title: 'Ye Badhiya Tha Guru! 🔥',
    dialogue: 'Kya baat hai! Ye badhiya tha guru — ek number chaal chali!',
    source: 'Mirzapur · Kaleen',
    image: 'https://indianmemetemplates.com/wp-content/uploads/ye-badhiya-tha-guru.jpg',
    tag: 'MIRZAPUR',
  },
  {
    id: 'uno-draw-25',
    title: 'Poori Gaddi Utha Le! 🃏',
    dialogue: 'Sach bol ya poori gaddi utha le — UNO Draw 25 moment!',
    source: 'UNO Draw 25',
    image: 'https://i.imgflip.com/3lmzyx.jpg',
    tag: 'CARD MEME',
  },
  {
    id: 'spiderman-point',
    title: 'Tu Jhoota! Nahi Tu! 🫵',
    dialogue: 'Abbe tu bluff kar raha hai! Nahi bhai, tu kar raha hai!',
    source: 'Spider-Man Pointing',
    image: 'https://i.imgflip.com/1tkjq9.jpg',
    tag: 'CLASSIC',
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

export const BLUFF_CAUGHT_MEMES: ChallengeMemeReaction[] = [
  {
    character: 'Deepak Kalal',
    headline: 'KYA RE BHIKMANGYA?! PAKDA GAYA! 😂',
    subline: 'Itna sasta bluff leke aaya tha? Ab poori gaddi utha chup-chaap!',
    image: 'https://indianmemetemplates.com/wp-content/uploads/kya-re-bhikmangey.jpg',
    fallbackImage: 'https://i.imgflip.com/2kbn1e.jpg',
  },
  {
    character: 'Ashneer Grover',
    headline: 'YE SAB DOGLAPAN HAI! 😤',
    subline: 'Bhai kya kar raha hai yaar tu?! Khule-aam jhoot bol raha tha!',
    image: 'https://indianmemetemplates.com/wp-content/uploads/ye-sab-doglapan-hai.jpg',
    fallbackImage: 'https://i.imgflip.com/38el31.jpg',
  },
  {
    character: 'Babu Rao · Hera Pheri',
    headline: 'BHAGWAN SE TO DARO! 🙏',
    subline: 'Utha le re baba! Itna bada bluff maara aur pakda gaya!',
    image: 'https://indianmemetemplates.com/wp-content/uploads/bhagwan-se-to-daro.jpg',
    fallbackImage: 'https://i.imgflip.com/3lmzyx.jpg',
  },
  {
    character: 'Panchayat · Binod',
    headline: 'DEKH RAHA HAI BINOD?! 👀',
    subline: 'Kaise aankhon mein dhool jhonk raha tha — ab poora pile le!',
    image: 'https://indianmemetemplates.com/wp-content/uploads/dekh-raha-hai-binod.jpg',
    fallbackImage: 'https://i.imgflip.com/2gnnjh.jpg',
  },
];

export const TRUTH_CONFIRMED_MEMES: ChallengeMemeReaction[] = [
  {
    character: 'Akshay Kumar · Hera Pheri',
    headline: 'YE SCHEME TERE LIYE NAHI HAI! 😎',
    subline: 'Shak kar raha tha mujhpe? Ab poori gaddi khud utha le!',
    image:
      'https://indianmemetemplates.com/wp-content/uploads/2019/01/tu-ja-yaha-se-ye-scheme-tere-liye-hai-hi-nahi.jpg',
    fallbackImage: 'https://i.imgflip.com/39t1o.jpg',
  },
  {
    character: 'Mirzapur · Kaleen',
    headline: 'YE BADHIYA THA GURU! 🔥',
    subline: 'Ek dum sach bola tha! Galat aadmi ko challenge kar diya!',
    image: 'https://indianmemetemplates.com/wp-content/uploads/ye-badhiya-tha-guru.jpg',
    fallbackImage: 'https://i.imgflip.com/1h7in3.jpg',
  },
  {
    character: 'Hindustani Bhau',
    headline: 'RUKO ZARA, SABAR KARO! ✋',
    subline: 'Bina soche Call Bluff daba diya? Ab saare patte leke baith!',
    image: 'https://indianmemetemplates.com/wp-content/uploads/ruko-zara-sabar-karo.jpg',
    fallbackImage: 'https://i.imgflip.com/23ls.jpg',
  },
  {
    character: 'Jethalal · TMKOC',
    headline: 'JAISI JISKI SOCH! 🤷',
    subline: 'Sach nikla bhai! Aage se dhyan se Call Bluff bolna!',
    image: 'https://indianmemetemplates.com/wp-content/uploads/jaisi-jiski-soch-800x600.jpg',
    fallbackImage: 'https://i.imgflip.com/gk5el.jpg',
  },
];

export function pickMemeLine<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}
