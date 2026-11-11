import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
  ASSETS: Fetcher;
}

const motionSchema = z.object({
  toX: z.number(),
  toY: z.number(),
  start: z.number().min(0).optional(),
  duration: z.number().min(0.1).max(60).optional()
}).optional();

const objectSchema = z.object({
  type: z.enum(["text", "rect", "circle"]),
  text: z.string().max(240).optional(),
  x: z.number().min(-2000).max(4000).optional(),
  y: z.number().min(-2000).max(3000).optional(),
  width: z.number().min(1).max(4000).optional(),
  height: z.number().min(1).max(3000).optional(),
  radius: z.number().min(1).max(1500).optional(),
  size: z.number().min(8).max(400).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  motion: motionSchema
});

const projectSchema = z.object({
  title: z.string().min(1).max(100),
  duration: z.number().min(1).max(60),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  objects: z.array(objectSchema).min(1).max(60)
});

async function getWidgetHtml(env: Env): Promise<string> {
  const response = await env.ASSETS.fetch("http://localhost/widget.html");
  if (!response.ok) throw new Error("Video AI widget asset is missing");
  return await response.text();
}

function createServer(env: Env) {
  const server = new McpServer({
    name: "video-ai",
    version: "1.0.0"
  });

  server.registerResource(
    "video-player",
    "ui://widget/video.html",
    {},
    async () => ({
      contents: [{
        uri: "ui://widget/video.html",
        mimeType: "text/html+skybridge",
        text: await getWidgetHtml(env)
      }]
    })
  );

  server.registerTool(
    "render_video_inline",
    {
      title: "Create and show a video",
      description: "Render an animated video project and show its playable preview directly inside the ChatGPT conversation. Build the project from the user's description; use a sequence of scenes represented by text, rectangles and circles, with motion keyframes. Use 16:9 unless the user asks for another ratio.",
      inputSchema: {
        project: projectSchema
      },
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: "ui://widget/video.html" },
        "openai/outputTemplate": "ui://widget/video.html",
        "openai/toolInvocation/invoking": "Создаю видео",
        "openai/toolInvocation/invoked": "Видео готово к просмотру"
      }
    },
    async ({ project }) => {
      const parsed = projectSchema.parse(project);
      return {
        content: [{
          type: "text",
          text: `Видео «${parsed.title}» подготовлено. Предпросмотр и видеоплеер находятся прямо в окне Video AI.`
        }],
        structuredContent: { project: parsed }
      };
    }
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        "Video AI MCP server is online. Connect ChatGPT to /mcp.",
        { headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, app: "Video AI", version: "1.0.0" });
    }

    if (url.pathname === "/mcp") {
      const server = createServer(env);
      return createMcpHandler(server)(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  }
};
