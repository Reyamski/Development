import type {
  AuditFlag,
  AuditUser,
  RiskLevel,
  MysqlUserRow,
  UserPrivilegeRow,
  SchemaPrivilegeRow,
} from '../types.js'
import { SYSTEM_USERS, parseGrantee, type RawUserData } from './user-fetcher.js'

const DBA_EXACT_NAMES = new Set(['dba', 'admin', 'rdsadmin', 'root', 'ops'])

function isDbaAccount(username: string): boolean {
  return DBA_EXACT_NAMES.has(username.toLowerCase())
}

function computeRiskLevel(flags: AuditFlag[]): RiskLevel {
  if (flags.some(f => f.severity === 'HIGH')) return 'HIGH'
  if (flags.some(f => f.severity === 'MEDIUM')) return 'MEDIUM'
  if (flags.some(f => f.severity === 'LOW')) return 'LOW'
  return 'CLEAN'
}

function getGlobalPrivileges(
  user: string,
  host: string,
  userPrivileges: UserPrivilegeRow[],
): Set<string> {
  const grantee = `'${user}'@'${host}'`
  const privs = new Set<string>()
  for (const row of userPrivileges) {
    if (row.GRANTEE === grantee) {
      privs.add(row.PRIVILEGE_TYPE.toUpperCase())
    }
  }
  return privs
}

function getSchemaPrivileges(
  user: string,
  host: string,
  schemaPrivileges: SchemaPrivilegeRow[],
): Map<string, Set<string>> {
  const grantee = `'${user}'@'${host}'`
  const map = new Map<string, Set<string>>()
  for (const row of schemaPrivileges) {
    if (row.GRANTEE !== grantee) continue
    if (!map.has(row.TABLE_SCHEMA)) map.set(row.TABLE_SCHEMA, new Set())
    map.get(row.TABLE_SCHEMA)!.add(row.PRIVILEGE_TYPE.toUpperCase())
  }
  return map
}

function grantsHaveGlobalPriv(grants: string[], priv: string): boolean {
  const upperPriv = priv.toUpperCase()
  return grants.some(g => {
    const upper = g.toUpperCase()
    return upper.includes(upperPriv) && upper.includes('ON *.*')
  })
}

function grantsHaveGrantOption(grants: string[]): boolean {
  return grants.some(g => {
    const upper = g.toUpperCase()
    return upper.includes('GRANT OPTION') && upper.includes('ON *.*') && upper.includes('WITH GRANT OPTION')
  })
}

function summariseGrant(grant: string): string {
  return grant
    .replace(/^GRANT\s+/i, '')
    .replace(/\s+TO\s+'[^']*'@'[^']*'.*$/i, '')
    .trim()
}

export function auditUser(
  row: MysqlUserRow,
  data: RawUserData,
  allUsers: MysqlUserRow[],
): AuditUser {
  const { user, host } = { user: row.User, host: row.Host }
  const flags: AuditFlag[] = []

  const globalPrivs = getGlobalPrivileges(user, host, data.userPrivileges)
  const schemaPrivMap = getSchemaPrivileges(user, host, data.schemaPrivileges)
  const grants = data.grantsMap.get(`${user}@${host}`) ?? []

  if (globalPrivs.has('SUPER') || grantsHaveGlobalPriv(grants, 'SUPER')) {
    flags.push({
      severity: 'HIGH',
      rule: 'SUPER_PRIVILEGE',
      detail: `User ${user}@${host} has SUPER privilege globally — can bypass all access controls`,
    })
  }

  if (globalPrivs.has('ALL PRIVILEGES') || globalPrivs.has('ALL') || grantsHaveGlobalPriv(grants, 'ALL PRIVILEGES')) {
    flags.push({
      severity: 'HIGH',
      rule: 'ALL_PRIVILEGES_GLOBAL',
      detail: `User ${user}@${host} has ALL PRIVILEGES on *.* — effectively root access`,
    })
  }

  if (globalPrivs.has('GRANT OPTION') && grantsHaveGrantOption(grants)) {
    flags.push({
      severity: 'HIGH',
      rule: 'GRANT_OPTION_GLOBAL',
      detail: `User ${user}@${host} has GRANT OPTION on *.* — can escalate privileges to any user`,
    })
  }

  if (globalPrivs.has('FILE') || grantsHaveGlobalPriv(grants, 'FILE')) {
    flags.push({
      severity: 'HIGH',
      rule: 'FILE_PRIVILEGE',
      detail: `User ${user}@${host} has FILE privilege — can read/write server-accessible files (data exfiltration risk)`,
    })
  }

  const dangerousPrivs = ['SHUTDOWN', 'PROCESS', 'REPLICATION SLAVE'] as const
  const foundDangerous = dangerousPrivs.filter(
    p => globalPrivs.has(p) || grantsHaveGlobalPriv(grants, p),
  )
  if (foundDangerous.length > 0 && !isDbaAccount(user)) {
    flags.push({
      severity: 'HIGH',
      rule: 'DANGEROUS_INFRA_PRIV',
      detail: `User ${user}@${host} has ${foundDangerous.join(', ')} privilege(s) — infrastructure-level operations should only be granted to DBA accounts`,
    })
  }

  if (host === '%') {
    const isSelectOnly = grants.length > 0 && grants.every(g => {
      const upper = g.toUpperCase().replace(/^GRANT\s+/i, '')
      return /^(SELECT|USAGE|SELECT,\s*USAGE|USAGE,\s*SELECT)[\s\n]/i.test(upper) ||
             upper.startsWith('USAGE ON') ||
             (upper.startsWith('SELECT ON') && !upper.includes('ALL'))
    })

    if (!isSelectOnly) {
      flags.push({
        severity: 'MEDIUM',
        rule: 'WILDCARD_HOST',
        detail: `User ${user}@% is accessible from any host — no IP restriction on a non-read-only account`,
      })
    }
  }

  if (row.password_expired === 'Y') {
    flags.push({
      severity: 'MEDIUM',
      rule: 'PASSWORD_EXPIRED',
      detail: `User ${user}@${host} has an expired password — account may still connect via existing sessions`,
    })
  }

  for (const [schema, privs] of schemaPrivMap.entries()) {
    if (privs.has('ALL PRIVILEGES') || privs.has('ALL')) {
      if (!globalPrivs.has('ALL PRIVILEGES') && !globalPrivs.has('ALL')) {
        flags.push({
          severity: 'MEDIUM',
          rule: 'ALL_PRIVILEGES_SCHEMA',
          detail: `User ${user}@${host} has ALL PRIVILEGES on schema \`${schema}\` — too broad for an application account`,
        })
      }
    }
  }

  const userMgmtPrivs = ['CREATE USER', 'DROP USER'].filter(p => globalPrivs.has(p))
  const hasCreateUser = grantsHaveGlobalPriv(grants, 'CREATE USER')
  const hasDropUser = grantsHaveGlobalPriv(grants, 'DROP USER')
  if (userMgmtPrivs.length > 0 || hasCreateUser || hasDropUser) {
    const found = Array.from(new Set([
      ...userMgmtPrivs,
      ...(hasCreateUser ? ['CREATE USER'] : []),
      ...(hasDropUser ? ['DROP USER'] : []),
    ]))
    flags.push({
      severity: 'MEDIUM',
      rule: 'USER_MANAGEMENT_PRIV',
      detail: `User ${user}@${host} has ${found.join(', ')} privilege — can create or drop users (privilege escalation vector)`,
    })
  }

  if (row.password_lifetime === null) {
    flags.push({
      severity: 'LOW',
      rule: 'NO_PASSWORD_LIFETIME',
      detail: `User ${user}@${host} has no password rotation policy (password_lifetime = NULL) — credentials never expire`,
    })
  }

  if (host === '%') {
    const isSelectOnly = grants.length > 0 && grants.every(g => {
      const upper = g.toUpperCase()
      return upper.includes('SELECT') && !upper.includes('INSERT') &&
             !upper.includes('UPDATE') && !upper.includes('DELETE') &&
             !upper.includes('ALL') && !upper.includes('CREATE') &&
             !upper.includes('DROP') && !upper.includes('ALTER')
    })

    if (isSelectOnly) {
      flags.push({
        severity: 'LOW',
        rule: 'WILDCARD_HOST_SELECT_ONLY',
        detail: `User ${user}@% has wildcard host but only SELECT privilege — lower risk but should be scoped to known IP range`,
      })
    }
  }

  const sameNameUsers = allUsers.filter(u => u.User === user && u.Host !== host && !SYSTEM_USERS.has(u.User))
  if (sameNameUsers.length > 0) {
    const otherHosts = sameNameUsers.map(u => u.Host).join(', ')
    flags.push({
      severity: 'LOW',
      rule: 'DUPLICATE_USERNAME',
      detail: `User ${user} exists on multiple hosts (${host} and ${otherHosts}) — confusing access patterns, harder to audit`,
    })
  }

  const grantsSummary = grants.map(summariseGrant).filter(Boolean)

  return {
    user,
    host,
    plugin: row.plugin,
    passwordExpired: row.password_expired === 'Y',
    accountLocked: row.account_locked === 'Y',
    passwordLifetime: row.password_lifetime,
    riskLevel: computeRiskLevel(flags),
    flags,
    grants,
    grantsSummary,
  }
}

export function runRulesEngine(data: RawUserData): {
  auditedUsers: AuditUser[]
  systemUserCount: number
} {
  const nonSystemUsers = data.users.filter(u => !SYSTEM_USERS.has(u.User))
  const systemUserCount = data.users.filter(u => SYSTEM_USERS.has(u.User)).length

  const auditedUsers = nonSystemUsers.map(row =>
    auditUser(row, data, nonSystemUsers),
  )

  return { auditedUsers, systemUserCount }
}
