const PAIRS = [
  // Majors
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  // Minors
  'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD',
  'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD',
  'AUDJPY', 'AUDCHF', 'AUDCAD', 'AUDNZD',
  'CADJPY', 'CADCHF', 'CHFJPY', 'NZDJPY', 'NZDCHF', 'NZDCAD',
  // Exotics
  'USDTRY', 'USDZAR', 'USDMXN', 'USDSEK', 'USDNOK', 'USDSGD', 'USDHKD',
  'EURTRY', 'EURZAR', 'GBPTRY',
  // Metals / indices / crypto
  'XAUUSD', 'XAGUSD', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100', 'JP225',
  'BTCUSD', 'ETHUSD', 'BNBUSD'
];

const DIRECTION_MAP = {
  BUY: 'BUY',
  SELL: 'SELL',
  LONG: 'BUY',
  SHORT: 'SELL'
};

function normalizeText(text) {
  return (text || '').toUpperCase();
}

function parseNumber(input) {
  if (!input) return null;
  const normalized = input.replace(/,/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractFirstMatch(pattern, text) {
  const match = text.match(pattern);
  return match ? match[1] : null;
}

function detectPair(text) {
  const upper = normalizeText(text);
  for (const pair of PAIRS) {
    const pattern = new RegExp(`\\b${pair}\\b`, 'i');
    if (pattern.test(upper)) return pair;
  }
  return null;
}

function detectDirection(text) {
  const match = normalizeText(text).match(/\b(BUY|SELL|LONG|SHORT)\b/i);
  if (!match) return null;
  return DIRECTION_MAP[match[1].toUpperCase()] || null;
}

function parseSignal(text) {
  const raw = text || '';
  const upper = normalizeText(raw);

  const pair = detectPair(upper);
  const direction = detectDirection(upper);

  const entryRaw = extractFirstMatch(/(?:ENTRY|ENT|OPEN|@)\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper);
  const tp1Raw = extractFirstMatch(/\bTP\s*1\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper)
    || extractFirstMatch(/\bTP1\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper)
    || extractFirstMatch(/\bTP\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper);
  const tp2Raw = extractFirstMatch(/\bTP\s*2\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper)
    || extractFirstMatch(/\bTP2\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper);
  const tp3Raw = extractFirstMatch(/\bTP\s*3\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper)
    || extractFirstMatch(/\bTP3\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper);
  const slRaw = extractFirstMatch(/\bSL\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper)
    || extractFirstMatch(/\bSTOP\s*LOSS\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)?)/i, upper);

  const entry = parseNumber(entryRaw);
  const tp1 = parseNumber(tp1Raw);
  const tp2 = parseNumber(tp2Raw);
  const tp3 = parseNumber(tp3Raw);
  const sl = parseNumber(slRaw);

  const hasSignalCore = Boolean(pair && direction);
  const hasPriceTarget = [entry, tp1, tp2, tp3, sl].some((v) => v !== null);
  const isSignal = hasSignalCore && hasPriceTarget;

  return {
    isSignal,
    pair,
    direction,
    entry,
    tp1,
    tp2,
    tp3,
    sl
  };
}

module.exports = {
  PAIRS,
  parseSignal
};
