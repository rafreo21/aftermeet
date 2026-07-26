import { NextResponse } from "next/server";

import { getAppUser } from "../../../../lib/auth/context";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const body = await request.json().catch(() => null) as { name?: string } | null;
  const name = body?.name?.trim() ?? "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Enter a team name with at least two characters." }, { status: 400 });
  }

  if (user.id === "local-development-preview") {
    return NextResponse.json({
      workspace: {
        id: "preview-team-workspace",
        name,
        type: "team",
        role: "owner",
        active: true,
      },
      preview: true,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_team_workspace", { p_name: name }).single();
  if (error || !data) {
    return NextResponse.json({ error: "We couldn’t create that team workspace." }, { status: 500 });
  }

  const row = data as { workspace_id: string; workspace_name: string };
  return NextResponse.json({
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      type: "team",
      role: "owner",
      active: true,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
