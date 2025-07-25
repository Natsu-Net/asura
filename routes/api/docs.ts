import { FreshContext } from "$fresh/server.ts";

export const handler = async (_req: Request, _ctx: FreshContext): Promise<Response> => {
  const url = new URL(_req.url);
  
  // Serve the OpenAPI JSON specification
  if (url.pathname === "/api/docs" || url.pathname === "/api/docs/") {
    try {
      const openApiSpec = await Deno.readTextFile("./static/openapi.json");
      return new Response(openApiSpec, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (_error) {
      return new Response("OpenAPI specification not found", { status: 404 });
    }
  }
  
  // Serve Swagger UI HTML
  const swaggerUIHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Asura Manga API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
        .swagger-ui .topbar {
            display: none;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '${url.protocol}//${url.host}/api/docs',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                tryItOutEnabled: true
            });
        };
    </script>
</body>
</html>
  `;
  
  return new Response(swaggerUIHtml, {
    headers: {
      "Content-Type": "text/html",
    },
  });
};
