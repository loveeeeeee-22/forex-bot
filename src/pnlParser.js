const { PAIRS } = require('./signalParser');

function detectPair(text) {
  const upper = (text || '').toUpperCase();
  for (const pair of PAIRS) {
    if (new RegExp(`\\b${pair}\\b`, 'i').test(upper)) {
      return pair;
    }
  }
  return null;
}

function parsePnlMessage(text) {
  const upper = (text || '').toUpperCase();

  const sideMatch = upper.match(/\b(TP|SL)\b/i);
  const dollarsMatch = upper.match(/\$\s*([0-9]+(?:[.,][0-9]+)?)/i);
  const pipsMatch = upper.match(/([+\-]?\d+(?:[.,]\d+)?)\s*PIPS?\b/i);
  const pair = detectPair(upper);

  if (!sideMatch || !dollarsMatch || !pair) {
    return { isResult: false };
  }

  const side = sideMatch[1].toUpperCase();
  const dollarsAbs = Number(dollarsMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(dollarsAbs)) return { isResult: false };

  const isWin = side === 'TP';
  const dollars = isWin ? Math.abs(dollarsAbs) : -Math.abs(dollarsAbs);

  let pips = null;
  if (pipsMatch) {
    const parsed = Number(pipsMatch[1].replace(/,/g, ''));
    if (Number.isFinite(parsed)) {
      pips = isWin ? Math.abs(parsed) : -Math.abs(parsed);
    }
  }

  return {
    isResult: true,
    pair,
    isWin,
    dollars,
    pips
  };
}

module.exports = {
  parsePnlMessage
};
