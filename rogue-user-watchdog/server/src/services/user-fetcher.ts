import type {
  MysqlUserRow,
  UserPrivilegeRow,
  SchemaPrivilegeRow,
  TablePrivilegeRow,
} from '../types.js'

export const SYSTEM_USERS = new Set([
  'rdsadmin',
  'mysql.sys',
  'mysql.session',
  'mysql.infoschema',
  'root',
])

export interface RawUserData {
  users: MysqlUserRow[]
  userPrivileges: UserPrivilegeRow[]
  schemaPrivileges: SchemaPrivilegeRow[]
  tablePrivileges: TablePrivilegeRow[]
  grantsMap: Map<string, string[]>
}

export async function fetchUserData(connection: import('mysql2/promise').Connection): Promise<RawUserData> {
  const [userRows] = await connection.query(`
    SELECT
      User,
      Host,
      plugin,
      password_expired,
      account_locked,
      password_lifetime
    FROM mysql.user
    ORDER BY User, Host
  `)

  const users = userRows as MysqlUserRow[]

  const [userPrivRows] = await connection.query(`
    SELECT GRANTEE, PRIVILEGE_TYPE, IS_GRANTABLE
    FROM information_schema.USER_PRIVILEGES
  `)

  const userPrivileges = userPrivRows as UserPrivilegeRow[]

  const [schemaPrivRows] = await connection.query(`
    SELECT GRANTEE, TABLE_SCHEMA, PRIVILEGE_TYPE, IS_GRANTABLE
    FROM information_schema.SCHEMA_PRIVILEGES
  `)

  const schemaPrivileges = schemaPrivRows as SchemaPrivilegeRow[]

  const [tablePrivRows] = await connection.query(`
    SELECT GRANTEE, TABLE_SCHEMA, TABLE_NAME, PRIVILEGE_TYPE, IS_GRANTABLE
    FROM information_schema.TABLE_PRIVILEGES
  `)

  const tablePrivileges = tablePrivRows as TablePrivilegeRow[]

  const SHOW_GRANTS_TIMEOUT_MS = 5_000
  const grantsMap = new Map<string, string[]>()

  for (const row of users) {
    if (SYSTEM_USERS.has(row.User)) continue

    const key = `${row.User}@${row.Host}`
    try {
      const queryPromise = connection.query(`SHOW GRANTS FOR ?@?`, [row.User, row.Host])
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SHOW GRANTS timeout')), SHOW_GRANTS_TIMEOUT_MS),
      )
      const [grantRows] = await Promise.race([queryPromise, timeoutPromise]) as [import('mysql2').RowDataPacket[], unknown]
      const grants = (grantRows as Record<string, unknown>[]).map((r) => Object.values(r)[0] as string)
      grantsMap.set(key, grants)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[user-fetcher] SHOW GRANTS failed for ${key}: ${msg}`)
      grantsMap.set(key, [])
    }
  }

  return { users, userPrivileges, schemaPrivileges, tablePrivileges, grantsMap }
}

export function parseGrantee(grantee: string): { user: string; host: string } {
  const m = /^'([^']*)'@'([^']*)'$/.exec(grantee)
  if (!m) return { user: grantee, host: '' }
  return { user: m[1], host: m[2] }
}
