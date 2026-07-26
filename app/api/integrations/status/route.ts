import { NextResponse } from "next/server";

import { getAppUser } from "../../../../lib/auth/context";
import { connectedAccountStatus } from "../../../../lib/integrations/connected-accounts";
import { emptyConnectedAccountStatus } from "../../../../lib/integrations/types";

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ status: emptyConnectedAccountStatus(), preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const status = await connectedAccountStatus(user);
  return NextResponse.json({ status }, { headers: { "Cache-Control": "private, no-store" } });
}
