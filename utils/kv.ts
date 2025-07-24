/// <reference lib="deno.unstable" />

/**
 * Smart KV connection utility that handles both local and remote databases
 */

const REMOTE_KV_URL = "https://api.deno.com/databases/82c53b38-af0e-4fa6-9009-ec428bfab4a3/connect";

/**
 * Opens the appropriate KV database based on environment
 * - In development: Uses local KV database
 * - In production with DENO_KV_ACCESS_TOKEN: Uses remote KV database
 * - In production without token: Uses default KV database
 */
export async function openKv(): Promise<Deno.Kv> {
  const env = Deno.env.get("DENO_ENV") || "development";
  const hasToken = !!Deno.env.get("DENO_KV_ACCESS_TOKEN");
  const isDeployment = !!Deno.env.get("DENO_DEPLOYMENT_ID");
  const force = Deno.env.get("DENO_ENV_FORCE") === "production";

  // If forced to use production, always use remote KV
  if (force) {
	if (hasToken) {
		try {
			console.log("🌐 Using remote KV database (forced production mode)")
			return await Deno.openKv(REMOTE_KV_URL);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn("⚠️  Failed to connect to remote KV in forced mode, falling back to default:", errorMessage);
			return await Deno.openKv();
		}
	} else {
		console.log("🌐 Using default KV database (forced production mode, no token)");
		return await Deno.openKv();
	}
  }

  // In development, use local KV (only if not forced)
  if (env === "development") {
    console.log("🗄️  Using local KV database (development mode)");
    return await Deno.openKv();
  }
  
  
  // In production with deployment ID and token, use remote KV
  if (isDeployment && hasToken) {
    try {
      console.log("🌐 Using remote KV database (production mode)");
      return await Deno.openKv(REMOTE_KV_URL);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("⚠️  Failed to connect to remote KV, falling back to default:", errorMessage);
      return await Deno.openKv();
    }
  }
  
  // Fallback to default KV
  console.log("🗄️  Using default KV database");
  return await Deno.openKv();
}

/**
 * Get the KV database URL for display purposes
 */
export function getKvUrl(): string {
  const env = Deno.env.get("DENO_ENV") || "development";
  const hasToken = !!Deno.env.get("DENO_KV_ACCESS_TOKEN");
  const isDeployment = !!Deno.env.get("DENO_DEPLOYMENT_ID");
  
  if (env === "development") {
    return "local://default";
  }
  
  if (isDeployment && hasToken) {
    return REMOTE_KV_URL;
  }
  
  return "default";
}
