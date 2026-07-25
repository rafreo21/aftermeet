export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
  appUrl: string;
};

export function readPublicSupabaseConfig(
  source: Record<string, string | undefined> = process.env,
): { config: PublicSupabaseConfig | null; missing: string[] } {
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL,
  };
  const missing = Object.entries(required).filter(([, value]) => !value?.trim()).map(([key]) => key);
  if (missing.length) return { config: null, missing };
  return {
    config: {
      url: required.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: required.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      appUrl: required.NEXT_PUBLIC_APP_URL!.replace(/\/+$/, ""),
    },
    missing: [],
  };
}

export function requirePublicSupabaseConfig(source = process.env): PublicSupabaseConfig {
  const result = readPublicSupabaseConfig(source);
  if (!result.config) throw new Error(`AfterMeet Supabase configuration is missing: ${result.missing.join(", ")}`);
  return result.config;
}
