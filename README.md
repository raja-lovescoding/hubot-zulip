# hubot-zulip

A [Hubot](https://hubot.github.com/) adapter for [Zulip](https://zulip.com/).

> **Requires Hubot ≥ 11 and Node.js ≥ 18.**  
> Hubot v11 dropped CoffeeScript and moved to ESM. This adapter has been
> rewritten accordingly. If you are running an older Hubot (≤ 3.5), please
> pin `hubot-zulip@0.1.0` and note that it is **no longer maintained**.

---

## Installation

In your Hubot's directory, run:

```bash
npm install hubot-zulip
```

---

## Configuration

Create a **bot account** in your Zulip organization
([Settings → Bots](https://zulip.com/#settings/your-bots)) and note its
**email address** and **API key**.

Set the following environment variables before starting Hubot:

| Variable | Required | Description |
|---|---|---|
| `HUBOT_ZULIP_BOT` | ✅ | Bot account email address |
| `HUBOT_ZULIP_API_KEY` | ✅ | Bot account API key |
| `HUBOT_ZULIP_SITE` | — | Your Zulip server URL (default: `https://api.zulip.com`) |
| `HUBOT_ZULIP_ONLY_SUBSCRIBED_STREAMS` | — | Set to any value to restrict the bot to streams it is subscribed to (default: listen on all public streams) |

---

## Running Hubot

**Locally against Zulip Cloud:**
```bash
HUBOT_ZULIP_BOT=hubot-bot@example.com \
HUBOT_ZULIP_API_KEY=your_key \
npx hubot -a zulip
```

**Against a self-hosted Zulip server:**
```bash
HUBOT_ZULIP_SITE=https://zulip.example.com \
HUBOT_ZULIP_BOT=hubot-bot@example.com \
HUBOT_ZULIP_API_KEY=your_key \
npx hubot -a zulip
```

**On Heroku**, set the config vars and update your `Procfile` to use `-a zulip`:
```bash
heroku config:set HUBOT_ZULIP_SITE=https://yourorg.zulipchat.com
heroku config:set HUBOT_ZULIP_BOT=hubot-bot@example.com
heroku config:set HUBOT_ZULIP_API_KEY=your_key
```

---

## Room format

Hubot identifies rooms using strings of the form:

- `stream/<channel name>/<topic>` — a channel message thread
- `pm/<user@email.com>` — a direct message

You can use these in scripts to target specific conversations:

```js
// Send a message to a specific channel and topic
robot.messageRoom('stream/general/announcements', 'Hello, world!')

// Send a DM
robot.messageRoom('pm/alice@example.com', 'Hey Alice!')
```

---

## Changelog

### 1.0.0
- Rewrote adapter from CoffeeScript to modern ESM JavaScript
- Upgraded to Hubot ≥ 11 API (`adapter.mjs`, `export default { use }`)
- Switched from the deprecated `zulip` npm package to `zulip-js`
- Replaced polling via `registerEventQueue` (old `zulip` client) with the
  `zulip-js` `events.retrieve` long-polling loop
- Added automatic retry with exponential back-off on transient errors
- Added automatic queue re-registration on queue expiry
- Updated `package.json`: `"type": "module"`, requires Node ≥ 18

### 0.1.0 (legacy — unmaintained)
- Original CoffeeScript adapter, compatible with Hubot ≤ 3.5