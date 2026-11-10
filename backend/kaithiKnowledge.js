/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📜 NEXUSS AI — KAITHI LIPI (कैथी लिपि) KNOWLEDGE & TRANSLITERATION ENGINE
 * 
 * Based directly on the official Bihar Government Curriculum:
 * "कैथी लिपि पाठ्य पुस्तिका"
 * भू-अभिलेख एवं परिमाप निदेशालय, राजस्व एवं भूमि सुधार विभाग, बिहार सरकार
 * लेखक: श्री प्रीतम कुमार (शोध छात्र, BHU) एवं मो० वकार अहमद
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── 1. UNICODE TRANSLITERATION MAPS (U+11080 - U+110CF) ──────────────────────
const KAITHI_TO_DEVANAGARI = {
  // Signs & Vowels
  '\u{11080}': 'ँ', // Candrabindu
  '\u{11081}': 'ं', // Anusvara
  '\u{11082}': 'ः', // Visarga
  '\u{11083}': 'अ',
  '\u{11084}': 'आ',
  '\u{11085}': 'इ',
  '\u{11086}': 'ई',
  '\u{11087}': 'उ',
  '\u{11088}': 'ऊ',
  '\u{11089}': 'ए',
  '\u{1108A}': 'ऐ',
  '\u{1108B}': 'ओ',
  '\u{1108C}': 'औ',
  
  // Consonants (35 standard)
  '\u{1108D}': 'क',
  '\u{1108E}': 'ख',
  '\u{1108F}': 'ग',
  '\u{11090}': 'घ',
  '\u{11091}': 'ङ',
  '\u{11092}': 'च',
  '\u{11093}': 'छ',
  '\u{11094}': 'ज',
  '\u{11095}': 'झ',
  '\u{11096}': 'ञ',
  '\u{11097}': 'ट',
  '\u{11098}': 'ठ',
  '\u{11099}': 'ड',
  '\u{1109A}': 'ढ',
  '\u{1109B}': 'ड़', // Rha / Dda nukta
  '\u{1109C}': 'ण',
  '\u{1109D}': 'त',
  '\u{1109E}': 'थ',
  '\u{1109F}': 'द',
  '\u{110A0}': 'ध',
  '\u{110A1}': 'न',
  '\u{110A2}': 'प',
  '\u{110A3}': 'फ',
  '\u{110A4}': 'ब',
  '\u{110A5}': 'भ',
  '\u{110A6}': 'म',
  '\u{110A7}': 'य',
  '\u{110A8}': 'र',
  '\u{110A9}': 'ल',
  '\u{110AA}': 'व',
  '\u{110AB}': 'श',
  '\u{110AC}': 'ष',
  '\u{110AD}': 'स',
  '\u{110AE}': 'ह',

  // Matras
  '\u{110B0}': 'ा',
  '\u{110B1}': 'ि',
  '\u{110B2}': 'ी',
  '\u{110B3}': 'ु',
  '\u{110B4}': 'ू',
  '\u{110B5}': 'े',
  '\u{110B6}': 'ै',
  '\u{110B7}': 'ो',
  '\u{110B8}': 'ौ',
  '\u{110B9}': '्', // Virama / Halant
  '\u{110BA}': '़', // Nukta
  
  // Punctuation
  '\u{110C0}': '।', // Danda
  '\u{110C1}': '॥', // Double Danda
  '\u{110BD}': '₹'  // Number / Rupee sign in Kaithi
};

// Reverse map for Devanagari to Kaithi
const DEVANAGARI_TO_KAITHI = {};
for (const [k, v] of Object.entries(KAITHI_TO_DEVANAGARI)) {
  DEVANAGARI_TO_KAITHI[v] = k;
}

/**
 * Transliterates Kaithi Unicode text into readable Devanagari.
 */
function kaithiToDevanagari(text) {
  if (!text) return "";
  let out = "";
  for (const ch of text) {
    out += KAITHI_TO_DEVANAGARI[ch] || ch;
  }
  return out;
}

/**
 * Transliterates Devanagari text into Kaithi Unicode.
 */
function devanagariToKaithi(text) {
  if (!text) return "";
  let out = "";
  for (const ch of text) {
    out += DEVANAGARI_TO_KAITHI[ch] || ch;
  }
  return out;
}

/**
 * Detects if the text contains Kaithi Unicode characters or mentions Kaithi/historical land records.
 */
function isKaithiRelated(text) {
  if (!text) return false;
  // Check for Kaithi Unicode block
  const hasKaithiUnicode = /[\u{11080}-\u{110CF}]/u.test(text);
  if (hasKaithiUnicode) return true;

  // Check for keywords
  const lower = text.toLowerCase();
  const kaithiKeywords = [
    "kaithi", "कैथी", "खतियान", "कौम", "कास्तकारी", "मवाजी", "जौजे", "वल्द",
    "पेसर", "शाकीन", "साकिन", "मोसमात", "मोवलग", "मुदई", "मुदालई", "जमींदारी",
    "तिरहुत", "भोजपुर कैथी", "मगध कैथी", "मिथिला कैथी", "रैयत", "बैनामा", "नालिशी"
  ];
  return kaithiKeywords.some(kw => lower.includes(kw));
}

// ── 2. COMPREHENSIVE KNOWLEDGE BASE FROM THE TEXTBOOK ────────────────────────
const KAITHI_SYSTEM_PROMPT = `
## 📜 SPECIALIST EXPERTISE: KAITHI LIPI (कैथी लिपि) & BIHAR LAND RECORDS SCHOLAR
You are trained directly on the official curriculum of Bihar Government:
**"कैथी लिपि पाठ्य पुस्तिका" (भू-अभिलेख एवं परिमाप निदेशालय, राजस्व एवं भूमि सुधार विभाग, बिहार सरकार)**.
You have expert-level mastery over Kaithi script (ISO 15924: kthi, Unicode U+11080–U+110CF), its historical variations, and revenue/land records.

### 1. Key Script Rules & Paleography:
1. **शिरोरेखा रहित (No Headline/Shirorekha):** Kaithi letters DO NOT have a top horizontal bar (शिरोरेखा). While writing, writers maintained horizontal alignment using imaginary or faint lines, not shirorekha.
2. **अक्षर संख्या (Inventory):** 35 व्यंजन वर्ण (consonants), 10 स्वतंत्र स्वर (independent vowels), 9 स्वर मात्राएं (matras), अंक 0-9.
3. **लुप्त/दुर्लभ वर्ण:** ऋ, ऌ, श्र, क्ष, ज्ञ का प्रयोग प्रायः नहीं होता।
   - 'क्ष' की जगह 'छ' या 'ख' लिखा जाता है (उदा. लछीमी, रछुआ, रीखी/ऋषि, छेत्र)।
   - 'ज्ञ' की जगह 'ग्य' या 'ज' लिखा जाता है।
   - संयुक्ताक्षर (conjuncts) का प्रयोग बहुत कम होता है।
4. **अक्षरों का परस्पर फेरबदल (Common Substitutions):**
   - **इ और ई, उ और ऊ, ए और ऐ:** ह्रस्व और दीर्घ मात्राओं में भेद कम रहता है।
   - **व और ब:** लगभग एक जैसे लिखे और उच्चारित किए जाते हैं (उदा. वास्ते -> बास्ते, वाद -> बाद, वल्द)।
   - **य और ज:** आपस में बदलते हैं (उदा. गया -> गेआ/जया, यादव -> जादव)।
   - **श, ष, स:** तीनों की जगह अक्सर एक ही रूप या दन्त्य 'स' का प्रयोग होता है।

### 2. Regional Styles (क्षेत्रीय शैलियाँ):
- **भोजपुर शैली (Bhojpur Style):** शाहाबाद, भोजपुर, रोहतास, बक्सर, सारण, चंपारण। इसमें 'अ', 'क', 'ख', 'फ', 'भ' आदि के विशिष्ट घुमावदार रूप होते हैं।
- **तिरहुत शैली (Tirhut Style):** दरभंगा, मुजफ्फरपुर, समस्तीपुर, मधुबनी, सीतामढ़ी। अधिक नुकीले और विशिष्ट अंकन।
- **मगध शैली (Magadh Style):** पटना, गया, नालंदा, नवादा, औरंगाबाद। गोलाकार और सुगठित बनावट।
- **मिथिला शैली (Mithila Style):** मिथिलाक्षर से साम्यता रखने वाले विशिष्ट रूप।
- **कंप्यूटर फॉन्ट रूप (Standard Digital Glyphs):** मानकीकृत यूनिकोड ग्लिफ।

### 3. Vital Land Record (भू-अभिलेख / खतियान) Vocabulary:
When reading, translating, or transcribing Kaithi land records, always recognize and explain these standard terms:
- **वल्द (Wald):** पिता का नाम (Son of / Father's name)
- **पेसर (Pesar):** पुत्र (Son of)
- **जौजे (Jauje):** पत्नी (Wife of)
- **मोसमात / मो. (Mosamat):** महिला, विधवा, या स्त्री आदरसूचक (Respectful title for woman/widow)
- **साकिन / शाकीन / शाकीनान (Saakin/Shakeen):** निवासी / रहने वाला (Resident of)
- **मौजे / मौजा (Mauje/Mauja):** राजस्व ग्राम (Revenue Village)
- **परगना (Pargana):** ऐतिहासिक राजस्व उप-संभाग (Revenue sub-district)
- **तौजी (Tauzi) & खेसरा (Khesra):** भूखंड संख्या / प्लॉट नंबर (Plot / Survey number)
- **खतियान (Khatian):** रैयत के अधिकार और जमीन का मुख्य अभिलेख (Record of Rights)
- **रैयत (Raiyat):** भूमि स्वामी / काश्तकार (Tenant farmer / Landholder)
- **कीता (Keeta):** टुकड़ा या किश्त (Plot piece / Unit)
- **मवाजी (Mawazi):** रकबा / क्षेत्रफल (Area measurement - बिघा, कट्ठा, धूर)
- **मोवलग (Mowlag/Mubaligh):** कुल रकम / धनराशि (Total sum of money)
- **कास्तकारी (Kastkari):** खेती-किसानी / जोत का अधिकार (Tenancy cultivation)
- **जमींदारी (Zamindari):** भू-स्वामित्व प्रणाली
- **गिरहस्ती (Girhasti):** गृहस्थी / खेती का पेशा
- **महाजनी (Mahajani):** साहूकारी / ऋण का काम
- **मुदई (Muddayi):** वादी / प्रार्थी / केस करने वाला (Plaintiff)
- **मुदालई (Mudalai):** प्रतिवादी / जिसके खिलाफ केस हो (Defendant)
- **अलेह (Aleh):** उपर्युक्त / पूर्वोक्त (Aforesaid / Mentioned above)
- **नाममोकीर (Nam-moqir):** इकरारकर्ता / बयान देने वाला (Declarant)
- **कौम (Qawm):** जाति / समुदाय (Caste / Community)
- **बिकरी / बैनामा (Bainama):** विक्रय पत्र / रजिस्ट्री (Sale Deed)
- **नालिशी (Nalishi):** परिवाद / शिकायत (Legal petition/complaint)

### 4. How to Assist Users with Kaithi:
- **If the user provides Kaithi Unicode text (𑂍𑂶𑂟𑂲):**
  1. Provide the exact **Devanagari Transliteration** (नागरी लिप्यंतरण).
  2. Provide a clean, modern **Hindi / English translation** explaining every word.
  3. Identify any land records/khatian terms, dates, personal names, caste, village, and plot details.
- **If the user provides Devanagari/Hindi and asks for Kaithi:**
  Provide both the explanation, the transliterated Kaithi Unicode characters, and explain regional script differences (Bhojpur vs Tirhut vs Magadh).
- **If the user asks about reading old Khatian or Bihar survey documents:**
  Explain the structural formula: *[प्रगना/थाना/मौजा] -> [रैयत/मालिक का नाम वल्द/जौजे...] -> [कौम व पेशा] -> [खेसरा व रकबा मवाजी] -> [चौहद्दी/लगान]*.
`;

export {
  KAITHI_TO_DEVANAGARI,
  DEVANAGARI_TO_KAITHI,
  kaithiToDevanagari,
  devanagariToKaithi,
  isKaithiRelated,
  KAITHI_SYSTEM_PROMPT
};

export default {
  KAITHI_TO_DEVANAGARI,
  DEVANAGARI_TO_KAITHI,
  kaithiToDevanagari,
  devanagariToKaithi,
  isKaithiRelated,
  KAITHI_SYSTEM_PROMPT
};
