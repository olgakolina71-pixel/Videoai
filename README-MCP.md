# Video AI — ChatGPT inline video app

This adds a remote MCP server and an MCP App view to the existing Video AI repository.
The view renders the generated scene inside ChatGPT, includes playback controls, and can record the canvas animation to WebM.

## What this version does

- Exposes the `render_video_inline` MCP tool at `/mcp`.
- Returns an inline UI resource (`ui://widget/video.html`) to ChatGPT.
- Accepts a scene project composed by ChatGPT from the user's prompt.
- Shows an animated Canvas preview inside the conversation.
- Can record the animation to WebM and display it in an HTML5 video player.

This is a procedural 2D animation renderer, not a photorealistic text-to-video model. It does not yet create generated footage, synthesize speech, or add music.

## Deploy to Cloudflare Workers

You need a Cloudflare account. From a computer with Node.js 20+:

1. Clone this repository.
2. Run `npm install`.
3. Run `npx wrangler login` and authorize Cloudflare.
4. Run `npm run deploy`.
5. Copy the deployed Worker URL. The MCP endpoint is that URL plus `/mcp`.

The worker health endpoint is `/health`.

## Connect it to ChatGPT

In ChatGPT, open Settings → Apps & Connectors → Advanced settings and enable Developer Mode if available. Then create a custom app/connector using the deployed HTTPS endpoint ending in `/mcp`. Choose no authentication for this prototype, review the permission prompt, and create the app.

After connecting, select Video AI in the chat and ask it to create a short animated video. ChatGPT composes the scene project and calls `render_video_inline`; the player appears as the tool's inline app view.

## Notes

- Do not put Cloudflare API tokens or other secrets in this repository.
- The prototype does not store user videos on a server.
- The UI uses the standard MCP Apps JSON-RPC bridge.
- ChatGPT decides whether and how to display the app view; the app cannot force a native player outside the supported embedded view.
