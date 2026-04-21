import ExcelJS from 'exceljs'
import type { AuditResult, AuditUser, AuditFlag } from '../types.js'

const RULE_LABELS: Record<string, string> = {
  SUPER_PRIVILEGE: 'SUPER Privilege',
  ALL_PRIVILEGES_GLOBAL: 'ALL PRIVILEGES on *.*',
  GRANT_OPTION_GLOBAL: 'GRANT OPTION on *.*',
  FILE_PRIVILEGE: 'FILE Privilege',
  DANGEROUS_INFRA_PRIV: 'Dangerous Infra Privilege',
  WILDCARD_HOST: 'Wildcard Host (%)',
  PASSWORD_EXPIRED: 'Password Expired',
  ALL_PRIVILEGES_SCHEMA: 'ALL PRIVILEGES on Schema',
  USER_MANAGEMENT_PRIV: 'User Management Privilege',
  NO_PASSWORD_LIFETIME: 'No Password Expiry Policy',
  WILDCARD_HOST_SELECT_ONLY: 'Wildcard Host (SELECT only)',
  DUPLICATE_USERNAME: 'Duplicate Username',
}

interface ExcelColor {
  argb: string
}

const RISK_COLORS: Record<string, { fill: ExcelColor; font: ExcelColor }> = {
  HIGH: { fill: { argb: 'FFFEE2E2' }, font: { argb: 'FF991B1B' } },
  MEDIUM: { fill: { argb: 'FFFEF3C7' }, font: { argb: 'FF92400E' } },
  LOW: { fill: { argb: 'FFDBEAFE' }, font: { argb: 'FF5B21B6' } },
  CLEAN: { fill: { argb: 'FFD1FAE5' }, font: { argb: 'FF065F46' } },
}

function formatFlags(flags: AuditFlag[]): string {
  return flags.map(f => `[${f.severity}] ${RULE_LABELS[f.rule] || f.rule}: ${f.detail}`).join('\n')
}

function addSummarySheet(workbook: ExcelJS.Workbook, result: AuditResult): void {
  const sheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 1 }]
  })

  // Title
  sheet.mergeCells('A1:B1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'Rogue DB User Audit Report'
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 30

  // Instance info
  sheet.addRow(['Instance:', result.instance])
  sheet.addRow(['Audited At:', new Date(result.auditedAt).toLocaleString()])
  sheet.addRow(['Total Users:', result.summary.totalUsers])
  sheet.addRow(['System Users (excluded):', result.summary.systemUsers])
  sheet.addRow([])

  // Risk summary header
  const riskHeaderRow = sheet.addRow(['Risk Level', 'Count'])
  riskHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  riskHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
  riskHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' }

  // Risk counts with color coding
  const riskRows = [
    { level: 'HIGH', count: result.summary.highRisk },
    { level: 'MEDIUM', count: result.summary.mediumRisk },
    { level: 'LOW', count: result.summary.lowRisk },
    { level: 'CLEAN', count: result.summary.clean },
  ]

  riskRows.forEach(({ level, count }) => {
    const row = sheet.addRow([level, count])
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: RISK_COLORS[level].fill }
    row.getCell(1).font = { bold: true, color: RISK_COLORS[level].font }
    row.getCell(2).font = { bold: true }
    row.getCell(2).alignment = { horizontal: 'center' }
  })

  // Column widths
  sheet.getColumn(1).width = 30
  sheet.getColumn(2).width = 40

  // Borders
  sheet.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }
      })
    }
  })
}

function addUsersSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  users: AuditUser[],
  riskLevel: string
): void {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }]
  })

  // Header
  const headerRow = sheet.addRow([
    'User',
    'Host',
    'Plugin',
    'Risk Level',
    'Flags Count',
    'Flags Detail',
    'Password Expired',
    'Account Locked',
    'Password Lifetime (days)',
    'Grants Summary',
  ])

  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  headerRow.height = 30

  // Data rows
  users.forEach(user => {
    const row = sheet.addRow([
      user.user,
      user.host,
      user.plugin,
      user.riskLevel,
      user.flags.length,
      formatFlags(user.flags),
      user.passwordExpired ? 'YES' : 'NO',
      user.accountLocked ? 'YES' : 'LOCKED',
      user.passwordLifetime !== null ? user.passwordLifetime : 'NULL',
      user.grantsSummary.join('\n'),
    ])

    // Risk level cell color
    const riskCell = row.getCell(4)
    riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: RISK_COLORS[user.riskLevel].fill }
    riskCell.font = { bold: true, color: RISK_COLORS[user.riskLevel].font }
    riskCell.alignment = { horizontal: 'center', vertical: 'middle' }

    // Flags count cell
    const flagsCountCell = row.getCell(5)
    flagsCountCell.alignment = { horizontal: 'center', vertical: 'middle' }
    if (user.flags.length > 0) {
      flagsCountCell.font = { bold: true, color: { argb: 'FFD97706' } }
    }

    // Wrap text for long content
    row.getCell(6).alignment = { wrapText: true, vertical: 'top' }
    row.getCell(10).alignment = { wrapText: true, vertical: 'top' }

    // Boolean cells
    ;[7, 8].forEach(colNum => {
      const cell = row.getCell(colNum)
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      if (cell.value === 'YES') {
        cell.font = { color: { argb: 'FFDC2626' }, bold: true }
      }
    })
  })

  // Column widths
  sheet.getColumn(1).width = 20  // User
  sheet.getColumn(2).width = 20  // Host
  sheet.getColumn(3).width = 20  // Plugin
  sheet.getColumn(4).width = 15  // Risk Level
  sheet.getColumn(5).width = 12  // Flags Count
  sheet.getColumn(6).width = 50  // Flags Detail
  sheet.getColumn(7).width = 18  // Password Expired
  sheet.getColumn(8).width = 18  // Account Locked
  sheet.getColumn(9).width = 20  // Password Lifetime
  sheet.getColumn(10).width = 50 // Grants Summary

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 10 },
  }

  // Borders for all cells
  sheet.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }
      })
    }
  })
}

export async function generateExcelReport(result: AuditResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  workbook.creator = 'Rogue User Watchdog'
  workbook.created = new Date(result.auditedAt)
  workbook.modified = new Date()

  // Add sheets
  addSummarySheet(workbook, result)

  const high = result.users.filter(u => u.riskLevel === 'HIGH')
  const medium = result.users.filter(u => u.riskLevel === 'MEDIUM')
  const low = result.users.filter(u => u.riskLevel === 'LOW')
  const clean = result.users.filter(u => u.riskLevel === 'CLEAN')

  if (high.length > 0) addUsersSheet(workbook, 'High Risk Users', high, 'HIGH')
  if (medium.length > 0) addUsersSheet(workbook, 'Medium Risk Users', medium, 'MEDIUM')
  if (low.length > 0) addUsersSheet(workbook, 'Low Risk Users', low, 'LOW')
  if (clean.length > 0) addUsersSheet(workbook, 'Clean Users', clean, 'CLEAN')

  // All users sheet
  addUsersSheet(workbook, 'All Users', result.users, 'ALL')

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
