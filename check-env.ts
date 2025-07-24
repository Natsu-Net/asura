/// <reference lib="deno.unstable" />
import { openKv } from "./utils/kv.ts";

/**
 * Environment configuration check utility
 * Run with: deno run -A --env=.env check-env.ts
 */

console.log("🔍 Checking Environment Configuration...\n");

const requiredForProduction = ["DENO_KV_ACCESS_TOKEN"];
const recommended = ["APP_URL", "CRON_SECRET"];
const optional = ["DENO_ENV", "DENO_DEPLOYMENT_ID"];

const env = Deno.env.get("DENO_ENV") || "development";
const isProduction = env === "production";

console.log(`Environment: ${env}`);
console.log(`Is Production: ${isProduction}\n`);

// Check required variables for production
if (isProduction) {
  console.log("✅ Required for Production:");
  for (const key of requiredForProduction) {
    const value = Deno.env.get(key);
    if (value) {
      console.log(`  ✓ ${key}: ***${value.slice(-4)}`);
    } else {
      console.log(`  ❌ ${key}: NOT SET (Required for production!)`);
    }
  }
  console.log();
}

// Check recommended variables
console.log("📋 Recommended:");
for (const key of recommended) {
  const value = Deno.env.get(key);
  if (value) {
    console.log(`  ✓ ${key}: ${value}`);
  } else {
    console.log(`  ⚠️  ${key}: Not set`);
  }
}
console.log();

// Check optional variables
console.log("🔧 Optional:");
for (const key of optional) {
  const value = Deno.env.get(key);
  if (value) {
    console.log(`  ✓ ${key}: ${value}`);
  } else {
    console.log(`  - ${key}: Not set`);
  }
}
console.log();

// Test KV connection
try {
  console.log("🗄️  Testing KV Connection...");
  const kv = await openKv();
  console.log("  ✓ KV connection successful");
  
  // Test a simple operation
  await kv.set(["test", "connection"], new Date().toISOString());
  const result = await kv.get(["test", "connection"]);
  if (result.value) {
    console.log("  ✓ KV read/write operations working");
    await kv.delete(["test", "connection"]);
  } else {
    console.log("  ❌ KV read operation failed");
  }
  
  kv.close();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  console.log(`  ❌ KV connection failed: ${errorMessage}`);
}

console.log("\n🎉 Environment check complete!");

if (isProduction) {
  const missingRequired = requiredForProduction.filter(key => !Deno.env.get(key));
  if (missingRequired.length > 0) {
    console.log("\n⚠️  WARNING: Missing required production variables:");
    missingRequired.forEach(key => console.log(`  - ${key}`));
    console.log("\nSet these in your Deno Deploy dashboard under Environment Variables.");
  }
}
