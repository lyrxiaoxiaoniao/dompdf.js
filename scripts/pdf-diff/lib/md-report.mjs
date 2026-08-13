/**
 * md-report.mjs
 * 将 pdf-diff report.json 转换为人类可读的 Markdown 报告。
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── 工具函数 ────────────────────────────────────────────────────────────────

function pct(ratio) {
  return (ratio * 100).toFixed(2) + '%';
}

function statusBadge(status) {
  return status === 'pass' ? '✅ PASS' : '⚠️ NEEDS REVIEW';
}

function severityIcon(sev) {
  if (sev === 'high') return '🔴';
  if (sev === 'medium') return '🟠';
  return '🟡';
}

function categoryLabel(cat) {
  const labels = {
    'wrap':         '文本换行差异 (wrap)',
    'text-x-drift': '横向位移 (text-x-drift)',
    'text-y-drift': '纵向位移 (text-y-drift)',
    'page-break':   '分页错误 (page-break)',
    'font-size':    '字号偏差 (font-size)',
    'font-family':  '字体选择 (font-family)',
    'color':        '颜色偏差 (color)',
    'bg-color':     '背景色偏差 (bg-color)',
    'bg-missing-capture': '背景漏采 (bg-missing-capture)',
    'border':       '边框缺失/偏差 (border)',
    'shadow':       '阴影 (shadow)',
    'image':        '图片差异 (image)',
    'transform':    '变换矩阵 (transform)',
    'icon':         '图标 (icon)',
    'raster-geometry-drift': '位图几何漂移 (raster-geometry-drift)',
  };
  return labels[cat] || cat;
}

// ── 主要生成函数 ─────────────────────────────────────────────────────────────

export function buildMarkdownReport(report) {
  const lines = [];
  const { input, readiness, normalizedFont, layout, pageCount,
          tier1, tier2, tier2b, tier3, summary, generatedAt, output } = report;

  // ── 标题 ──
  lines.push(`# PDF Diff 报告`);
  lines.push(``);
  lines.push(`> 生成时间：${new Date(generatedAt).toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`> 目标页面：\`${input.url}\`　选择器：\`${input.selector}\``);
  lines.push(``);

  // ── 总览 ──
  lines.push(`## 📊 总体结论`);
  lines.push(``);
  lines.push(`| 项目 | 值 |`);
  lines.push(`|---|---|`);
  lines.push(`| 状态 | **${statusBadge(summary.status)}** |`);
  lines.push(`| 总页数 | ${pageCount} 页 |`);
  lines.push(`| 平均像素差异 | ${pct(summary.aggregateMismatchRatio)} |`);
  lines.push(`| 最大单页像素差异 | ${pct(summary.maxMismatchRatio)} |`);
  lines.push(`| 文本结构差异条数 | ${summary.discrepancyCount} |`);
  lines.push(`| 视觉元素差异条数 | ${summary.visualDiscrepancyCount} |`);
  lines.push(``);

  // ── Tier 1：逐页像素差异 ──
  lines.push(`## 🖼️ Tier 1 — 逐页像素差异`);
  lines.push(``);
  lines.push(`> 阈值说明：差异率 ≤ 1.5% 为绿色，≤ 5% 为黄色，> 5% 为红色。`);
  lines.push(``);
  lines.push(`| 页码 | 差异像素数 | 差异率 | 等级 |`);
  lines.push(`|:---:|---:|---:|:---:|`);
  for (const p of (tier1?.pixelDiff?.pages || [])) {
    const r = p.mismatchRatio;
    const icon = r <= 0.015 ? '🟢' : r <= 0.05 ? '🟡' : '🔴';
    lines.push(`| 第 ${p.pageNumber} 页 | ${p.mismatchPixels.toLocaleString()} px | ${pct(r)} | ${icon} |`);
  }
  lines.push(``);

  // ── Tier 2：文本结构差异 ──
  lines.push(`## 📝 Tier 2 — 文本结构差异`);
  lines.push(``);
  const t2 = tier2?.summary || {};
  lines.push(`| 指标 | 值 |`);
  lines.push(`|---|---:|`);
  lines.push(`| Oracle 文本项 | ${t2.oracleItems ?? '-'} |`);
  lines.push(`| 实际 PDF 文本项 | ${t2.actualItems ?? '-'} |`);
  lines.push(`| 成功对齐 | ${t2.aligned ?? '-'} |`);
  lines.push(`| Oracle 未匹配 | ${t2.unmatchedOracle ?? '-'} |`);
  lines.push(`| 实际未匹配 | ${t2.unmatchedActual ?? '-'} |`);
  lines.push(`| 字符覆盖率 | ${t2.charCoverage != null ? pct(t2.charCoverage) : '-'} |`);
  lines.push(`| 均值 Δx | ${t2.meanDx?.toFixed(3) ?? '-'} |`);
  lines.push(`| 均值 Δy | ${t2.meanDy?.toFixed(3) ?? '-'} |`);
  lines.push(`| 均值 ΔfontSize | ${t2.meanDFontSize?.toFixed(4) ?? '-'} |`);
  lines.push(`| 均值 ΔWidth | ${t2.meanDWidth?.toFixed(3) ?? '-'} |`);
  lines.push(``);

  const discrepancies = tier2?.discrepancies || [];
  if (discrepancies.length > 0) {
    lines.push(`### 位置/宽度差异明细`);
    lines.push(``);
    for (const d of discrepancies) {
      const shortText = d.text.replace(/\s+/g, ' ').slice(0, 60) + (d.text.length > 60 ? '…' : '');
      lines.push(`#### \`${shortText}\``);
      lines.push(``);
      lines.push(`| 维度 | Oracle（参照） | 实际 PDF | 差值 |`);
      lines.push(`|---|---:|---:|---:|`);
      lines.push(`| X 坐标 | ${d.oracle.x} | ${d.actual.x} | ${d.delta.dx ?? 0} |`);
      lines.push(`| Y 坐标 | ${d.oracle.y} | ${d.actual.y} | ${d.delta.dy ?? 0} |`);
      lines.push(`| 字号 | ${d.oracle.fontSize} | ${d.actual.fontSize ?? '-'} | ${d.delta.dFontSize ?? 0} |`);
      lines.push(`| 宽度 | ${d.oracle.width} | ${d.actual.width} | **${(d.delta.dWidth ?? 0).toFixed(2)}** |`);
      if (d.actual.page) lines.push(`| 所在页 | — | 第 ${d.actual.page} 页 | — |`);
      lines.push(``);
    }
  } else {
    lines.push(`> ✅ 无位置/宽度差异。`);
    lines.push(``);
  }

  // 未匹配汇总
  const unmOracle = tier2?.unmatched?.oracle || [];
  const unmActual = tier2?.unmatched?.actual || [];
  if (unmOracle.length > 0 || unmActual.length > 0) {
    lines.push(`### 未匹配文本（换行/分段差异）`);
    lines.push(``);
    lines.push(`> 这些文本内容本身存在，但 Oracle 与 PDF 的分段/换行方式不同，导致无法一一对应。`);
    lines.push(`> 通常由 **文本换行算法差异** 引起，不代表内容丢失。`);
    lines.push(``);
    if (unmOracle.length > 0) {
      lines.push(`<details>`);
      lines.push(`<summary>Oracle 未匹配：${unmOracle.length} 条（点击展开）</summary>`);
      lines.push(``);
      for (const u of unmOracle) {
        const t = u.text.replace(/\s+/g, ' ').slice(0, 80);
        lines.push(`- \`${t}\``);
      }
      lines.push(``);
      lines.push(`</details>`);
      lines.push(``);
    }
    if (unmActual.length > 0) {
      lines.push(`<details>`);
      lines.push(`<summary>实际 PDF 未匹配：${unmActual.length} 条（点击展开）</summary>`);
      lines.push(``);
      for (const u of unmActual) {
        const t = u.text.replace(/\s+/g, ' ').slice(0, 80);
        const pg = u.page ? ` （第 ${u.page} 页）` : '';
        lines.push(`- \`${t}\`${pg}`);
      }
      lines.push(``);
      lines.push(`</details>`);
      lines.push(``);
    }
  }

  // ── Tier 2b：视觉元素差异 ──
  lines.push(`## 🎨 Tier 2b — 视觉元素差异（背景色 / 边框 / 阴影 / 图标）`);
  lines.push(``);
  const t2b = tier2b?.summary || {};
  lines.push(`检测元素数：**${t2b.elementCount ?? 0}**　发现差异：**${t2b.discrepancyCount ?? 0}** 条`);
  if (t2b.counts) {
    lines.push(``);
    lines.push(`| 类型 | 差异数 |`);
    lines.push(`|---|---:|`);
    for (const [k, v] of Object.entries(t2b.counts)) {
      lines.push(`| ${k} | ${v} |`);
    }
  }
  lines.push(``);

  const vDiscrepancies = tier2b?.discrepancies || [];
  if (vDiscrepancies.length > 0) {
    lines.push(`### 视觉差异明细`);
    lines.push(``);
    for (const d of vDiscrepancies) {
      const kindLabel = d.kind === 'bg-color'
        ? '背景色'
        : d.kind === 'bg-missing-capture'
          ? '背景漏采'
          : d.kind === 'border'
            ? '边框'
            : d.kind === 'raster-geometry-drift'
              ? '位图几何漂移'
              : d.kind;
      lines.push(`- **${kindLabel}** \`<${d.tag}>\` (${d.nodeId}) — 第 ${d.page} 页`);
      lines.push(`  - 位置：x=${d.box.x}, y=${d.box.y}, w=${d.box.w}, h=${d.box.h}`);
      if (d.expected) lines.push(`  - 期望：\`${d.expected}\``);
      if (d.actual) lines.push(`  - 实际：\`${d.actual}\``);
      if (d.delta?.deltaE != null) lines.push(`  - 色差 ΔE：${d.delta.deltaE}`);
      if (d.side) lines.push(`  - 边：${d.side}`);
    }
    lines.push(``);
  } else {
    lines.push(`> ✅ 无视觉元素差异。`);
    lines.push(``);
  }

  // ── Tier 3：根因分类 ──
  lines.push(`## 🔍 Tier 3 — 根因分类`);
  lines.push(``);
  const cats = tier3?.categories || [];
  if (cats.length === 0) {
    lines.push(`> ✅ 未检测到需关注的根因类别。`);
    lines.push(``);
  } else {
    lines.push(`| 类别 | 数量 | 严重度 | 疑似文件 | 疑似函数 |`);
    lines.push(`|---|---:|:---:|---|---|`);
    for (const c of cats) {
      lines.push(`| ${severityIcon(c.severity)} ${categoryLabel(c.category)} | ${c.count} | ${c.severity} | \`${c.suspected?.file ?? '-'}\` | \`${c.suspected?.fn ?? '-'}\` |`);
    }
    lines.push(``);
    lines.push(`### 修复线索`);
    lines.push(``);
    for (const c of cats) {
      lines.push(`#### ${severityIcon(c.severity)} ${categoryLabel(c.category)}`);
      lines.push(``);
      lines.push(`> ${c.hint}`);
      lines.push(``);
      if (c.suspected?.also) {
        lines.push(`- 另请检查：\`${c.suspected.also}\``);
      }
      // 示例
      const samples = c.samples || [];
      if (samples.length > 0) {
        lines.push(``);
        lines.push(`<details>`);
        lines.push(`<summary>差异样本（${samples.length} 条）</summary>`);
        lines.push(``);
        for (const s of samples.slice(0, 5)) {
          if (s.text) {
            const t = s.text.replace(/\s+/g, ' ').slice(0, 60);
            lines.push(`- 文本：\`${t}\``);
            if (s.delta?.dWidth != null) lines.push(`  - ΔWidth = ${s.delta.dWidth.toFixed(2)}`);
          } else if (s.nodeId) {
            lines.push(`- 元素 \`<${s.tag}>\` (${s.nodeId}) 第 ${s.page} 页`);
            if (s.expected) lines.push(`  - 期望：\`${s.expected}\`，实际：\`${s.actual}\``);
          }
        }
        lines.push(``);
        lines.push(`</details>`);
        lines.push(``);
      } else {
        lines.push(``);
      }
    }
  }

  // ── 输出文件 ──
  lines.push(`## 📁 输出文件`);
  lines.push(``);
  lines.push(`| 文件 | 说明 |`);
  lines.push(`|---|---|`);
  lines.push(`| \`actual.pdf\` | dompdf.js 生成的 PDF |`);
  lines.push(`| \`ref.pdf\` | Chromium 参照 PDF |`);
  lines.push(`| \`html-source.png\` | 原始 HTML 截图 |`);
  lines.push(`| \`oracle.json\` | Range API 文字真值 |`);
  lines.push(`| \`report.json\` | 完整结构化报告 |`);
  lines.push(`| \`report.md\` | 本文件（人类可读） |`);
  lines.push(`| \`*-page-N.png\` | 各页像素差异图 |`);
  lines.push(``);
  if (output?.rootDir) {
    lines.push(`> 输出目录：\`${output.rootDir}\``);
    lines.push(``);
  }

  // ── 字体 & 就绪信息 ──
  lines.push(`## ℹ️ 运行环境`);
  lines.push(``);
  lines.push(`| 项目 | 值 |`);
  lines.push(`|---|---|`);
  lines.push(`| 页面就绪状态 | ${readiness?.status ?? '-'} |`);
  lines.push(`| Font API 可用 | ${readiness?.hasFontAPI ? '是' : '否'} |`);
  lines.push(`| 图片数量 | ${readiness?.imageCount ?? 0} |`);
  lines.push(`| 加载字体数 | ${normalizedFont?.loadedCount ?? '-'} |`);
  lines.push(`| 字体族 | \`${normalizedFont?.family ?? '-'}\` |`);
  lines.push(`| 页面尺寸 | ${layout?.contentWidthPx ?? '-'} × ${layout?.contentHeightPx ?? '-'} px |`);
  if (readiness?.warnings?.length > 0) {
    lines.push(``);
    lines.push(`**警告：**`);
    for (const w of readiness.warnings) {
      lines.push(`- ${w}`);
    }
  }
  lines.push(``);

  lines.push(`---`);
  lines.push(`*由 dompdf.js pdf-diff 工具自动生成*`);

  return lines.join('\n');
}

export function writeMarkdownReport(outDir, report) {
  const md = buildMarkdownReport(report);
  writeFileSync(resolve(outDir, 'report.md'), md, 'utf8');
}
