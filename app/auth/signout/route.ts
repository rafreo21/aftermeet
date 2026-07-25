import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/auth", request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
