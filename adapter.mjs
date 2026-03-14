import { Adapter, TextMessage } from 'hubot'
import zulip from 'zulip-js'

/**
 * Parse a Hubot room string into Zulip message parameters.
 *
 * Hubot represents a room as "<type>/<to>/<subject>" for channel messages
 * or "pm/<email>" for direct messages.
 *
 * Examples:
 *   "stream/general/greetings"  → { type: 'stream', to: 'general', topic: 'greetings' }
 *   "pm/user@example.com"       → { type: 'direct', to: ['user@example.com'] }
 */
function parseRoom(room) {

  const parts = room.split('/')
  if (parts[0] === 'pm') {
    return { type: 'direct', to: [parts.slice(1).join('/')] }
  }
  // stream/<channel>/<topic>
  return {
    type: 'stream',
    to: parts[1],
    topic: decodeURIComponent(parts.slice(2).join('/')),
  }
}

/**
 * Encode a Zulip message's stream + topic into the Hubot room format.
 */
function encodeRoom(message) {
  if (message.type === 'private') {
    return `pm/${message.sender_email}`
  }
  return `stream/${message.display_recipient}/${encodeURIComponent(message.subject)}`
}

class ZulipAdapter extends Adapter {
  constructor(robot) {
    super(robot)
    this.client = null
  }

  async send(envelope, ...strings) {
    for (const content of strings) {
      const { type, to, topic } = parseRoom(envelope.room)
      try {
        const params =
          type === 'direct'
            ? { type: 'direct', to, content }
            : { type: 'stream', to, topic, content }
        await this.client.messages.send(params)
        this.robot.logger.debug(`[zulip] Sent to ${envelope.room}: ${content}`)
      } catch (err) {
        this.robot.logger.error(`[zulip] Failed to send message: ${err.message}`)
      }
    }
  }

  async reply(envelope, ...strings) {
    await this.send(
      envelope,
      ...strings.map((str) => `@**${envelope.user.name}**: ${str}`)
    )
  }

  async emote(envelope, ...strings) {
    await this.send(envelope, ...strings.map((str) => `**${str}**`))
  }

  async run() {
    const email = process.env.HUBOT_ZULIP_BOT
    const apiKey = process.env.HUBOT_ZULIP_API_KEY
    const realm = process.env.HUBOT_ZULIP_SITE || 'https://api.zulip.com'

    if (!email || !apiKey) {
      this.robot.logger.error(
        '[zulip] HUBOT_ZULIP_BOT and HUBOT_ZULIP_API_KEY must be set.'
      )
      process.exit(1)
    }

    try {
      this.client = await zulip({ username: email, apiKey, realm })
      this.robot.logger.info(`[zulip] Connected as ${email} to ${realm}`)
    } catch (err) {
      this.robot.logger.error(`[zulip] Failed to initialize client: ${err.message}`)
      process.exit(1)
    }

    const allPublicStreams = !process.env.HUBOT_ZULIP_ONLY_SUBSCRIBED_STREAMS

    try {
      const registerParams = {
        event_types: ['message'],
        all_public_streams: allPublicStreams ? 'true' : 'false',
      }
      const queueResult = await this.client.queues.register(registerParams)

      if (queueResult.result !== 'success') {
        throw new Error(`Unexpected result: ${JSON.stringify(queueResult)}`)
      }

      this.robot.logger.info('[zulip] Event queue registered, listening for messages.')
      this.emit('connected')
      this._poll(queueResult.queue_id, queueResult.last_event_id)
    } catch (err) {
      this.robot.logger.error(`[zulip] Failed to register event queue: ${err.message}`)
      process.exit(1)
    }
  }

  async _poll(queueId, lastEventId, retryDelay = 1000) {
    while (true) {
      try {
        const result = await this.client.events.retrieve({
          queue_id: queueId,
          last_event_id: lastEventId,
          dont_block: false,
        })

        if (result.result !== 'success') {
          this.robot.logger.warn('[zulip] Event queue expired, re-registering...')
          await this.run()
          return
        }

        for (const event of result.events) {
          lastEventId = event.id
          if (event.type === 'message') {
            this._handleMessage(event.message)
          }
        }

        retryDelay = 1000
      } catch (err) {
        this.robot.logger.error(`[zulip] Polling error: ${err.message}`)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        retryDelay = Math.min(retryDelay * 2, 60000)
      }
    }
  }

  _handleMessage(message) {
    if (message.sender_email === process.env.HUBOT_ZULIP_BOT) return

    const userId = String(message.sender_id)
    const userName = message.sender_full_name
    const room = encodeRoom(message)
    const content = message.content.replace(/\*\*/g, '').trim()

    const user = this.robot.brain.userForId(userId, { name: userName, room })
    const textMessage = new TextMessage(user, content, String(message.id))

    this.robot.logger.debug(
      `[zulip] Received from ${userName} in ${room}: ${content}`
    )
    this.receive(textMessage)
  }
}

export default {
  use(robot) {
    return new ZulipAdapter(robot)
  },
}