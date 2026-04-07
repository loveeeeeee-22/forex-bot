function asMoney(value) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function asPips(value) {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(1)} pips`;
}

function safeUsername(user) {
  return user && user.username ? `@${user.username}` : '(unknown)';
}

function computeBestPair(pairs) {
  const entries = Object.entries(pairs || {});
  if (!entries.length) return null;
  entries.sort((a, b) => (b[1].dollars || 0) - (a[1].dollars || 0));
  return { pair: entries[0][0], ...entries[0][1] };
}

function computeTopPairs(pairs) {
  const entries = Object.entries(pairs || {});
  entries.sort((a, b) => (b[1].dollars || 0) - (a[1].dollars || 0));
  return entries.slice(0, 3);
}

function formatUserStatsHtml(title, user) {
  if (!user) {
    return 'No stats found for that user yet.';
  }

  const wins = user.wins || 0;
  const losses = user.losses || 0;
  const trades = user.trades || 0;
  const winRate = trades ? ((wins / trades) * 100).toFixed(1) : '0.0';
  const bestPair = computeBestPair(user.pairs || {});
  const topPairs = computeTopPairs(user.pairs || {});

  const lines = [
    `📊 <b>${title}</b>`,
    `👤 ${safeUsername(user)}`,
    '━━━━━━━━━━━━━━━━━━━━',
    `💰 <b>Total P&L:</b> ${asMoney(user.totalDollars || 0)}`,
    user.totalPips ? `📏 <b>Total Pips:</b> ${asPips(user.totalPips)}` : '📏 <b>Total Pips:</b> N/A',
    `📈 <b>Trades:</b> ${trades} | ✅ ${wins} | ❌ ${losses}`,
    `🎯 <b>Win Rate:</b> ${winRate}%`,
    bestPair ? `🏆 <b>Best Pair:</b> ${bestPair.pair} (${asMoney(bestPair.dollars || 0)})` : '🏆 <b>Best Pair:</b> N/A'
  ];

  if (topPairs.length) {
    lines.push('');
    lines.push('🔝 <b>Top 3 Pairs</b>');
    topPairs.forEach(([pair, data], idx) => {
      lines.push(`${idx + 1}. ${pair} | ${asMoney(data.dollars || 0)} | ✅${data.wins || 0}/❌${data.losses || 0}`);
    });
  }

  return lines.join('\n');
}

function formatLeaderboardHtml(periodLabel, rows) {
  const lines = [
    `🏅 <b>Leaderboard (${periodLabel})</b>`,
    '━━━━━━━━━━━━━━━━━━━━'
  ];

  if (!rows.length) {
    lines.push('No trades recorded in this period yet.');
    return lines.join('\n');
  }

  rows.forEach((row, idx) => {
    const trades = row.trades || 0;
    const winRate = trades ? ((row.wins / trades) * 100).toFixed(1) : '0.0';
    lines.push(
      `${idx + 1}. @${row.username || row._id} | ${asMoney(row.totalDollars || 0)} | ✅${row.wins || 0}/❌${row.losses || 0} | ${winRate}%`
    );
  });

  return lines.join('\n');
}

module.exports = {
  asMoney,
  asPips,
  formatUserStatsHtml,
  formatLeaderboardHtml
};
