function normalizeUsername(username, fallbackUserId) {
  if (username && username.trim()) return username.trim();
  return `user_${fallbackUserId}`;
}

class ChallengeManager {
  constructor(db) {
    this.db = db;
    this.challenges = db.collection('challenges');
    this.challengeTrades = db.collection('challenge_trades');
    this.openChallengeTrades = db.collection('challenge_open_trades');
  }

  async init() {
    await this.challenges.createIndex({ chatId: 1, userId: 1 }, { unique: true });
    await this.challenges.createIndex({ chatId: 1, username: 1 });
    await this.challengeTrades.createIndex({ chatId: 1, userId: 1, timestamp: -1 });
    await this.challengeTrades.createIndex({ chatId: 1, timestamp: -1 });
    await this.openChallengeTrades.createIndex({ chatId: 1, messageId: 1 }, { unique: true });
    await this.openChallengeTrades.createIndex({ chatId: 1, userId: 1, createdAt: -1 });
  }

  async registerChallenge(chatId, userId, username, accountUsername, startingBalance) {
    const now = Date.now();
    const normalizedUser = normalizeUsername(username, userId);
    const acct = (accountUsername || '').trim();
    const start = Number(startingBalance);
    if (!Number.isFinite(start) || start < 0) {
      throw new Error('Invalid starting balance');
    }

    await this.challenges.updateOne(
      { chatId, userId },
      {
        $set: {
          username: normalizedUser,
          accountUsername: acct,
          startingBalance: start,
          currentBalance: start,
          updatedAt: now
        },
        $setOnInsert: {
          chatId,
          userId,
          totalPips: 0,
          wins: 0,
          losses: 0,
          trades: 0,
          createdAt: now
        }
      },
      { upsert: true }
    );
  }

  async recordChallengeTrade(chatId, userId, username, accountUsername, pair, dollars, pips, isWin) {
    const now = Date.now();
    const trade = {
      chatId,
      userId,
      username: normalizeUsername(username, userId),
      accountUsername: (accountUsername || '').trim(),
      pair,
      dollars,
      pips: pips == null ? null : pips,
      isWin,
      timestamp: now
    };

    await this.challengeTrades.insertOne(trade);

    const balanceDelta = dollars;
    const pipsInc = pips == null ? 0 : pips;

    await this.challenges.updateOne(
      { chatId, userId },
      {
        $inc: {
          currentBalance: balanceDelta,
          totalPips: pipsInc,
          trades: 1,
          wins: isWin ? 1 : 0,
          losses: isWin ? 0 : 1
        },
        $set: { updatedAt: now }
      }
    );

    return trade;
  }

  async getChallengeStats(chatId, userId) {
    return this.challenges.findOne({ chatId, userId });
  }

  async getChallengeStatsByUsername(chatId, username) {
    if (!username) return null;
    const normalized = username.replace('@', '').trim();
    return this.challenges.findOne({ chatId, username: normalized });
  }

  async getChallengeLeaderboard(chatId) {
    const rows = await this.challenges.find({ chatId }).toArray();
    return rows
      .map((doc) => {
        const start = doc.startingBalance || 0;
        const current = doc.currentBalance ?? start;
        let pct = 0;
        if (start > 0) {
          pct = ((current - start) / start) * 100;
        }
        return {
          userId: doc.userId,
          username: doc.username,
          accountUsername: doc.accountUsername,
          startingBalance: start,
          currentBalance: current,
          pctGain: pct
        };
      })
      .sort((a, b) => {
        if (b.pctGain !== a.pctGain) return b.pctGain - a.pctGain;
        return (b.currentBalance || 0) - (a.currentBalance || 0);
      });
  }

  async saveOpenChallengeTrade(chatId, messageId, userId, username, signal) {
    const now = Date.now();
    await this.openChallengeTrades.updateOne(
      { chatId, messageId },
      {
        $set: {
          chatId,
          messageId,
          userId,
          username: normalizeUsername(username, userId),
          signal,
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true }
    );
  }
}

module.exports = ChallengeManager;
