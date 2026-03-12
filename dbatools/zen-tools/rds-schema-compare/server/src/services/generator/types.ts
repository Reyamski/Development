export interface GenerationOutput {
  filesWritten: string[];
  totalStatements: number;
  sql?: string; // present in single-file mode
}
