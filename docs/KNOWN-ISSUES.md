# Known Issues

## Claude Code: Cancelled tool use appears in prompt history

When you press Escape or click Cancel to reject a tool use in Claude Code, the string
`[Request interrupted by user for tool use]` is injected into the conversation on your
behalf. Claude Code's prompt history treats this injected message the same as a
manually typed input, so it shows up when navigating history with the up/down arrows.

The history filter should exclude system-generated interruption strings. Tracked at
https://github.com/anthropics/claude-code/issues.
