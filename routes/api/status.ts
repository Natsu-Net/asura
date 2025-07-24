/// <reference lib="deno.unstable" />
import { FreshContext } from "$fresh/server.ts";
import { getLastUpdateDate } from "../../utils/fetcher.ts";

export const handler = async (_req: Request, _ctx: FreshContext): Promise<Response> => {
  try {
    const lastUpdate = await getLastUpdateDate();
    
    const response = {
      lastUpdate: lastUpdate || null,
      lastUpdateFormatted: lastUpdate ? new Date(lastUpdate).toLocaleString() : null,
      status: "operational",
      version: "1.0.0",
      uptime: Date.now() - (performance.timeOrigin || 0),
    };
    
    return new Response(JSON.stringify(response, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(JSON.stringify({
      error: errorMessage,
      status: "error",
      version: "1.0.0",
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
