import type { CardTemplate, WorkspaceRole, WorkspaceSummary, WorkspaceType } from "./types";

export type WorkspaceRow = {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceRole;
};

export type CardTemplateRow = {
  id: string;
  name: string;
  company: string;
  theme_color: string;
  company_logo_url: string;
  cover_image_url: string;
  bio_template: string;
  default_methods: Array<{ type?: string; value?: string; label?: string }> | null;
  created_at: string;
  updated_at: string;
};

export function workspaceSummaryFromRow(row: WorkspaceRow, activeWorkspaceId: string): WorkspaceSummary {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    role: row.role,
    active: row.id === activeWorkspaceId,
  };
}

export function cardTemplateFromRow(row: CardTemplateRow): CardTemplate {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    theme: row.theme_color,
    companyLogo: row.company_logo_url,
    coverPhoto: row.cover_image_url,
    bioTemplate: row.bio_template,
    defaultMethods: (row.default_methods ?? [])
      .filter((method) => method.type && method.value)
      .map((method) => ({
        type: method.type!,
        value: method.value!.trim(),
        label: method.label?.trim() || "",
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function cardTemplateToRow(
  template: Omit<CardTemplate, "id" | "createdAt" | "updatedAt">,
  workspaceId: string,
  createdByUserId: string,
  existingId?: string,
) {
  return {
    id: existingId || crypto.randomUUID(),
    workspace_id: workspaceId,
    name: template.name.trim(),
    company: template.company.trim(),
    theme_color: template.theme.toUpperCase(),
    company_logo_url: template.companyLogo,
    cover_image_url: template.coverPhoto,
    bio_template: template.bioTemplate.trim(),
    default_methods: template.defaultMethods,
    created_by_user_id: createdByUserId,
    updated_at: new Date().toISOString(),
  };
}

export function canManageTemplates(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}
