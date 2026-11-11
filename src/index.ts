import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { OpenAIExtensions } from "@openai/mcp-extensions/server";
import { z } from "zod";

interface Env {
  ASSETS: Fetcher;
}

const UI_URI = "ui://widget/video-v2.html";

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
    version: "1.1.0"
  });

  // Advertise the OpenAI extension capabilities used by the Android-capable
  // global/thread entrypoints. Keep the existing MCP app resource and tools.
  new OpenAIExtensions(server);

  registerAppResource(server, "video-player", UI_URI, {}, async () => ({
    contents: [{
      uri: UI_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: await getWidgetHtml(env),
      _meta: {
        "openai/ui": {
          availableDisplayModes: ["inline", "fullscreen"],
          preferredDisplayMode: "inline"
        }
      }
    }]
  }));

  // Explicit launcher: global and thread entrypoints are listed as supported
  // on Android in the OpenAI MCP Extensions platform matrix.
  registerAppTool(
    server,
    "open_video_ai",
    {
      title: "Open Video AI",
      description: "Open the Video AI editor and preview. This launcher accepts no arguments.",
      inputSchema: z.object({}),
      _meta: {
        ui: { resourceUri: UI_URI, visibility: ["app"] },
        "openai/ui": {
          entrypoints: [
            { type: "global" },
            { type: "thread" }
          ]
        }
      }
    },
    async () => ({
      content: [{ type: "text", text: "Video AI is open. A sample project is loaded; describe the animation you want in chat to replace it." }],
      structuredContent: {
        ready: true,
        project: {
          title: "Video AI — демо",
          duration: 5,
          background: "#151020",
          objects: [
            { type: "text", text: "VIDEO AI", x: 640, y: 250, size: 88, color: "#ffffff" },
            { type: "circle", x: 420, y: 440, radius: 42, color: "#8b5cf6", motion: { toX: 860, toY: 440, duration: 3 } },
            { type: "text", text: "Твой проект начинается здесь", x: 640, y: 570, size: 30, color: "#c4b5fd" }
          ]
        }
      }
    })
  );

  // Preserve the original tool and its inline preview behavior for desktop/web.
  registerAppTool(
    server,
    "render_video_inline",
    {
      title: "Create and show a video",
      description: "Render an animated video project and show its playable preview. Build the project from the user's description using text, rectangles and circles with simple position motion. Use 16:9 unless the user asks for another ratio.",
      inputSchema: z.object({ project: projectSchema }),
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: UI_URI },
        "openai/outputTemplate": UI_URI,
        "openai/toolInvocation/invoking": "Создаю видео",
        "openai/toolInvocation/invoked": "Видео готово к просмотру"
      }
    },
    async ({ project }) => {
      const parsed = projectSchema.parse(project);
      return {
        content: [{
          type: "text",
          text: `Видео «${parsed.title}» подготовлено. Предпросмотр и видеоплеер находятся в окне Video AI.`
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
      return Response.json({ ok: true, app: "Video AI", version: "1.1.0" });
    }

    if (url.pathname === "/mcp") {
      return createMcpHandler(() => createServer(env))(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  }
};
