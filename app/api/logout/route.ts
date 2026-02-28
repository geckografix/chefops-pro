import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { sessionOptions } from "../../../src/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  const session = await getIronSession(req, res as any, sessionOptions);

  session.destroy();
  return res;
}
