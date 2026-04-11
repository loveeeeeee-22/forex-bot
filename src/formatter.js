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

function formatPlainMoney(value) {
  return `$${Math.abs(Number(value) || 0).toFixed(2)}`;
}

function formatSignedMoney(value) {
  const n = Number(value) || 0;
  const sign = n >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function formatSignedPercent(value) {
  const n = Number(value) || 0;
  const sign = n >= 0 ? '+' : '-';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

function formatChallengeStatsHtml(doc) {
  if (!doc) return null;

  const start = doc.startingBalance || 0;
  const current = doc.currentBalance ?? start;
  const gain = current - start;
  const pctNum = start > 0 ? (gain / start) * 100 : 0;
  const wins = doc.wins || 0;
  const losses = doc.losses || 0;
  const trades = doc.trades || 0;
  const winRate = trades ? ((wins / trades) * 100).toFixed(1) : '0.0';
  const totalPips = doc.totalPips || 0;
  const pipsSign = totalPips >= 0 ? '+' : '';
  const uname = doc.username ? `@${doc.username}` : '(unknown)';

  return [
    `🏆 <b>Challenge Stats — ${uname}</b>`,
    '━━━━━━━━━━━━━━━━━━━━',
    `📊 Account: <b>${escapeHtml(doc.accountUsername || '')}</b>`,
    `💰 Starting Balance: <b>${formatPlainMoney(start)}</b>`,
    `💵 Current Balance: <b>${formatPlainMoney(current)}</b>`,
    `💸 Total Withdrawn (lifetime): <b>${formatPlainMoney(doc.totalWithdrawn || 0)}</b>`,
    `📈 Gain/Loss: <b>${formatSignedMoney(gain)} (${formatSignedPercent(pctNum)})</b>`,
    `🎯 Total Pips: <b>${pipsSign}${Math.abs(totalPips).toFixed(1)}</b>`,
    `✅ Wins: <b>${wins}</b>`,
    `❌ Losses: <b>${losses}</b>`,
    `🎯 Win Rate: <b>${winRate}%</b>`,
    `🔢 Total Trades: <b>${trades}</b>`,
    '━━━━━━━━━━━━━━━━━━━━'
  ].join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatChallengeLeaderboardHtml(rows) {
  const lines = ['🏆 <b>Challenge Leaderboard</b>', '━━━━━━━━━━━━━━━━━━━━'];

  if (!rows.length) {
    lines.push('No challenge participants yet.');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    return lines.join('\n');
  }

  const medals = ['🥇', '🥈', '🥉'];
  rows.forEach((row, idx) => {
    const medal = medals[idx] || `${idx + 1}.`;
    const pctStr = `${row.pctGain >= 0 ? '+' : ''}${row.pctGain.toFixed(2)}%`;
    const bal = formatPlainMoney(row.currentBalance);
    lines.push(`${medal} @${row.username || row.userId} — ${pctStr} (${bal})`);
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

module.exports = {
  asMoney,
  asPips,
  formatUserStatsHtml,
  formatLeaderboardHtml,
  formatChallengeStatsHtml,
  formatChallengeLeaderboardHtml,
  escapeHtml
};
