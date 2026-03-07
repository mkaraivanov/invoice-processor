import dotenv from "dotenv";
import { execSync } from "child_process";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local", override: true });

function resolveToIPv4(url: string): string {
  const u = new URL(url);
  try {
    const ip = execSync(`dig +short A ${u.hostname} | head -1`, {
      encoding: "utf-8",
    }).trim();
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      u.hostname = ip;
    }
  } catch {
    // Fall back to original hostname
  }
  return u.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveToIPv4(
      process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/placeholder"
    ),
  },
});
