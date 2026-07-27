import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../../lib/auth/api-request";
import {
  CARD_ASSETS_BUCKET,
  type CardAssetField,
  uploadCardAssetBuffer,
} from "../../../../lib/card-assets";
import { createServiceSupabaseClient } from "../../../../lib/supabase/service";

const allowedFields = new Set<CardAssetField>(["photo", "coverPhoto", "companyLogo"]);

export async function POST(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ preview: true, url: "" }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const formData = await request.formData();
  const cardId = String(formData.get("cardId") || "").trim();
  const field = String(formData.get("field") || "").trim() as CardAssetField;
  const file = formData.get("file");

  if (!cardId || !allowedFields.has(field)) {
    return NextResponse.json({ error: "A valid card and image field are required." }, { status: 400 });
  }

  let buffer: Buffer | null = null;
  let mimeType = "image/jpeg";
  let fileSize = 0;

  if (file instanceof File) {
    fileSize = file.size;
    mimeType = file.type || mimeType;
    buffer = Buffer.from(await file.arrayBuffer());
  } else if (file instanceof Blob) {
    fileSize = file.size;
    mimeType = file.type || mimeType;
    buffer = Buffer.from(await file.arrayBuffer());
  }

  if (!buffer || fileSize <= 0) {
    return NextResponse.json({ error: "An image file is required." }, { status: 400 });
  }
  if (fileSize > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Images must be 8 MB or smaller." }, { status: 400 });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id")
    .eq("id", cardId)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();

  if (cardError || !card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  const service = createServiceSupabaseClient();
  if (!service) {
    return NextResponse.json({ error: "Card image storage is not configured yet." }, { status: 503 });
  }

  try {
    const url = await uploadCardAssetBuffer(service, user.workspaceId, cardId, field, buffer, mimeType);
    return NextResponse.json({ ok: true, url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload this image." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ bucket: CARD_ASSETS_BUCKET });
}
