const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const { parseSignal } = require('./src/signalParser');
const { formatSignalHtml } = require('./src/signalFormatter');
const { parsePnlMessage } = require('./src/pnlParser');
const StatsManager = require('./src/statsManager');
const LiveTracker = require('./src/liveTracker');
const {
  asMoney,
  asPips,
  formatUserStatsHtml,
  formatLeaderboardHtml
} = require('./src/formatter');
const { MongoClient } = require('mongodb');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

if (!BOT_TOKEN || !MONGODB_URI) {
  console.error('Missing BOT_TOKEN or MONGODB_URI');
  process.exit(1);
}

// polling: false until webhook is cleared — avoids webhook + getUpdates clash
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let statsManager;
let liveTracker;
let dbReady = false;

async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      tls: true,
      tlsAllowInvalidCertificates: true
    });
    await client.connect();
    const db = client.db('forex_bot');
    statsManager = new StatsManager(db);
    await statsManager.init();
    liveTracker = new LiveTracker(db);
    await liveTracker.init();
    dbReady = true;
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB failed, retrying in 10s:', err.message);
    setTimeout(connectDB, 10000);
  }
}

connectDB();

function isGroupChat(msg) {
  return (
    msg &&
    msg.chat &&
    ['group', 'supergroup', 'private'].includes(msg.chat.type)
  );
}

function normalizeUser(msgUser) {
  return {
    userId: String(msgUser.id),
    username: msgUser.username || `user_${msgUser.id}`
  };
}

async function safeSend(chatId, text, opts = {}) {
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts });
  } catch (err) {
    console.error('Failed to send message:', err.message);
  }
}

async function isAdmin(chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    console.error('Admin check failed:', err.message);
    return false;
  }
}

async function resolveResultOwner(msg) {
  const sender = normalizeUser(msg.from);
  if (!msg.reply_to_message) return sender;

  const repliedTo = msg.reply_to_message;
  if (repliedTo.from && repliedTo.from.is_bot) {
    return sender;
  }

  if (repliedTo.from) {
    return normalizeUser(repliedTo.from);
  }

  return sender;
}

function extractMention(text) {
  const match = (text || '').match(/@([A-Za-z0-9_]{3,32})/);
  return match ? match[1] : null;
}

function parseLeaderboardPeriod(text) {
  const lower = (text || '').toLowerCase().trim();
  if (lower === '/leaderboard day') return { key: 'day', label: '24H' };
  if (lower === '/leaderboard month') return { key: 'month', label: '30D' };
  return { key: 'week', label: '7D' };
}

async function handleSignalMessage(msg, isEdit = false) {
  if (!msg.text || !isGroupChat(msg)) return;

  const signal = parseSignal(msg.text);
  if (!signal.isSignal) return;

  const owner = normalizeUser(msg.from);
  const html = formatSignalHtml(signal, { isUpdate: isEdit });

  await safeSend(msg.chat.id, html, {
    reply_to_message_id: msg.message_id
  });

  if (dbReady && liveTracker) {
    await liveTracker.saveOpenTrade(
      String(msg.chat.id),
      String(msg.message_id),
      owner.userId,
      owner.username,
      signal
    );
  }
}

async function handlePnlResult(msg) {
  if (!msg.text || !isGroupChat(msg)) return false;
  if (!dbReady || !statsManager) return false;

  const parsed = parsePnlMessage(msg.text);
  if (!parsed.isResult) return false;

  const chatId = String(msg.chat.id);
  const owner = await resolveResultOwner(msg);

  await statsManager.recordTrade(chatId, owner.userId, owner.username, {
    pair: parsed.pair,
    dollars: parsed.dollars,
    pips: parsed.pips,
    isWin: parsed.isWin
  });

  const pipsText = parsed.pips !== null ? ` (${asPips(parsed.pips)})` : '';
  if (parsed.isWin) {
    await safeSend(
      msg.chat.id,
      `🔥🔥🔥 @${owner.username} CLOSED IN PROFIT! 🔥🔥🔥\n💰 ${asMoney(parsed.dollars)}${pipsText} on <b>${parsed.pair}</b>\n💵💵💵 GET IN!!! 💵💵💵`,
      { reply_to_message_id: msg.message_id }
    );
  } else {
    await safeSend(
      msg.chat.id,
      `😮 @${owner.username} hit stop loss.\n📉 ${asMoney(parsed.dollars)} on <b>${parsed.pair}</b>\n💪 Shake it off. Next one is a winner.`,
      { reply_to_message_id: msg.message_id }
    );
  }

  return true;
}

async function handleMyStats(msg) {
  if (!dbReady || !statsManager) {
    await safeSend(msg.chat.id, 'Database is still connecting. Try again in a moment.', {
      reply_to_message_id: msg.message_id
    });
    return;
  }
  const chatId = String(msg.chat.id);
  const me = normalizeUser(msg.from);
  const stats = await statsManager.getUserStats(chatId, me.userId);
  const html = formatUserStatsHtml('My Stats', stats);
  await safeSend(msg.chat.id, html, { reply_to_message_id: msg.message_id });
}

async function handleStats(msg) {
  if (!dbReady || !statsManager) {
    await safeSend(msg.chat.id, 'Database is still connecting. Try again in a moment.', {
      reply_to_message_id: msg.message_id
    });
    return;
  }
  const chatId = String(msg.chat.id);
  const mention = extractMention(msg.text);

  if (!mention) {
    await safeSend(msg.chat.id, 'Usage: <code>/stats @username</code>', {
      reply_to_message_id: msg.message_id
    });
    return;
  }

  const stats = await statsManager.getUserStatsByUsername(chatId, mention);
  const html = formatUserStatsHtml(`Stats for @${mention}`, stats);
  await safeSend(msg.chat.id, html, { reply_to_message_id: msg.message_id });
}

async function handleLeaderboard(msg) {
  if (!dbReady || !statsManager) {
    await safeSend(msg.chat.id, 'Database is still connecting. Try again in a moment.', {
      reply_to_message_id: msg.message_id
    });
    return;
  }
  const chatId = String(msg.chat.id);
  const period = parseLeaderboardPeriod(msg.text);
  const rows = await statsManager.getLeaderboard(chatId, period.key);
  const html = formatLeaderboardHtml(period.label, rows);
  await safeSend(msg.chat.id, html, { reply_to_message_id: msg.message_id });
}

async function handleCancelTrade(msg) {
  if (!dbReady || !statsManager) {
    await safeSend(msg.chat.id, 'Database is still connecting. Try again in a moment.', {
      reply_to_message_id: msg.message_id
    });
    return;
  }
  const chatId = String(msg.chat.id);
  const sender = normalizeUser(msg.from);
  const mention = extractMention(msg.text);

  let targetUserId = sender.userId;
  let targetUsername = sender.username;

  if (mention) {
    const admin = await isAdmin(msg.chat.id, msg.from.id);
    if (!admin) {
      await safeSend(msg.chat.id, 'Only admins can cancel another user\'s trade.', {
        reply_to_message_id: msg.message_id
      });
      return;
    }

    const targetStats = await statsManager.getUserStatsByUsername(chatId, mention);
    if (!targetStats) {
      await safeSend(msg.chat.id, `Could not find @${mention} in this group's stats.`, {
        reply_to_message_id: msg.message_id
      });
      return;
    }

    targetUserId = targetStats.userId;
    targetUsername = targetStats.username;
  }

  const result = await statsManager.cancelLastTrade(chatId, sender, targetUserId, targetUsername);
  if (!result.ok) {
    await safeSend(msg.chat.id, result.reason, { reply_to_message_id: msg.message_id });
    return;
  }

  await safeSend(
    msg.chat.id,
    `✅ Cancelled last trade for @${targetUsername}. Reversed ${asMoney(result.trade.dollars)} on <b>${result.trade.pair}</b>.`,
    { reply_to_message_id: msg.message_id }
  );
}

async function handleResetStats(msg) {
  if (!dbReady || !statsManager) {
    await safeSend(msg.chat.id, 'Database is still connecting. Try again in a moment.', {
      reply_to_message_id: msg.message_id
    });
    return;
  }
  const chatId = String(msg.chat.id);
  const admin = await isAdmin(msg.chat.id, msg.from.id);
  if (!admin) {
    await safeSend(msg.chat.id, 'Only admins can use /resetstats.', {
      reply_to_message_id: msg.message_id
    });
    return;
  }

  const lower = (msg.text || '').toLowerCase();
  if (/\/resetstats\s+all/.test(lower)) {
    await statsManager.resetAllStats(chatId);
    await safeSend(msg.chat.id, '🧹 Reset complete. All group stats were wiped.', {
      reply_to_message_id: msg.message_id
    });
    return;
  }

  const mention = extractMention(msg.text);
  if (!mention) {
    await safeSend(msg.chat.id, 'Usage: <code>/resetstats @username</code> or <code>/resetstats all</code>', {
      reply_to_message_id: msg.message_id
    });
    return;
  }

  const targetStats = await statsManager.getUserStatsByUsername(chatId, mention);
  if (!targetStats) {
    await safeSend(msg.chat.id, `Could not find @${mention} in this group's stats.`, {
      reply_to_message_id: msg.message_id
    });
    return;
  }

  await statsManager.resetUserStats(chatId, targetStats.userId);
  await safeSend(msg.chat.id, `🧹 Reset stats for @${targetStats.username}.`, {
    reply_to_message_id: msg.message_id
  });
}

async function handleHelp(msg) {
  const help = [
    '📘 <b>Forex Bot Commands</b>',
    '━━━━━━━━━━━━━━━━━━━━',
    '<code>/mystats</code> - Show your personal stats',
    '<code>/stats @username</code> - Show stats for a member',
    '<code>/leaderboard</code> - Weekly leaderboard (default)',
    '<code>/leaderboard day</code> - Last 24h leaderboard',
    '<code>/leaderboard week</code> - Last 7d leaderboard',
    '<code>/leaderboard month</code> - Last 30d leaderboard',
    '<code>/canceltrade</code> - Cancel your last trade',
    '<code>/canceltrade @username</code> - Admin: cancel member last trade',
    '<code>/resetstats @username</code> - Admin: reset one user stats',
    '<code>/resetstats all</code> - Admin: reset all group stats',
    '<code>/help</code> - Show this help'
  ].join('\n');

  await safeSend(msg.chat.id, help, { reply_to_message_id: msg.message_id });
}

async function handleCommand(msg) {
  const text = (msg.text || '').trim();

  try {
    if (/^\/mystats(?:@\w+)?$/i.test(text)) return handleMyStats(msg);
    if (/^\/stats(?:@\w+)?\b/i.test(text)) return handleStats(msg);
    if (/^\/leaderboard(?:@\w+)?(?:\s+\w+)?$/i.test(text)) return handleLeaderboard(msg);
    if (/^\/canceltrade(?:@\w+)?\b/i.test(text)) return handleCancelTrade(msg);
    if (/^\/resetstats(?:@\w+)?\b/i.test(text)) return handleResetStats(msg);
    if (/^\/help(?:@\w+)?$/i.test(text)) return handleHelp(msg);
  } catch (err) {
    console.error('Command handler error:', err);
    await safeSend(msg.chat.id, 'Something went wrong while handling that command. Please try again.');
  }
}

bot.on('message', async (msg) => {
  console.log('[message] received:', JSON.stringify({
    chatType: msg?.chat?.type,
    chatId: msg?.chat?.id,
    text: msg?.text?.substring(0, 50),
    from: msg?.from?.username
  }));

  if (!msg || !msg.text) return;

  try {
    if (msg.text.startsWith('/')) {
      await handleCommand(msg);
      return;
    }

    const handledResult = await handlePnlResult(msg);
    if (handledResult) return;

    await handleSignalMessage(msg, false);
  } catch (err) {
    console.error('Message handling error:', err);
  }
});

bot.on('edited_message', async (msg) => {
  console.log('[edited_message] received:', msg?.chat?.type);
  if (!msg || !msg.text) return;
  try {
    if (msg.text.startsWith('/')) return;
    await handleSignalMessage(msg, true);
  } catch (err) {
    console.error('Edited message handling error:', err);
  }
});

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
  if (String(err.message).includes('409')) {
    console.error(
      'Hint: only ONE process may poll this bot. Stop local runs, set Railway replicas to 1, and remove duplicate deploys.'
    );
  }
});

async function startPollingAfterWebhookClear() {
  try {
    await bot.deleteWebHook({ drop_pending_updates: false });
    console.log('Telegram webhook cleared (if it was set).');
  } catch (err) {
    console.error('deleteWebHook:', err.message);
  }
  bot.startPolling();
  console.log('ForexBot is running (polling)...');
}

startPollingAfterWebhookClear();
