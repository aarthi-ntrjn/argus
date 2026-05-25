# Slack App Setup

This guide walks through creating and configuring the Slack App that Argus uses to post session notifications and respond to questions.

## Prerequisites

- A Slack workspace (free tier is sufficient, don't have one? [Create a Slack workspace](https://slack.com/help/articles/206845317-Create-a-Slack-workspace))
- Admin access to the workspace, or permission to install apps

---

## Step 1: Create the App from Manifest

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and sign in with your workspace account.
2. Click **Create New App** > **From an app manifest**.
3. Select your workspace.
4. Copy the manifest from `docs/slack-manifest.argus.json` in this repo, or copy/paste the manifest below into Slack:

```json
{
  "_metadata": {
    "major_version": 1,
    "minor_version": 1
  },
  "display_information": {
    "name": "Argus",
    "description": "Argus session notifications and commands",
    "background_color": "#1f2937"
  },
  "features": {
    "bot_user": {
      "display_name": "Argus",
      "always_online": true
    }
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "app_mentions:read",
        "channels:read",
        "chat:write",
        "im:history"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "message.im"
      ]
    },
    "org_deploy_enabled": false,
    "socket_mode_enabled": true,
    "token_rotation_enabled": false
  }
}
```

5. Click **Next** and **Create**.

---

## Step 2: Install to Your Workspace

1. In the left sidebar, click **OAuth and Permissions**.
2. Scroll to the top and click **Install to Workspace**.
3. Review the permissions and click **Allow**.
4. Copy the **Bot User OAuth Token** (`xoxb-...`). This is your `SLACK_BOT_TOKEN`.

---

## Step 3: Create an App-Level Token (for inbound commands)

Socket Mode lets Argus receive incoming Slack messages without exposing a public HTTP endpoint.

1. In the left sidebar, click **Basic Information**.
2. Scroll to **App-Level Tokens** and click **Generate Token and Scopes**.
3. Name it anything (e.g. `argus-socket`) and add scope `connections:write`.
4. Click **Generate** and copy the `xapp-...` token. This is your `SLACK_APP_TOKEN`.

> If you only need outbound notifications and do not need bot command replies, you can skip this step and leave `SLACK_APP_TOKEN` empty.

---

## Step 4: Get Your Channel ID

Argus needs the channel ID (not the channel name) to post messages.

1. In Slack, open the channel you want Argus to post to.
2. Right-click the channel name in the sidebar and select **View channel details**.
3. Scroll to the bottom of the popup. The Channel ID is displayed there (format: `C01234ABCDE`).
4. Copy the ID. This is your `SLACK_CHANNEL_ID`.
5. Invite the bot to the channel by typing in the channel:
   ```
   /invite @Argus
   ```

---

## Step 5: Configure Argus

Open the Argus Settings dialog and go to the **Slack** section. Enter the values from the previous steps:

- **Bot Token** (`xoxb-...`): from Step 2
- **App Token** (`xapp-...`): from Step 3 (optional, enables inbound commands)
- **Channel ID**: from Step 4
- **Owner Sender ID** (optional): restricts inbound command access to you only. To find it: in Slack, click your profile picture → **View profile** → the **⋯** menu → **Copy member ID**.

Click **Save**. Config is stored in `~/.argus/slack.config`.

---

## Step 6: Verify the Connection

After saving, connect the integration. You should see these lines in the server logs:

```
[SlackNotifier] Initialized, posting to channel C01234ABCDE
[SlackListener] Socket Mode connected, listening for app mentions and DMs
```

To confirm the bot is working, type this in your Slack channel:

```
@Argus help
```

The bot should reply with a list of supported commands.

---

## Manual setup (without manifest)

If you prefer not to use the manifest, configure the app manually:

1. **Create app from scratch**: In [api.slack.com/apps](https://api.slack.com/apps), click **Create New App** > **From scratch**.
2. **Add bot token scopes** under **OAuth and Permissions** > **Scopes** > **Bot Token Scopes**:

   | Scope | Purpose |
   | ----- | ------- |
   | `chat:write` | Post messages and thread replies |
   | `channels:read` | Look up channel information |
   | `app_mentions:read` | Receive @mention events |
   | `im:history` | Receive direct messages |

3. **Enable event subscriptions** under **Event Subscriptions** and add bot events:
   - `app_mention`
   - `message.im`
4. **Enable Socket Mode** under **Socket Mode**.

Then continue from **Step 2** above.

---

## How Socket Mode Works (No Public Endpoint Required)

Normally, Slack delivers events by making HTTP POST requests to a URL you provide. That requires your server to be publicly reachable on the internet.

**Socket Mode flips this around.** Instead of Slack calling you, Argus opens an outbound WebSocket connection to Slack's servers. The flow is:

```
Argus (your machine)  →  opens WebSocket  →  Slack's servers
                      ←  events pushed back over that connection  ←
```

Since Argus initiates the connection (outbound on port 443), it works anywhere outbound HTTPS traffic is allowed: your laptop, a home server, a company network behind a firewall, or a Docker container with no exposed ports. No ngrok, no domain name, no port forwarding required.

### What the two tokens do

| Token | Prefix | Purpose |
| ----- | ------ | ------- |
| `SLACK_BOT_TOKEN` | `xoxb-` | Authenticates API calls: posting messages, replying in threads, looking up channel info |
| `SLACK_APP_TOKEN` | `xapp-` | Authenticates the Socket Mode WebSocket connection. Keeps the tunnel open so Slack can push events to Argus |

The Bot token does the work. The App token is purely the key that keeps the outbound tunnel alive.

### What happens at startup

When Argus starts with both tokens set:

1. `SlackNotifier` creates an API client using your Bot token.
2. `SlackListener` opens a WebSocket to Slack using your App token.
3. Slack sends a hello handshake. From that point on, any `app_mention` or `message.im` event is pushed down that connection to Argus in real time.

The only network requirement is outbound HTTPS/WSS access to `*.slack.com` on port 443.

---

## Filtering Event Types

By default, all session events are forwarded to Slack. To limit which events post messages, set `enabledEventTypes` in your config or via the API:

```bash
curl -X PATCH http://localhost:7411/api/v1/settings/slack \
  -H "Content-Type: application/json" \
  -d '{"enabledEventTypes": ["session.created", "session.ended"]}'
```

Available event types: `session.created`, `session.updated`, `session.ended`, `repository.added`, `repository.removed`.

Changes take effect immediately without restarting Argus.

---

## Bot Commands

Once the app is connected, you can ask it questions in any channel the bot is in, or via direct message:

| Command | Response |
| ------- | -------- |
| `@Argus sessions` | Lists all active AI sessions |
| `@Argus status <sessionId>` | Shows details for a specific session |
| `@Argus help` | Lists available commands |

You can use a partial session ID (first 8 characters) with the `status` command.

---

## Troubleshooting

**No messages appearing in Slack**
- Check that **Bot Token** and **Channel ID** are saved in Settings and the integration is connected.
- Confirm the bot has been invited to the channel (`/invite @Argus`).
- Check the Argus server logs for `[SlackNotifier]` warning lines.

**Bot not responding to messages**
- Confirm `SLACK_APP_TOKEN` (`xapp-...`) is set and Socket Mode is enabled in the Slack App settings.
- Check the logs for `[SlackListener]` lines. If Socket Mode failed to connect, the error will appear there.

**Token was revoked**
- Re-install the app to your workspace (Step 2) to generate a new Bot token.
- For the App token, go to **Basic Information** > **App-Level Tokens** and regenerate it.
