class LiveTracker {
  constructor(db) {
    this.openTrades = db.collection('open_trades');
  }

  async init() {
    await this.openTrades.createIndex({ chatId: 1, messageId: 1 }, { unique: true });
    await this.openTrades.createIndex({ chatId: 1, userId: 1, createdAt: -1 });
  }

  async saveOpenTrade(chatId, messageId, userId, username, signal) {
    await this.openTrades.updateOne(
      { chatId, messageId },
      {
        $set: {
          chatId,
          messageId,
          userId,
          username,
          signal,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      { upsert: true }
    );
  }

  async removeTradeByMessage(chatId, messageId) {
    await this.openTrades.deleteOne({ chatId, messageId });
  }
}

module.exports = LiveTracker;
