// ===== Audit Types =====

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN'

export type RuleId =
  // HIGH
  | 'SUPER_PRIVILEGE'
  | 'ALL_PRIVILEGES_GLOBAL'
  | 'GRANT_OPTION_GLOBAL'
  | 'FILE_PRIVILEGE'
  | 'DANGEROUS_INFRA_PRIV'
  // MEDIUM
  | 'WILDCARD_HOST'
  | 'PASSWORD_EXPIRED'
  | 'ALL_PRIVILEGES_SCHEMA'
  | 'USER_MANAGEMENT_PRIV'
  // LOW
  | 'NO_PASSWORD_LIFETIME'
  | 'WILDCARD_HOST_SELECT_ONLY'
  | 'DUPLICATE_USERNAME'

export interface AuditFlag {
  severity: Severity
  rule: RuleId
  detail: string
}

export interface AuditUser {
  user: string
  host: string
  plugin: string
  passwordExpired: boolean
  accountLocked: boolean
  passwordLifetime: number | null
  riskLevel: RiskLevel
  flags: AuditFlag[]
  grants: string[]
  grantsSummary: string[]
}

export interface AuditSummary {
  totalUsers: number
  systemUsers: number
  highRisk: number
  mediumRisk: number
  lowRisk: number
  clean: number
}

export interface AuditResult {
  instance: string
  auditedAt: string
  summary: AuditSummary
  users: AuditUser[]
}

// ===== Raw MySQL row types =====

export interface MysqlUserRow {
  User: string
  Host: string
  plugin: string
  password_expired: string
  account_locked: string
  password_lifetime: number | null
}

export interface UserPrivilegeRow {
  GRANTEE: string
  PRIVILEGE_TYPE: string
  IS_GRANTABLE: string
}

export interface SchemaPrivilegeRow {
  GRANTEE: string
  TABLE_SCHEMA: string
  PRIVILEGE_TYPE: string
  IS_GRANTABLE: string
}

export interface TablePrivilegeRow {
  GRANTEE: string
  TABLE_SCHEMA: string
  TABLE_NAME: string
  PRIVILEGE_TYPE: string
  IS_GRANTABLE: string
}
