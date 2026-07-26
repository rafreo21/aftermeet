import { buildLinkedInImportInitialState } from "../../../../lib/linkedin-import-state";
import { LinkedInImportClient } from "./LinkedInImportClient";

type SearchParams = Promise<{
  url?: string;
  capture?: string;
  source?: string;
}>;

export default async function LinkedInImportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const initial = buildLinkedInImportInitialState({
    url: params.url,
    capture: params.capture,
    source: params.source,
  });

  return <LinkedInImportClient initial={initial} />;
}
