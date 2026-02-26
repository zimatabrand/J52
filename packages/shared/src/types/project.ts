export interface Project {
  projectId: number;
  schemaCode: string;
  projectName: string;
  projectType: string;
  baseDirectory: string;
  tempDirectory?: string;
  description?: string;
  gitRepositoryUrl?: string;
  primaryLanguage?: string;
  framework?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  schemaCode: string;
  projectName: string;
  projectType: string;
  baseDirectory: string;
  tempDirectory?: string;
  description?: string;
  gitRepositoryUrl?: string;
  primaryLanguage?: string;
  framework?: string;
  parentSchemaCode?: string;
}

export interface UpdateProjectInput {
  projectName?: string;
  projectType?: string;
  baseDirectory?: string;
  description?: string;
  gitRepositoryUrl?: string;
  primaryLanguage?: string;
  framework?: string;
  isActive?: boolean;
}

export interface SchemaInfo {
  schemaCode: string;
  parentSchemaCode: string | null;
  schemaName: string;
  schemaLevel: number;
  hasProjectManagerAi: boolean;
  isHidden: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
