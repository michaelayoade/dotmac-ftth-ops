import { betterAuth } from "/tmp/better-auth-cli/node_modules/better-auth/dist/index.mjs";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || process.env.DOTMAC_DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || "dev-secret";
const authUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

if (!databaseUrl) {
  throw new Error("Set DATABASE_URL for Better Auth migrations");
}

let auth;
try {
  auth = betterAuth({
    database: {
      provider: "pg",
      connection: { url: databaseUrl },
    },
    baseURL: authUrl,
    secret: authSecret,
  });
} catch (err) {
  console.error("[better-auth-migrate] init failed:", err, "cause:", err?.cause);
  throw err;
}

export default auth;
export { auth };
