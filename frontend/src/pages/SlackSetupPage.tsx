import { SetupPage, CodeBlock, Mono, ExternalA } from '../components/SetupPage/SetupPage';
import type { SetupStep } from '../components/SetupPage/SetupPage';
import slackUrl from '../images/slack.svg?url';

const LOG_BLOCK = `[SlackNotifier] Initialized, posting to channel C01234ABCDE
[SlackListener] Socket Mode connected, listening for app mentions and DMs`;

const MANIFEST_BLOCK = `{
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
}`;
const STEPS: SetupStep[] = [
  {
    title: 'Create the app from manifest',
    body: (
      <>
        <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4 mb-2">
          <li>
            Go to <ExternalA href="https://api.slack.com/apps">api.slack.com/apps</ExternalA> and
            sign in.
          </li>
          <li>
            Click <strong>Create New App</strong> → <strong>From an app manifest</strong>.
          </li>
          <li>Select your workspace, paste this manifest, then click Create:</li>
        </ol>
        <CodeBlock value={MANIFEST_BLOCK} />
      </>
    ),
  },
  {
    title: 'Install to your workspace',
    body: (
      <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4">
        <li>
          In the left sidebar, click <strong>OAuth and Permissions</strong>.
        </li>
        <li>
          Click <strong>Install to Workspace</strong> and allow the permissions.
        </li>
        <li>
          Copy the <strong>Bot User OAuth Token</strong> (<Mono>xoxb-...</Mono>) — this is your{' '}
          <strong>Bot Token</strong>.
        </li>
      </ol>
    ),
  },
  {
    title: 'Create an App Token',
    body: (
      <>
        <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4 mb-3">
          <li>
            In the left sidebar, click <strong>Basic Information</strong>.
          </li>
          <li>
            Under <strong>App-Level Tokens</strong>, click <strong>Generate Token and Scopes</strong>.
          </li>
          <li>
            Add <Mono>connections:write</Mono>, click <strong>Generate</strong>, and copy the{' '}
            <Mono>xapp-...</Mono> token.
          </li>
        </ol>
        <p className="text-xs text-gray-400">
          Optional: if you only need outbound notifications, you can leave App Token empty.
        </p>
      </>
    ),
  },
  {
    title: 'Get your channel ID',
    body: (
      <>
        <ol className="space-y-1.5 text-sm text-gray-600 list-decimal pl-4 mb-2">
          <li>In Slack, open the channel you want Argus to post to.</li>
          <li>
            Right-click the channel name → <strong>View channel details</strong>.
          </li>
          <li>
            Copy the Channel ID (format: <Mono>C01234ABCDE</Mono>).
          </li>
          <li>Invite the bot to the channel:</li>
        </ol>
        <CodeBlock value="/invite @Argus" />
      </>
    ),
  },
  {
    title: 'Configure Argus',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-2">
          Open Settings → <strong>Slack</strong> and enter:
        </p>
        <ul className="space-y-1 text-sm text-gray-600 list-disc pl-4 mb-3">
          <li>
            <strong>Bot Token</strong> (<Mono>xoxb-...</Mono>) from Step 2
          </li>
          <li>
            <strong>App Token</strong> (<Mono>xapp-...</Mono>) from Step 3 (optional)
          </li>
          <li>
            <strong>Channel ID</strong> from Step 4
          </li>
          <li>
            <strong>Owner Sender ID</strong> (optional): in Slack, open your profile and copy member
            ID (<Mono>U...</Mono>)
          </li>
        </ul>
        <p className="text-sm text-gray-600">
          Click <strong>Save</strong>.
        </p>
      </>
    ),
  },
  {
    title: 'Verify the connection',
    body: (
      <>
        <p className="text-sm text-gray-600 mb-1">Check the server logs for:</p>
        <CodeBlock value={LOG_BLOCK} />
        <p className="text-sm text-gray-600 mt-3 mb-1">Then send:</p>
        <CodeBlock value="@Argus help" />
      </>
    ),
  },
];

const PREREQUISITES = (
  <ul className="space-y-1.5 text-sm text-gray-600 list-disc pl-4">
    <li>
      A Slack workspace — free tier is sufficient.{' '}
      <ExternalA href="https://slack.com/help/articles/206845317-Create-a-Slack-workspace">
        Create one
      </ExternalA>{' '}
      if you don't have one.
    </li>
    <li>Admin access to the workspace, or permission to install apps.</li>
  </ul>
);

export default function SlackSetupPage() {
  return (
    <SetupPage
      title="Slack Setup"
      subtitle="Connect Argus to a Slack channel in 6 steps."
      logoSrc={slackUrl}
      prerequisites={PREREQUISITES}
      steps={STEPS}
    />
  );
}
