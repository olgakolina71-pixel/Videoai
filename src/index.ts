import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

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

function createServer() {
  const server = new McpServer({
    name: "video-ai",
    version: "1.2.0"
  });

  // Text-only MCP tool: no embedded widget, iframe, app resource or desktop-only UI.
  server.registerTool(
    "create_video_project",
    {
      title: "Create a video project",
      description: "Prepare a validated 2D animation project as portable JSON. Return the project structure in chat; this tool does not render or play a video.",
      inputSchema: z.object({ project: projectSchema })
    },
    async ({ project }) => {
      const parsed = projectSchema.parse(project);
      return {
        content: [{
          type: "text",
          text: `Проект «${parsed.title}» подготовлен. Ниже — JSON сцены, который можно сохранить или передать видеоредактору. Встроенного плеера и экспорта видео в этой версии нет.\\n\\n${JSON.stringify(parsed, null, 2)}`
        }],
        structuredContent: { project: parsed }
      };
    }
  );

  return server;
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        "Video AI text-only MCP server is online. Connect ChatGPT to /mcp.",
        { headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, app: "Video AI", version: "1.2.0", mode: "text-only" });
    }

    if (url.pathname === "/mcp") {
      return createMcpHandler(() => createServer()).fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
