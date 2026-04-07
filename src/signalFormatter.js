function fmt(value) {
  if (value === null || value === undefined) return null;
  const str = Number.isInteger(value) ? String(value) : String(value);
  return str;
}

function formatSignalHtml(signal, options = {}) {
  const header = options.isUpdate ? '✏️ <b>Signal updated:</b>\n\n' : '';
  const dirEmoji = signal.direction === 'BUY' ? '🟢' : '🔴';

  const lines = [
    `${header}🥇 <b>${signal.pair}</b>  ${dirEmoji} <b>${signal.direction}</b>`,
    '━━━━━━━━━━━━━━━━━━━━'
  ];

  if (signal.entry !== null) lines.push(`📍 <b>Entry:</b>  ${fmt(signal.entry)}`);
  if (signal.tp1 !== null) lines.push(`🎯 <b>TP1:</b>  ${fmt(signal.tp1)}`);
  if (signal.tp2 !== null) lines.push(`🎯 <b>TP2:</b>  ${fmt(signal.tp2)}`);
  if (signal.tp3 !== null) lines.push(`🎯 <b>TP3:</b>  ${fmt(signal.tp3)}`);
  if (signal.sl !== null) lines.push(`🛑 <b>SL:</b>  ${fmt(signal.sl)}`);

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('⚡ Manage your risk. Use proper lot sizing.');

  return lines.join('\n');
}

module.exports = {
  formatSignalHtml
};
