# Forex Bot

A Telegram bot for managing forex trading signals, P&L tracking, and group statistics in trading communities.

## Features

- **Signal Parsing** — Automatically formats trading signals (ENTRY, TP, SL) into clean HTML messages
- **P&L Tracking** — Records and reports trade results with profit/loss amounts
- **Stats & Leaderboards** — Track individual and group performance over daily, weekly, and monthly periods
- **Challenge Mode** — Run trading challenges with account balance tracking and % gain leaderboards
- **Admin Controls** — Cancel trades, reset stats, view member performance
- **MongoDB Persistence** — All data stored in MongoDB for reliability

## Commands

| Command | Description |
|---------|-------------|
| `/mystats` | View your personal stats |
| `/stats @username` | View stats for a member |
| `/leaderboard` | Weekly leaderboard (default) |
| `/leaderboard day` | Last 24h leaderboard |
| `/leaderboard month` | Last 30d leaderboard |
| `/canceltrade` | Cancel your last trade |
| `/canceltrade @username` | Admin: cancel member's last trade |
| `/resetstats @username` | Admin: reset user stats |
| `/resetstats all` | Admin: reset all group stats |
| `/help` | Show all commands |

### Challenge Commands

| Command | Description |
|---------|-------------|
| `/challenge` | Show challenge help & registration format |
| `/challengestats` | Your challenge stats |
| `/challengestats @username` | Challenge stats for a member |
| `/challengeleaderboard` | % gain leaderboard |
| `/cancelchallenge` | End your challenge |
| `/withdraw <amount>` | Withdraw from challenge balance |

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your credentials:
   - `BOT_TOKEN` — Get from @BotFather on Telegram
   - `MONGODB_URI` — MongoDB connection string

3. **Run locally:**
   ```bash
   npm run dev   # with nodemon
   npm start     # production
   ```

## Signal Format

Post signals in this format:
```
ENTRY: BUY (or SELL)
PAIR: EURUSD
TP: 1.0850
SL: 1.0800
```

For challenge signals, include the word "challenge" in the message.

## P&L Format

Post results like:
```
TP HIT
PAIR: EURUSD
+: +$50 (or SLHIT for losses)
```

For challenge results, include "challenge" in the message.

## Deployment

Deployable on Railway, Render, or any Node.js hosting platform. The `railway.toml` file is included for Railway deployment.

## Tech Stack

- Node.js
- node-telegram-bot-api
- MongoDB
- dotenv