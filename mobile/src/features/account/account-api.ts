import { getSupabase } from '@/lib/supabase';

export type AccountProfile = {
  displayName: string;
  primaryEmail: string;
  phone: string;
  phoneVerified: boolean;
  emailVerified: boolean;
};

type AppContextRow = {
  display_name: string | null;
  primary_email: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  email_verified: boolean | null;
};

function mapContext(row: AppContextRow | null): AccountProfile | null {
  if (!row) return null;
  return {
    displayName: row.display_name ?? '',
    primaryEmail: row.primary_email ?? '',
    phone: row.phone ?? '',
    phoneVerified: Boolean(row.phone_verified),
    emailVerified: Boolean(row.email_verified),
  };
}

export async function fetchAccountProfile(): Promise<AccountProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_my_app_context').single();
  if (error) throw new Error(error.message || 'Could not load your account.');
  return mapContext(data as AppContextRow | null);
}

export type AccountProfileUpdate = { displayName: string; phone: string; phoneVerified: boolean };

export async function updateAccountProfile(input: { displayName: string; phone: string }): Promise<AccountProfileUpdate> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Connect the mobile environment to Supabase first.');
  const { data, error } = await supabase
    .rpc('update_my_account_profile', { p_display_name: input.displayName, p_phone: input.phone })
    .single();
  if (error) throw new Error(error.message || 'Could not save your account details.');
  const row = data as { display_name: string | null; phone: string | null; phone_verified: boolean | null } | null;
  if (!row) throw new Error('Could not save your account details.');
  return {
    displayName: row.display_name ?? '',
    phone: row.phone ?? '',
    phoneVerified: Boolean(row.phone_verified),
  };
}
