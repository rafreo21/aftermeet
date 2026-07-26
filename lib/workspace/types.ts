export type WorkspaceType = "personal" | "team";
export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceSummary = {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceRole;
  active: boolean;
};

export type CardTemplate = {
  id: string;
  name: string;
  company: string;
  theme: string;
  companyLogo: string;
  coverPhoto: string;
  bioTemplate: string;
  defaultMethods: Array<{ type: string; value: string; label: string }>;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceContext = {
  active: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  templates: CardTemplate[];
};
