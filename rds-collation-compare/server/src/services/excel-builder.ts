import ExcelJS from 'exceljs';
import type { CollationReport } from '../types.js';
import { matchesBaseline } from './collation-analyzer.js';

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A8A' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const MISMATCH_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFEE2E2' },
};

const MISMATCH_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FF991B1B' },
  bold: true,
};

function styleHeader(row: ExcelJS.Row) {
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 20;
}

function applyAutoFilter(sheet: ExcelJS.Worksheet) {
  if (sheet.rowCount < 1) return;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };
}

function autosize(sheet: ExcelJS.Worksheet, min = 10, max = 50) {
  sheet.columns.forEach((col) => {
    let maxLen = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value == null ? '' : String(cell.value);
      if (v.length > maxLen) maxLen = v.length;
    });
    col.width = Math.min(max, maxLen + 2);
  });
}

export async function buildCollationWorkbook(report: CollationReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RDS Collation Compare';
  wb.created = new Date();

  const { instance, databases, baseline, collations, issues, timestamp } = report;

  const totalDbs = new Set(collations.filter(c => c.level === 'database').map(c => c.database)).size;
  const totalTables = collations.filter(c => c.level === 'table').length;
  const totalColumns = collations.filter(c => c.level === 'column').length;
  const mismatchCount = collations.filter(c => !matchesBaseline(c, baseline)).length;

  // ===== Summary =====
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 60 },
  ];
  styleHeader(summary.getRow(1));

  summary.addRows([
    { field: 'Instance', value: instance },
    { field: 'Scanned databases', value: databases.join(', ') },
    { field: 'Scan timestamp', value: timestamp },
    { field: 'Baseline character set', value: baseline.characterSet },
    { field: 'Baseline collation', value: baseline.collation },
    { field: 'Total databases', value: totalDbs },
    { field: 'Total tables', value: totalTables },
    { field: 'Total columns', value: totalColumns },
    { field: 'Total mismatches', value: mismatchCount },
    { field: 'Total issues flagged', value: issues.length },
  ]);
  summary.getColumn('field').font = { bold: true };

  // ===== Mismatches (main sheet) =====
  const mism = wb.addWorksheet('Mismatches');
  mism.columns = [
    { header: 'Severity', key: 'severity', width: 10 },
    { header: 'Level', key: 'level', width: 10 },
    { header: 'Database', key: 'database', width: 24 },
    { header: 'Table', key: 'table', width: 30 },
    { header: 'Column', key: 'column', width: 24 },
    { header: 'Current charset', key: 'currentCharset', width: 16 },
    { header: 'Current collation', key: 'currentCollation', width: 26 },
    { header: 'Expected charset', key: 'expectedCharset', width: 16 },
    { header: 'Expected collation', key: 'expectedCollation', width: 26 },
    { header: 'Deviation', key: 'type', width: 22 },
    { header: 'Description', key: 'description', width: 60 },
  ];
  styleHeader(mism.getRow(1));

  for (const iss of issues) {
    mism.addRow({
      severity: iss.severity,
      level: iss.level,
      database: iss.database,
      table: iss.table ?? '',
      column: iss.column ?? '',
      currentCharset: iss.currentCharset,
      currentCollation: iss.currentCollation,
      expectedCharset: iss.expectedCharset,
      expectedCollation: iss.expectedCollation,
      type: iss.type,
      description: iss.description,
    });
  }
  applyAutoFilter(mism);
  mism.views = [{ state: 'frozen', ySplit: 1 }];

  // ===== Per-level sheets =====
  const perLevel = (title: string, level: 'database' | 'table' | 'column') => {
    const sheet = wb.addWorksheet(title);
    const cols: Partial<ExcelJS.Column>[] = [
      { header: 'Database', key: 'database', width: 24 },
    ];
    if (level !== 'database') cols.push({ header: 'Table', key: 'table', width: 30 });
    if (level === 'column') cols.push({ header: 'Column', key: 'column', width: 24 });
    cols.push(
      { header: 'Character set', key: 'characterSet', width: 16 },
      { header: 'Collation', key: 'collation', width: 26 },
      { header: 'Mismatch?', key: 'isMismatch', width: 12 },
    );
    sheet.columns = cols;
    styleHeader(sheet.getRow(1));

    const rows = collations.filter(c => c.level === level);
    for (const c of rows) {
      const row = sheet.addRow({
        database: c.database,
        table: c.table ?? '',
        column: c.column ?? '',
        characterSet: c.characterSet,
        collation: c.collation,
        isMismatch: matchesBaseline(c, baseline) ? 'no' : 'YES',
      });
      if (!matchesBaseline(c, baseline)) {
        row.eachCell((cell) => {
          cell.fill = MISMATCH_FILL;
          cell.font = MISMATCH_FONT;
        });
      }
    }
    applyAutoFilter(sheet);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    autosize(sheet);
  };

  perLevel('Databases', 'database');
  perLevel('Tables', 'table');
  perLevel('Columns', 'column');

  // ===== All (flat) =====
  const all = wb.addWorksheet('All (flat)');
  all.columns = [
    { header: 'Level', key: 'level', width: 10 },
    { header: 'Database', key: 'database', width: 24 },
    { header: 'Table', key: 'table', width: 30 },
    { header: 'Column', key: 'column', width: 24 },
    { header: 'Character set', key: 'characterSet', width: 16 },
    { header: 'Collation', key: 'collation', width: 26 },
    { header: 'Mismatch?', key: 'isMismatch', width: 12 },
    { header: 'Expected charset', key: 'expectedCharset', width: 16 },
    { header: 'Expected collation', key: 'expectedCollation', width: 26 },
  ];
  styleHeader(all.getRow(1));
  for (const c of collations) {
    const mismatch = !matchesBaseline(c, baseline);
    const row = all.addRow({
      level: c.level,
      database: c.database,
      table: c.table ?? '',
      column: c.column ?? '',
      characterSet: c.characterSet,
      collation: c.collation,
      isMismatch: mismatch ? 'YES' : 'no',
      expectedCharset: baseline.characterSet,
      expectedCollation: baseline.collation,
    });
    if (mismatch) {
      row.eachCell((cell) => {
        cell.fill = MISMATCH_FILL;
        cell.font = MISMATCH_FONT;
      });
    }
  }
  applyAutoFilter(all);
  all.views = [{ state: 'frozen', ySplit: 1 }];

  autosize(summary);
  autosize(mism);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
