import { headers } from "next/headers";

import { resolveAppUrlFromHeaders } from "../../../lib/auth/app-url";
import { MobileReturnClient } from "./MobileReturnClient";
import "../auth.css";

export default async function MobileReturnPage() {
  const appUrl = resolveAppUrlFromHeaders(await headers());
  return <MobileReturnClient appBaseUrl={appUrl} />;
}
