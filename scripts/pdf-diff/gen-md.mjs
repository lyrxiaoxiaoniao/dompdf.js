/**
 * gen-md.mjs — 临时验证脚本，从已有 report.json 生成 report.md
 * 用法：node scripts/pdf-diff/gen-md.mjs <report.json路径>
 */
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeMarkdownReport } from './lib/md-report.mjs';

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('用法: node scripts/pdf-diff/gen-md.mjs <report.json路径>');
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const outDir = dirname(reportPath);
writeMarkdownReport(outDir, report);
console.log(`✅ report.md 已生成到: ${outDir}\\report.md`);
