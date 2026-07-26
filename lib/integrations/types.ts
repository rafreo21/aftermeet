export type IntegrationProvider = "google" | "microsoft";

export type ConnectedAccountStatus = {
  google: {
    connected: boolean;
    email: string;
    scopes: string[];
  };
  microsoft: {
    connected: boolean;
    email: string;
    scopes: string[];
  };
  configured: {
    google: boolean;
    microsoft: boolean;
  };
};

export type ConnectedAccountRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: IntegrationProvider;
  account_email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
};

export const GOOGLE_INTEGRATION_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const MICROSOFT_INTEGRATION_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Send",
  "Calendars.ReadWrite",
];

export function emptyConnectedAccountStatus(): ConnectedAccountStatus {
  return {
    google: { connected: false, email: "", scopes: [] },
    microsoft: { connected: false, email: "", scopes: [] },
    configured: { google: false, microsoft: false },
  };
}
