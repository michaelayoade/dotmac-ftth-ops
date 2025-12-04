import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      app: "platform-tenant",
      timestamp: new Date().toISOString(),
      version: process.env["npm_package_version"] || "0.1.0",
    },
    { status: 200 }
  );
}
