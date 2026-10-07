import { LanguageCode, SpeechSegment } from './voice.interfaces';

const ARABIC_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Tunisian Derja vocabulary (Arabic script)
const TUNISIAN_ARABIC_WORDS = new Set([
  'عسلامة', 'نحب', 'نأكد', 'نأكدلك', 'الكوموند', 'كوموند', 'متاعك', 'متاع',
  'باش', 'بش', 'وقتاش', 'شنوة', 'شنية', 'شكون', 'مريقل', 'مريقلة', 'برشا',
  'فيسع', 'سامحني', 'يعيشك', 'باهي', 'بطلت', 'بطل', 'فسخ', 'نواصلو', 'نوصلولك',
  'ديليس', 'توانسة', 'دار', 'حومة', 'فلوس', 'توا', 'توة', 'ديما', 'قداش', 'تأكدت'
]);

// Tunisian Derja vocabulary (Latin / Arabizi)
const TUNISIAN_ARABIZI_WORDS = new Set([
  '3aslema', 'aslema', 'nheb', 'n7eb', 'bech', 'bch', 'mriguel', 'mrigla',
  'mta3', 'mte3ek', 'mte3', 'chnowa', 'chnia', 'chkoun', 'barsha', 'fissa3',
  'y3aychek', 'ya3tik', 'behi', 'battal', 'batalt', 'fassakh', 'fadit',
  'nconfirmi', 'tconfirmi', 'twaslou', 'nwaslou', 'nwaslouhalek', 'ey',
  'aywah', 'aywa', 'le', 'laa', 'khoya', 'sahbi', 'nharek', 'tayeb'
]);

// Common English words for code-switching identification
const ENGLISH_WORDS = new Set([
  'hello', 'hi', 'hey', 'order', 'orders', 'confirmed', 'confirm', 'cancel', 'cancelled',
  'delivery', 'time', 'change', 'want', 'please', 'thank', 'thanks', 'you', 'your', 'yes',
  'no', 'sure', 'okay', 'ok', 'now', 'today', 'address', 'phone', 'number',
  'item', 'items', 'total', 'price', 'product', 'products', 'bye', 'good',
  'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'can', 'will', 'would', 'could', 'should', 'have', 'has', 'had', 'do', 'does', 'did', 'but'
]);

// Common French words for code-switching identification
const FRENCH_WORDS = new Set([
  'bonjour', 'bonsoir', 'salut', 'votre', 'vos', 'notre', 'nos', 'commande', 'commandes',
  'confirme', 'confirmer', 'confirmé', 'confirmée', 'annule', 'annuler', 'annulé', 'annulée',
  'merci', 'oui', 'non', 'd\'accord', 'daccord', 'adresse', 'livraison', 'journée',
  'au', 'revoir', 'est', 'sont', 'suis', 'es', 'sommes', 'êtes', 'pour', 'avec', 'dans', 'sur',
  'bien', 'très', 'je', 'vous', 'nous', 'il', 'elle', 'on', 'produit', 'produits',
  'prix', 'total', 'quantité', 'mais', 'maintenant', 'heure'
]);

/**
 * Detects the predominant language of a single word.
 */
export function detectWordLanguage(word: string): LanguageCode {
  const clean = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (!clean) return 'fr';

  if (ARABIC_SCRIPT_REGEX.test(clean)) {
    return TUNISIAN_ARABIC_WORDS.has(clean) ? 'tn' : 'ar';
  }

  if (TUNISIAN_ARABIZI_WORDS.has(clean)) {
    return 'tn';
  }

  if (ENGLISH_WORDS.has(clean)) {
    return 'en';
  }

  if (FRENCH_WORDS.has(clean)) {
    return 'fr';
  }

  return 'fr';
}

/**
 * Segments a mixed sentence into coherent language chunks for code-switched TTS.
 * e.g. "Bonjour, عسلامة، votre commande est confirmée."
 * -> [
 *      { text: "Bonjour, ", language: "fr" },
 *      { text: "عسلامة، ", language: "tn" },
 *      { text: "votre commande est confirmée.", language: "fr" }
 *    ]
 */
export function segmentMultilingualText(text: string): SpeechSegment[] {
  if (!text || !text.trim()) return [];

  // Match words, spaces, punctuation
  const tokens = text.match(/[\p{L}\p{N}'’]+|[^\p{L}\p{N}'’\s]+|\s+/gu) || [text];
  const segments: SpeechSegment[] = [];

  let currentLang: LanguageCode | null = null;
  let currentBuffer = '';

  for (const token of tokens) {
    const isWhitespaceOrPunct = !/[\p{L}\p{N}]/u.test(token);

    if (isWhitespaceOrPunct) {
      currentBuffer += token;
      continue;
    }

    const isArabicScript = ARABIC_SCRIPT_REGEX.test(token);
    const tokenLang = detectWordLanguage(token);

    // If current segment was Arabic script and new token is ALSO Arabic script,
    // KEEP THEM TOGETHER. If token is Tunisian Derja, elevate the segment to 'tn'.
    if (currentLang !== null && (currentLang === 'ar' || currentLang === 'tn') && isArabicScript) {
      if (tokenLang === 'tn') {
        currentLang = 'tn';
      }
      currentBuffer += token;
      continue;
    }

    const prevWasArabicScript = currentLang === 'ar' || currentLang === 'tn';

    if (currentLang === null) {
      currentLang = tokenLang;
      currentBuffer += token;
    } else if (
      // Boundary 1: Arabic script vs Latin script
      (isArabicScript && !prevWasArabicScript) ||
      (!isArabicScript && prevWasArabicScript) ||
      // Boundary 2: English vs French or Arabizi within Latin script
      (!isArabicScript && !prevWasArabicScript && currentLang !== tokenLang && (tokenLang === 'en' || currentLang === 'en' || tokenLang === 'tn' || currentLang === 'tn'))
    ) {
      if (currentBuffer.trim()) {
        segments.push({
          text: currentBuffer,
          language: currentLang,
        });
      }
      currentLang = tokenLang;
      currentBuffer = token;
    } else {
      currentBuffer += token;
    }
  }

  if (currentBuffer.trim()) {
    segments.push({
      text: currentBuffer,
      language: currentLang || 'fr',
    });
  }

  return cleanAndMergeSegments(segments);
}

function cleanAndMergeSegments(raw: SpeechSegment[]): SpeechSegment[] {
  if (raw.length <= 1) return raw;

  const result: SpeechSegment[] = [];
  for (const seg of raw) {
    if (!seg.text) continue;
    if (result.length > 0 && result[result.length - 1].language === seg.language) {
      result[result.length - 1].text += seg.text;
    } else {
      result.push({ ...seg });
    }
  }

  return result.filter((s) => s.text.trim().length > 0);
}
