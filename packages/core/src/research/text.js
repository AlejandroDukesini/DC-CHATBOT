// Procesamiento de texto para el investigador: sin modelos ni dependencias,
// solo tokenización, palabras vacías y TF-IDF.

const STOPWORDS = {
  es: 'a al algo algun alguna como con cual cuales cuando de del desde donde el ella ellas ellos en entre era es esa ese eso esta este esto fue ha hay la las le les lo los mas me mi muy no nos o para pero por porque que quien se ser si sin sobre son su sus tambien te tiene todo tu un una uno unos y ya explica explicame dime cuenta sabes saber quiero informacion acerca significa significado definicion',
  en: 'a about an and are as at be been but by can do does for from has have how i in is it its of on or that the their this to was were what when where which who why will with you your tell explain me',
};

const SETS = Object.fromEntries(Object.entries(STOPWORDS).map(([k, v]) => [k, new Set(v.split(' '))]));
const ALL_STOPWORDS = new Set([...SETS.es, ...SETS.en]);

export const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function tokenize(text) {
  return stripAccents(String(text).toLowerCase())
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// "Stemming" mínimo: unifica plurales sencillos (planetas → planeta).
const stem = (t) => (t.length > 4 && t.endsWith('es') && !t.endsWith('ies') ? t.slice(0, -2) : t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

export const terms = (text) => tokenize(text).filter((t) => !ALL_STOPWORDS.has(t) && t.length > 1).map(stem);

export function detectLanguage(text) {
  if (/[ñ¿¡áéíóú]/i.test(text)) return 'es';
  const tokens = tokenize(text);
  const es = tokens.filter((t) => SETS.es.has(t)).length;
  const en = tokens.filter((t) => SETS.en.has(t)).length;
  return en > es ? 'en' : 'es';
}

/** Palabras clave normalizadas (para puntuar), sin repetidos y en el orden original. */
export function keywords(query) {
  return [...new Set(terms(query))];
}

/** Palabras de la consulta tal como las escribió el usuario, sin palabras vacías (para buscar). */
export function queryWords(query) {
  return String(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !ALL_STOPWORDS.has(stripAccents(w.toLowerCase())));
}

/** Divide en frases evitando cortar en abreviaturas y números decimales. */
export function splitSentences(text) {
  return String(text)
    .replace(/[\u200b\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«(])/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 600);
}

/**
 * Puntúa cada frase con TF-IDF respecto a las palabras clave.
 * Devuelve [{ index, score, matched }], donde matched son las palabras clave encontradas.
 */
export function scoreSentences(sentences, queryTerms) {
  const docs = sentences.map((s) => terms(s));
  const df = new Map();
  for (const doc of docs) for (const t of new Set(doc)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length || 1;
  return docs.map((doc, index) => {
    const tf = new Map();
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    const matched = [];
    for (const q of queryTerms) {
      const f = tf.get(q);
      if (!f) continue;
      matched.push(q);
      score += (f / doc.length) * Math.log(1 + N / (df.get(q) ?? 1));
    }
    return { index, score: score * Math.sqrt(matched.length), matched };
  });
}

export function similarity(a, b) {
  const A = new Set(terms(a));
  const B = new Set(terms(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
