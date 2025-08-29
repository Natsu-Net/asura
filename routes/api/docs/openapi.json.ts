import { FreshContext } from "$fresh/server.ts";

export const handler = async (_req: Request, _ctx: FreshContext): Promise<Response> => {
  try {
    const openApiSpec = await Deno.readTextFile(new URL("../../../static/openapi.json", import.meta.url));
    return new Response(openApiSpec, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (_error) {
    return new Response("OpenAPI specification not found", { status: 404 });
  }
};
