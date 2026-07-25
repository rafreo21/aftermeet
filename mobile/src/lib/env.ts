import Constants from 'expo-constants';

type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  publicCardBaseUrl: string;
};

export function readEnv(): PublicEnv | null {
  const extra = Constants.expoConfig?.extra;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseAnonKey;
  const publicCardBaseUrl = process.env.EXPO_PUBLIC_CARD_BASE_URL || extra?.publicCardBaseUrl || 'http://localhost:3000';
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey, publicCardBaseUrl: publicCardBaseUrl.replace(/\/+$/, '') };
}
