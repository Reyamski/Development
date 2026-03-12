import type { ComparisonResult } from '../differ/types.js';

export interface SchemaContext {
  instanceName: string;
  databaseName: string;
}

export interface SlackConfig {
  webhookUrl?: string;
  botToken?: string;
  channel?: string;
}

export interface ConfluenceConfig {
  baseUrl: string;
  spaceKey: string;
  email: string;
  apiToken: string;
  parentPageId?: string;
  pageTitle?: string;
}

export interface Summary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

export interface OutputFilter {
  includeAdded: boolean;
  includeRemoved: boolean;
  includeModified: boolean;
  detailLevel: 'list' | 'full';
  includeCollation: boolean;
}

export interface SecretsConfig {
  secretName: string;
  region: string;
  profile?: string;
}

export interface AwsSecretValue {
  slack_webhook_url?: string;
  slack_bot_token?: string;
  slack_channel?: string;
  confluence_base_url?: string;
  confluence_space_key?: string;
  confluence_email?: string;
  confluence_api_token?: string;
  confluence_parent_page_id?: string;
}

export interface SecretsTestResponse {
  valid: boolean;
  keys: string[];
  error?: string;
}

export interface IntegrationRequest {
  results: ComparisonResult[];
  summary: Summary;
  schemaContext?: SchemaContext;
  targetPath?: string;
}

export interface SlackRequest extends IntegrationRequest {
  config?: SlackConfig;
  secrets?: SecretsConfig;
  filter?: OutputFilter;
  confluencePageUrl?: string;
}

export interface ConfluenceRequest extends IntegrationRequest {
  config?: ConfluenceConfig;
  secrets?: SecretsConfig;
  filter?: OutputFilter;
}

export interface SlackResponse {
  success: boolean;
  error?: string;
}

export interface ConfluenceResponse {
  success: boolean;
  pageUrl?: string;
  pageId?: string;
  error?: string;
}
