/// <reference lib="deno.unstable" />
import { FreshContext } from "$fresh/server.ts";
import { main as updateDatabase } from "../../../build-database.ts";

export const handler = async (req: Request, _ctx: FreshContext): Promise<Response> => {
  // Verify the request is from Deno Deploy's cron service
  const authHeader = req.headers.get("authorization");
  const expectedAuth = Deno.env.get("CRON_SECRET");
  
  if (!expectedAuth || authHeader !== `Bearer ${expectedAuth}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log("Starting scheduled database update...");
    const startTime = Date.now();
    
    await updateDatabase();
    
    const duration = Date.now() - startTime;
    console.log(`Database update completed in ${duration}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      message: "Database updated successfully",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Database update failed:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
