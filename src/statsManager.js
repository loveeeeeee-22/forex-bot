function normalizeUsername(username, fallbackUserId) {
  if (username && username.trim()) return username.trim();
  return `user_${fallbackUserId}`;
}

class StatsManager {
  constructor(db) {
    this.db = db;
    this.users = db.collection('users');
    this.trades = db.collection('trades');
  }

  async init() {
    await this.users.createIndex({ chatId: 1, userId: 1 }, { unique: true });
    await this.users.createIndex({ chatId: 1, username: 1 });
    await this.trades.createIndex({ chatId: 1, userId: 1, timestamp: -1 });
    await this.trades.createIndex({ chatId: 1, timestamp: -1 });
  }

  async ensureUser(chatId, userId, username) {
    const normalized = normalizeUsername(username, userId);
    await this.users.updateOne(
      { chatId, userId },
      {
        $set: {
          username: normalized
        },
        $setOnInsert: {
          chatId,
          userId,
          totalDollars: 0,
          totalPips: 0,
          trades: 0,
          wins: 0,
          losses: 0,
          pairs: {}
        }
      },
      { upsert: true }
    );
  }

  async recordTrade(chatId, userId, username, tradeData) {
    await this.ensureUser(chatId, userId, username);

    const trade = {
      chatId,
      userId,
      username: normalizeUsername(username, userId),
      pair: tradeData.pair,
      dollars: tradeData.dollars,
      pips: tradeData.pips,
      isWin: tradeData.isWin,
      timestamp: Date.now()
    };

    const pairPath = `pairs.${tradeData.pair}`;

    // Only $inc — do not $setOnInsert the same pair path (MongoDB forbids
    // $setOnInsert on pairs.X with $inc on pairs.X.* in one update).
    await this.users.updateOne(
      { chatId, userId },
      {
        $inc: {
          totalDollars: tradeData.dollars,
          totalPips: tradeData.pips || 0,
          trades: 1,
          wins: tradeData.isWin ? 1 : 0,
          losses: tradeData.isWin ? 0 : 1,
          [`${pairPath}.dollars`]: tradeData.dollars,
          [`${pairPath}.pips`]: tradeData.pips || 0,
          [`${pairPath}.wins`]: tradeData.isWin ? 1 : 0,
          [`${pairPath}.losses`]: tradeData.isWin ? 0 : 1
        }
      }
    );

    await this.trades.insertOne(trade);
    return trade;
  }

  async getUserStats(chatId, userId) {
    return this.users.findOne({ chatId, userId });
  }

  async getUserStatsByUsername(chatId, username) {
    if (!username) return null;
    const normalized = username.replace('@', '');
    return this.users.findOne({ chatId, username: normalized });
  }

  async getLeaderboard(chatId, period = 'week') {
    const now = Date.now();
    let from = now - 7 * 24 * 60 * 60 * 1000;

    if (period === 'day') from = now - 24 * 60 * 60 * 1000;
    if (period === 'month') from = now - 30 * 24 * 60 * 60 * 1000;

    const pipeline = [
      { $match: { chatId, timestamp: { $gte: from } } },
      {
        $group: {
          _id: '$userId',
          username: { $last: '$username' },
          totalDollars: { $sum: '$dollars' },
          wins: { $sum: { $cond: ['$isWin', 1, 0] } },
          losses: { $sum: { $cond: ['$isWin', 0, 1] } },
          trades: { $sum: 1 }
        }
      },
      { $sort: { totalDollars: -1 } },
      { $limit: 10 }
    ];

    return this.trades.aggregate(pipeline).toArray();
  }

  async cancelLastTrade(chatId, requester, targetUserId, targetUsername) {
    const latest = await this.trades.findOne(
      { chatId, userId: targetUserId },
      { sort: { timestamp: -1 } }
    );

    if (!latest) {
      return { ok: false, reason: 'No trades found.' };
    }

    await this.trades.deleteOne({ _id: latest._id });

    const pairPath = `pairs.${latest.pair}`;
    await this.users.updateOne(
      { chatId, userId: targetUserId },
      {
        $inc: {
          totalDollars: -latest.dollars,
          totalPips: -(latest.pips || 0),
          trades: -1,
          wins: latest.isWin ? -1 : 0,
          losses: latest.isWin ? 0 : -1,
          [`${pairPath}.dollars`]: -latest.dollars,
          [`${pairPath}.pips`]: -(latest.pips || 0),
          [`${pairPath}.wins`]: latest.isWin ? -1 : 0,
          [`${pairPath}.losses`]: latest.isWin ? 0 : -1
        }
      }
    );

    return {
      ok: true,
      trade: latest,
      targetUsername: normalizeUsername(targetUsername, targetUserId),
      requester
    };
  }

  async resetUserStats(chatId, userId) {
    await this.users.deleteOne({ chatId, userId });
    await this.trades.deleteMany({ chatId, userId });
  }

  async resetAllStats(chatId) {
    await this.users.deleteMany({ chatId });
    await this.trades.deleteMany({ chatId });
  }
}

module.exports = StatsManager;
