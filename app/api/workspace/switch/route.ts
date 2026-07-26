import { NextResponse } from "next/server";

import { getAppUser } from "../../../../lib/auth/context";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const body = await request.json().catch(() => null) as { workspaceId?: string } | null;
  const workspaceId = body?.workspaceId?.trim() ?? "";
  if (!workspaceId) {
    return NextResponse.json({ error: "Choose a workspace to switch to." }, { status: 400 });
  }

  if (user.id === "local-development-preview") {
    return NextResponse.json({
      workspace: {
        id: workspaceId,
        name: workspaceId.includes("team") ? "Preview team" : user.workspaceName,
        type: workspaceId.includes("team") ? "team" : "personal",
        role: "owner",
        active: true,
      },
      preview: true,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_active_workspace", { p_workspace_id: workspaceId }).single();
  if (error || !data) {
    return NextResponse.json({ error: "We couldn’t switch workspaces." }, { status: 403 });
  }

  const row = data as {
    workspace_id: string;
    workspace_name: string;
    workspace_type: "personal" | "team";
    workspace_role: "owner" | "admin" | "member";
  };

  return NextResponse.json({
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      type: row.workspace_type,
      role: row.workspace_role,
      active: true,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
