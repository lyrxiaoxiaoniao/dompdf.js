﻿﻿﻿﻿﻿﻿﻿﻿﻿(function () {
  /* ========================= Globals ========================= */
  var api = window.dompdf;
  var markedApi = window.marked;
  var purifier = window.DOMPurify;

  var statusDotEl = document.getElementById('status-dot');
  var statusTextEl = document.getElementById('status-text');
  var topLoadingOverlayEl = document.getElementById('top-loading-overlay');
  var topLoadingTextEl = document.getElementById('top-loading-text');
  var docEl = document.getElementById('document');
  var topbarPageInfo = document.getElementById('topbar-page-info');
  var benchmarkMetaEl = document.getElementById('benchmark-meta');
  var benchmarkCompressLabelEl = document.getElementById('benchmark-compress-label');
  var benchmarkCompressToggleEl = document.getElementById('benchmark-compress-toggle');

  var html2pdfLoader = null;
  var pdfJsLoader = null;
  var pdfJsReady = false;
  var overlayOn = false;
  var activeTab = 'basic';
  var LOCALE_STORAGE_KEY = 'dompdf-studio-locale';
  var currentLocale = getSavedLocale();
  var benchmarkMode = 'light';
  var benchmarkCompressEnabled = true;
  var benchmarkBuildVersion = 0;
  var benchmarkBuildPromise = Promise.resolve();
  var benchmarkBuildInProgress = false;
  var originalStaticContent = Object.create(null);
  var staticContentCaptured = false;

  /* Font configs */
  var sharedFontConfig = {
    fontFamily: 'SourceHanSansSC-Regular',
    fontStyle: 'normal',
    fontWeight: 400
  };
  var symbolFontConfig = null;

  /* Comparison state */
  var generatedBlobs = { dompdf: null, html2pdf: null };

  /* Markdown editor */
  var vditor = null;
  var vditorCdnBase = './vendor/vditor';
  var mdRenderTimer = 0;
  var activeTheme = 'paper';
  var I18N = {
    en: {
      themeLabels: {
        paper: 'Paper Light',
        midnight: 'Midnight Blue',
        slate: 'Slate Editorial',
        sepia: 'Sepia Notebook'
      },
      mdSample: [
        "# Product Weekly Update",
        "",
        "> This sample verifies live Markdown rendering, theme switching, and copyable paginated text after PDF export.",
        "",
        "## Weekly Summary",
        "",
        "- New-user registration conversion increased by **12.6%**",
        "- First support response time dropped from `7m 24s` to `4m 10s`",
        "- Documentation site migration is complete; export stress testing remains",
        "",
        "## Key Work",
        "",
        "1. Finish field mapping from rich text to Markdown.",
        "2. Unify PDF headers and footers into configurable templates.",
        "3. Validate CJK font export quality under dark themes.",
        "",
        "## Task List",
        "",
        "- [x] Enable live preview",
        "- [x] Support multi-theme switching",
        "- [ ] Add more business templates",
        "",
        "## Code Snippet",
        "",
        "```ts",
        "const blob = await window.dompdf(previewRoot, {",
        "  format: 'a4',",
        "  pagination: true,",
        "  useCORS: true",
        "});",
        "```",
        "",
        "## Comparison Table",
        "",
        "| Metric | Current | Delta |",
        "| --- | ---: | ---: |",
        "| WAU | 124,500 | +8.4% |",
        "| Renewal Rate | 71.2% | +2.1% |",
        "| Average Export Time | 428ms | -16.0% |",
        "",
        "## Notes",
        "",
        "Once Markdown is rendered into HTML, the preview panel on the right becomes the exact DOM exported to PDF."
      ].join("\n"),
      runtime: {
        processing: 'Processing...',
        parsingPage: 'Parsing page...',
        countingPages: function (totalPages) {
          return totalPages ? ('Counting total pages... ' + totalPages + ' pages') : 'Counting total pages...';
        },
        renderingPdf: function (currentPage, totalPages) {
          if (currentPage && totalPages) return 'Rendering PDF... page ' + currentPage + ' / ' + totalPages;
          if (totalPages) return 'Rendering PDF... ' + totalPages + ' pages total';
          return 'Rendering PDF...';
        },
        benchmarkCompressOn: 'On',
        benchmarkCompressOff: 'Off',
        benchmarkMeta: function (mode, compressEnabled, building) {
          var suffix = compressEnabled ? ' · Compression on' : ' · Compression off';
          if (mode === 'light') return 'Current mode: lightweight benchmark · 1 short text group' + suffix;
          if (mode === 'extreme') return (building
            ? 'Current mode: 10,000-page test · generating 8,940 ultra-long text groups'
            : 'Current mode: 10,000-page test · 8,940 ultra-long text groups') + suffix;
          return 'Current mode: heavy benchmark · 440 ultra-long text groups' + suffix;
        },
        fontNotReady: 'Chinese font is still loading. Please try again shortly.',
        markdownLoading: 'Markdown resources are still loading. Please wait...',
        buildExtreme: 'Building the 10,000-page sample...',
        rebuildBenchmark: 'Rebuilding benchmark sample...',
        extremeReady: '10,000-page sample is ready',
        benchmarkReady: 'Benchmark sample updated',
        toolbarDisabledTitle: 'Chinese font is loading. Please wait...',
        dompdfRunning: 'Running dompdf.js...',
        html2pdfRunning: 'Running html2pdf.js...',
        compareDompdf: 'Comparing dompdf.js...',
        compareHtml2pdf: 'Comparing html2pdf.js...',
        dompdfDone: function (duration, size) {
          return 'dompdf.js export complete · ' + duration + ' · ' + size;
        },
        html2pdfDone: function (duration, size, blankPdfSuspected) {
          return 'html2pdf.js export complete · ' + duration + ' · ' + size + (blankPdfSuspected ? ' · suspected blank PDF' : '');
        },
        compareDone: 'Comparison complete',
        compareDoneBlank: 'Comparison complete · html2pdf.js may be blank',
        blankPdfNote: ' (suspected blank PDF)',
        speedFaster: function (ratio) { return 'dompdf.js is ' + ratio.toFixed(1) + 'x faster'; },
        speedSlower: function (ratio) { return 'html2pdf.js is ' + ratio.toFixed(1) + 'x faster'; },
        sizeReduced: function (pct) { return 'dompdf.js reduces file size by ' + pct.toFixed(1) + '%'; },
        sizeIncreased: function (pct) { return 'dompdf.js increases file size by ' + pct.toFixed(1) + '%'; },
        approxDocPages: function (pages) { return 'Approx. ' + pages + ' pages'; },
        markdownDepsFailed: 'Failed to load Markdown dependencies',
        markdownPlaceholder: 'Start typing Markdown here...',
        markdownChars: function (count) { return count + ' chars'; },
        markdownWords: function (count) { return count + ' words'; },
        markdownLines: function (count) { return count + ' lines'; },
        markdownPages: function (count) { return 'Approx. ' + count + ' pages'; },
        missingBuild: 'dist/dompdf.js not found. Run npm run build first.',
        loadingResources: 'Loading fonts and editor assets...',
        ready: 'ready',
        readyWithSymbol: 'ready (symbol font loaded)',
        fontWarning: function (message) { return 'Font loading warning: ' + message; },
        exportHeader: 'dompdf.js Studio Demo',
        exportFooter: 'Page ${currentPage} / ${totalPages}',
        chartTitle: 'Small raster sample',
        chartSubtitle: 'Used only to validate image embedding and compression.'
      },
      tableGroups: [
        {
          group: 'North Region / Urban Renewal',
          statusText: 'Exceeded',
          statusClass: 'is-good',
          rows: [
            ['$12.4M', '36.2%', '$14.8M', '38.0%'],
            ['$8.2M', '28.5%', '$9.5M', '30.2%']
          ]
        },
        {
          group: 'Asia-Pacific / Procurement',
          statusText: 'On Target',
          statusClass: 'is-stable',
          rows: [
            ['$14.1M', '32.8%', '$16.5M', '34.5%'],
            ['$5.6M', '14.3%', '$6.2M', '15.1%']
          ]
        },
        {
          group: 'Europe / Compliance Archive',
          statusText: 'Watch',
          statusClass: 'is-watch',
          rows: [
            ['$9.7M', '24.8%', '$10.9M', '26.1%'],
            ['$4.4M', '11.6%', '$4.9M', '12.2%']
          ]
        },
        {
          group: 'Public Sector / Delivery Ops',
          statusText: 'Exceeded',
          statusClass: 'is-good',
          rows: [
            ['$11.3M', '34.7%', '$13.2M', '35.8%'],
            ['$6.8M', '19.4%', '$7.6M', '20.6%']
          ]
        }
      ],
      longList: {
        light: 'This lightweight benchmark keeps the appendix intentionally short so you can focus on raw pagination throughput without amplifying text shaping, wrapping, and compression costs too aggressively.',
        heavy: ('This appendix intentionally uses a single extra-long English paragraph to stress the PDF pipeline with sustained text flow, repeated clauses, dense punctuation, and business-style wording so that pagination, line breaking, glyph mapping, text extraction order, copy and search behavior, and final file size differences become easier to observe across many repeated blocks; the goal is not decorative content but a realistic wall of text that behaves like procurement documentation, compliance reports, technical specifications, audit notes, migration guidance, implementation summaries, delivery constraints, and appendix remarks merged into one uninterrupted narrative where every sentence keeps pushing the layout engine to preserve semantic reading order, stable wrapping, predictable page boundaries, and compact vector-first output instead of falling back to page-sized bitmap capture that tends to grow much faster as document length increases. ').repeat(5).trim()
      }
    },
    zh: {
      themeLabels: {
        paper: 'Paper Light',
        midnight: 'Midnight Blue',
        slate: 'Slate Editorial',
        sepia: 'Sepia Notebook'
      },
      mdSample: [
        "# 产品周报 / Product Weekly Update",
        "",
        "> 本示例用于验证 Markdown 实时渲染、主题切换，以及导出 PDF 后的文本复制与分页效果。",
        "",
        "## 本周结论",
        "",
        "- 新版本注册转化率提升 **12.6%**",
        "- 客服首响时间从 `7m 24s` 降到 `4m 10s`",
        "- 文档站迁移已完成，剩余导出链路压测",
        "",
        "## 关键事项",
        "",
        "1. 完成富文本转 Markdown 的字段映射。",
        "2. 把 PDF 页眉页脚统一成可配置模板。",
        "3. 校验中文字体在深色主题下的导出表现。",
        "",
        "## 任务列表",
        "",
        "- [x] 接入实时预览",
        "- [x] 支持多主题样式切换",
        "- [ ] 增加更多业务模板",
        "",
        "## 代码片段",
        "",
        "```ts",
        "const blob = await window.dompdf(previewRoot, {",
        "  format: 'a4',",
        "  pagination: true,",
        "  useCORS: true",
        "});",
        "```",
        "",
        "## 对比表",
        "",
        "| 指标 | 当前值 | 环比 |",
        "| --- | ---: | ---: |",
        "| WAU | 124,500 | +8.4% |",
        "| 续费率 | 71.2% | +2.1% |",
        "| 平均导出耗时 | 428ms | -16.0% |",
        "",
        "## 备注",
        "",
        "当 Markdown 被渲染成 HTML 后，右侧预览区就是最终导出的 DOM 来源。"
      ].join("\n"),
      runtime: {
        processing: '正在处理中...',
        parsingPage: '正在解析页面...',
        countingPages: function (totalPages) {
          return totalPages ? ('正在计算总页数... 共 ' + totalPages + ' 页') : '正在计算总页数...';
        },
        renderingPdf: function (currentPage, totalPages) {
          if (currentPage && totalPages) return '正在生成 PDF... 第 ' + currentPage + ' / ' + totalPages + ' 页';
          if (totalPages) return '正在生成 PDF... 共 ' + totalPages + ' 页';
          return '正在生成 PDF...';
        },
        benchmarkCompressOn: '开启',
        benchmarkCompressOff: '关闭',
        benchmarkMeta: function (mode, compressEnabled, building) {
          var suffix = compressEnabled ? ' · 压缩开启' : ' · 压缩关闭';
          if (mode === 'light') return '当前模式：轻量基准 ·1 组短文本' + suffix;
          if (mode === 'extreme') return (building
            ? '当前模式：10000页测试 · 正在生成 8940 组超长文本'
            : '当前模式：10000页测试 · 8940 组超长文本') + suffix;
          return '当前模式：重压测 · 440 组超长文本' + suffix;
        },
        fontNotReady: '中文字体尚未加载完成，请稍后重试',
        markdownLoading: 'Markdown 编辑器资源尚未加载完成，请稍候…',
        buildExtreme: '正在生成 10000 页测试样本...',
        rebuildBenchmark: '正在重建基准样本...',
        extremeReady: '10000 页测试样本已显示',
        benchmarkReady: '基准样本已更新',
        toolbarDisabledTitle: '中文字体加载中，请稍候…',
        dompdfRunning: '运行 dompdf.js...',
        html2pdfRunning: '运行 html2pdf.js...',
        compareDompdf: '正在对比 dompdf.js...',
        compareHtml2pdf: '正在对比 html2pdf.js...',
        dompdfDone: function (duration, size) {
          return 'dompdf.js 导出完成 · ' + duration + ' · ' + size;
        },
        html2pdfDone: function (duration, size, blankPdfSuspected) {
          return 'html2pdf.js 导出完成 · ' + duration + ' · ' + size + (blankPdfSuspected ? ' · 疑似空白PDF' : '');
        },
        compareDone: '对比完成',
        compareDoneBlank: '对比完成 · html2pdf.js 疑似空白PDF',
        blankPdfNote: '（疑似空白PDF）',
        speedFaster: function (ratio) { return '⚡ dompdf.js 快了 ' + ratio.toFixed(1) + ' 倍'; },
        speedSlower: function (ratio) { return 'html2pdf 快了 ' + ratio.toFixed(1) + ' 倍'; },
        sizeReduced: function (pct) { return '📉 dompdf.js 体积缩减 ' + pct.toFixed(1) + '%'; },
        sizeIncreased: function (pct) { return '📈 dompdf.js 体积增加 ' + pct.toFixed(1) + '%'; },
        approxDocPages: function (pages) { return '总计约 ' + pages + ' 页'; },
        markdownDepsFailed: 'Markdown 依赖加载失败',
        markdownPlaceholder: '在此开始输入 Markdown 内容...',
        markdownChars: function (count) { return count + ' 字符'; },
        markdownWords: function (count) { return count + ' 词'; },
        markdownLines: function (count) { return count + ' 行'; },
        markdownPages: function (count) { return '约 ' + count + ' 页'; },
        missingBuild: 'dist/dompdf.js 未找到，请先执行 npm run build。',
        loadingResources: '正在加载字体与编辑器资源...',
        ready: '就绪',
        readyWithSymbol: '就绪（符号字体已加载）',
        fontWarning: function (message) { return '字体加载警告: ' + message; },
        exportHeader: 'dompdf.js Studio Demo',
        exportFooter: '第 ${currentPage} 页 / 共 ${totalPages} 页',
        chartTitle: '小位图保留样本',
        chartSubtitle: '用于验证图片嵌入与压缩链路。',
      },
      tableGroups: [
        {
          group: '北区 / 城市更新',
          statusText: '超预期',
          statusClass: 'is-good',
          rows: [
            ['$12.4M', '36.2%', '$14.8M', '38.0%'],
            ['$8.2M', '28.5%', '$9.5M', '30.2%']
          ]
        },
        {
          group: '亚太 / 采购',
          statusText: '达标',
          statusClass: 'is-stable',
          rows: [
            ['$14.1M', '32.8%', '$16.5M', '34.5%'],
            ['$5.6M', '14.3%', '$6.2M', '15.1%']
          ]
        },
        {
          group: '欧洲 / 合规档案',
          statusText: '关注',
          statusClass: 'is-watch',
          rows: [
            ['$9.7M', '24.8%', '$10.9M', '26.1%'],
            ['$4.4M', '11.6%', '$4.9M', '12.2%']
          ]
        },
        {
          group: '公共部门 / 交付运营',
          statusText: '超预期',
          statusClass: 'is-good',
          rows: [
            ['$11.3M', '34.7%', '$13.2M', '35.8%'],
            ['$6.8M', '19.4%', '$7.6M', '20.6%']
          ]
        }
      ],
      longList: {
        light: '这个轻量基准会把附录控制得较短，方便你把注意力集中在原始分页吞吐上，而不会过度放大文本塑形、换行和压缩成本。',
        heavy: ('这段附录会故意使用单段超长正文，持续向 PDF 管线施加文本流压力：它包含重复从句、密集标点和业务化措辞，用来观察分页、换行、字形映射、文本提取顺序、复制检索行为以及最终文件体积差异；目标不是装饰性的内容，而是一堵足够接近真实采购文档、合规报告、技术规格、审计备注、迁移指南、实施总结、交付约束和附录说明的文字墙，让排版引擎持续面对语义阅读顺序、稳定换行、可预测页边界和紧凑矢量输出等问题，而不是退化为更容易随着文档长度暴涨的整页位图捕获。 ').repeat(5).trim()
      }
    }
  };
  var themeLabels = I18N[currentLocale].themeLabels;
  var mdSamples = { default: I18N[currentLocale].mdSample };
  var STATIC_TRANSLATIONS = [
    { key: 'title', type: 'title', en: 'dompdf.js Studio - Pure JavaScript DOM-to-PDF Engine | Live Demo' },
    { key: 'meta-description', selector: 'meta[name="description"]', type: 'attr', attr: 'content', en: 'dompdf.js is a pure JavaScript DOM-to-PDF renderer with no backend required. This live demo supports HTML and Markdown editing, real-time PDF preview, and high-fidelity multilingual export.' },
    { key: 'meta-keywords', selector: 'meta[name="keywords"]', type: 'attr', attr: 'content', en: 'dompdf.js, DOM to PDF, JavaScript PDF, frontend PDF generation, HTML to PDF, live PDF editor' },
    { key: 'og-title', selector: 'meta[property="og:title"]', type: 'attr', attr: 'content', en: 'dompdf.js Studio - Pure JavaScript DOM-to-PDF Engine' },
    { key: 'og-description', selector: 'meta[property="og:description"]', type: 'attr', attr: 'content', en: 'A browser-side DOM-to-PDF rendering engine with HTML and Markdown editing plus real-time PDF preview.' },
    { key: 'twitter-title', selector: 'meta[name="twitter:title"]', type: 'attr', attr: 'content', en: 'dompdf.js Studio - Pure JavaScript DOM-to-PDF Engine' },
    { key: 'twitter-description', selector: 'meta[name="twitter:description"]', type: 'attr', attr: 'content', en: 'A browser-side DOM-to-PDF rendering engine with HTML and Markdown editing plus real-time PDF preview.' },
    { key: 'schema', selector: 'script[type="application/ld+json"]', type: 'text', en: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'dompdf.js',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      description: 'Pure JavaScript DOM-to-PDF rendering engine',
      url: 'https://dompdfjs.lisky.com.cn/'
    }, null, 2) },
    { key: 'github-aria', selector: '.sidebar-github-link', type: 'attr', attr: 'aria-label', en: 'View the dompdf.js GitHub repository' },
    { key: 'export-dompdf', selector: '#btn-export-dompdf .btn-label', type: 'text', en: 'Export dompdf.js' },
    { key: 'export-html2pdf', selector: '#btn-export-html2pdf .btn-label', type: 'text', en: 'Export html2pdf.js' },
    { key: 'compare-btn', selector: '#btn-compare .btn-label', type: 'text', en: 'Run Performance Comparison' },
    { key: 'section-benchmark-title', selector: '#sidebar-benchmark-section .sidebar-section-title', type: 'text', en: 'Page Count' },
    { key: 'compare-result-title', selector: '.sidebar-section:nth-of-type(3) .sidebar-section-title', type: 'text', en: 'Comparison Results' },
    { key: 'benchmark-compress-strong', selector: '.benchmark-toggle-copy strong', type: 'text', en: 'dompdf Compression' },
    { key: 'speed-dompdf-label', selector: '#speed-dompdf', type: 'attr', attr: 'data-placeholder', en: '--' },
    { key: 'metric-time-dompdf', selector: '#label-speed-dompdf', type: 'text', en: 'dompdf.js Time' },
    { key: 'metric-time-html2pdf', selector: '#label-speed-html2pdf', type: 'text', en: 'html2pdf.js Time' },
    { key: 'metric-size-dompdf', selector: '#label-size-dompdf', type: 'text', en: 'dompdf.js Size' },
    { key: 'metric-size-html2pdf', selector: '#label-size-html2pdf', type: 'text', en: 'html2pdf.js Size' },
    { key: 'footer-tab-specs', selector: '#footer-tab-specs', type: 'text', en: 'Engine Specs' },
    { key: 'footer-tab-code', selector: '#footer-tab-code', type: 'text', en: 'Quick Start Code' },
    { key: 'specs-head-1', selector: '.specs-mini-table thead th:nth-child(1)', type: 'text', en: 'Category' },
    { key: 'specs-head-2', selector: '.specs-mini-table thead th:nth-child(2)', type: 'text', en: 'dompdf.js' },
    { key: 'specs-head-3', selector: '.specs-mini-table thead th:nth-child(3)', type: 'text', en: 'html2pdf' },
    { key: 'specs-row-1-1', selector: '.specs-mini-table tbody tr:nth-child(1) td:nth-child(1)', type: 'text', en: 'Engine' },
    { key: 'specs-row-1-2', selector: '.specs-mini-table tbody tr:nth-child(1) td:nth-child(2)', type: 'text', en: 'Rust + WASM' },
    { key: 'specs-row-1-3', selector: '.specs-mini-table tbody tr:nth-child(1) td:nth-child(3)', type: 'text', en: 'html2canvas' },
    { key: 'specs-row-2-1', selector: '.specs-mini-table tbody tr:nth-child(2) td:nth-child(1)', type: 'text', en: 'Output' },
    { key: 'specs-row-2-2', selector: '.specs-mini-table tbody tr:nth-child(2) td:nth-child(2)', type: 'text', en: 'Native vector PDF instructions' },
    { key: 'specs-row-2-3', selector: '.specs-mini-table tbody tr:nth-child(2) td:nth-child(3)', type: 'text', en: 'Embedded bitmap canvases' },
    { key: 'specs-row-3-1', selector: '.specs-mini-table tbody tr:nth-child(3) td:nth-child(1)', type: 'text', en: 'Text Search' },
    { key: 'specs-row-3-2', selector: '.specs-mini-table tbody tr:nth-child(3) td:nth-child(2)', type: 'text', en: 'Selectable, copyable, searchable' },
    { key: 'specs-row-3-3', selector: '.specs-mini-table tbody tr:nth-child(3) td:nth-child(3)', type: 'text', en: 'Not selectable at all' },
    { key: 'specs-row-4-1', selector: '.specs-mini-table tbody tr:nth-child(4) td:nth-child(1)', type: 'text', en: 'Scaling Quality' },
    { key: 'specs-row-4-2', selector: '.specs-mini-table tbody tr:nth-child(4) td:nth-child(2)', type: 'text', en: 'Lossless vector scaling' },
    { key: 'specs-row-4-3', selector: '.specs-mini-table tbody tr:nth-child(4) td:nth-child(3)', type: 'text', en: 'Blurred bitmap stretching' },
    { key: 'specs-row-5-1', selector: '.specs-mini-table tbody tr:nth-child(5) td:nth-child(1)', type: 'text', en: 'Pagination' },
    { key: 'specs-row-5-2', selector: '.specs-mini-table tbody tr:nth-child(5) td:nth-child(2)', type: 'text', en: 'Native pagination (line-height aware)' },
    { key: 'specs-row-5-3', selector: '.specs-mini-table tbody tr:nth-child(5) td:nth-child(3)', type: 'text', en: 'Canvas slicing and stitching' },
    { key: 'specs-row-6-1', selector: '.specs-mini-table tbody tr:nth-child(6) td:nth-child(1)', type: 'text', en: 'First Render Cost' },
    { key: 'specs-row-6-2', selector: '.specs-mini-table tbody tr:nth-child(6) td:nth-child(2)', type: 'text', en: 'Includes WASM startup cost' },
    { key: 'specs-row-6-3', selector: '.specs-mini-table tbody tr:nth-child(6) td:nth-child(3)', type: 'text', en: 'Runs directly on the main thread' },
    { key: 'specs-row-7-1', selector: '.specs-mini-table tbody tr:nth-child(7) td:nth-child(1)', type: 'text', en: 'Performance Bottleneck' },
    { key: 'specs-row-7-2', selector: '.specs-mini-table tbody tr:nth-child(7) td:nth-child(2)', type: 'text', en: 'Bound by WASM compute throughput' },
    { key: 'specs-row-7-3', selector: '.specs-mini-table tbody tr:nth-child(7) td:nth-child(3)', type: 'text', en: 'Large image-heavy DOMs fail easily' },
    { key: 'tab-basic', selector: '#tab-btn-basic', type: 'text', en: 'Capability Report' },
    { key: 'tab-markdown', selector: '#tab-btn-markdown', type: 'text', en: 'Markdown Editor' },
    { key: 'header-a4', selector: '.header-info span:first-child', type: 'text', en: 'A4 Page Simulation (794px × 1123px)' },
    { key: 'header-zoom', selector: '.header-info span:last-child', type: 'text', en: 'Zoom 100%' },
    { key: 'top-loading-aria', selector: '.top-loading-card', type: 'attr', attr: 'aria-label', en: 'Export progress' },
    { key: 'hero-title', selector: '.report-hero-main h1', type: 'text', en: 'Front-End DOM-to-PDF Capability Report' },
    { key: 'hero-lede', selector: '.report-hero-main .lede', type: 'text', en: 'This default sample no longer focuses on a flashy collection of styles. Instead, it behaves more like a real document: one DOM covers mixed CJK and Latin text, long paragraphs, structured tables, inline SVG, code blocks, math, pagination control, and protected cross-page containers. That makes dompdf.js easier to evaluate against html2pdf.js on both layout quality and final PDF size.' },
    { key: 'hero-pill-1', selector: '.report-hero-main .report-pill:nth-child(1)', type: 'text', en: 'Copyable Text' },
    { key: 'hero-pill-2', selector: '.report-hero-main .report-pill:nth-child(2)', type: 'text', en: 'Multi-page Pagination' },
    { key: 'hero-pill-3', selector: '.report-hero-main .report-pill:nth-child(3)', type: 'text', en: 'Inline SVG' },
    { key: 'hero-pill-4', selector: '.report-hero-main .report-pill:nth-child(4)', type: 'text', en: 'CJK + Latin' },
    { key: 'hero-pill-5', selector: '.report-hero-main .report-pill:nth-child(5)', type: 'text', en: 'divisionDisable' },
    { key: 'hero-pill-6', selector: '.report-hero-main .report-pill:nth-child(6)', type: 'text', en: 'Math Symbols' },
    { key: 'hero-meta-eyebrow', selector: '.report-meta-eyebrow', type: 'text', en: 'Demo Goals' },
    { key: 'hero-meta-1', selector: '.report-meta-list li:nth-child(1)', type: 'html', en: '<strong>Main showcase:</strong> text, tables, SVG, pagination, and searchability' },
    { key: 'hero-meta-2', selector: '.report-meta-list li:nth-child(2)', type: 'html', en: '<strong>Secondary showcase:</strong> keep one small raster image to validate image embedding' },
    { key: 'hero-meta-3', selector: '.report-meta-list li:nth-child(3)', type: 'html', en: '<strong>Expected comparison:</strong> dompdf.js stays lighter as page count grows' },
    { key: 'hero-meta-4', selector: '.report-meta-list li:nth-child(4)', type: 'html', en: '<strong>Export target:</strong> the full <code>#document</code> block' },
    { key: 'kpi-1-label', selector: '.report-kpi:nth-child(1) .report-kpi-label', type: 'text', en: 'Document Width' },
    { key: 'kpi-1-desc', selector: '.report-kpi:nth-child(1) span', type: 'text', en: 'Organized around A4 content width to keep the sample representative' },
    { key: 'kpi-2-label', selector: '.report-kpi:nth-child(2) .report-kpi-label', type: 'text', en: 'Content Strategy' },
    { key: 'kpi-2-strong', selector: '.report-kpi:nth-child(2) strong', type: 'text', en: 'Text-heavy / Raster-light' },
    { key: 'kpi-2-desc', selector: '.report-kpi:nth-child(2) span', type: 'text', en: 'Makes the difference between vector text and screenshot PDFs easier to observe' },
    { key: 'kpi-3-label', selector: '.report-kpi:nth-child(3) .report-kpi-label', type: 'text', en: 'Coverage' },
    { key: 'kpi-3-strong', selector: '.report-kpi:nth-child(3) strong', type: 'text', en: 'Mixed content modules' },
    { key: 'kpi-3-desc', selector: '.report-kpi:nth-child(3) span', type: 'text', en: 'Paragraphs, tables, SVG, code, formulas, and pagination control' },
    { key: 'kpi-4-label', selector: '.report-kpi:nth-child(4) .report-kpi-label', type: 'text', en: 'What to Watch' },
    { key: 'kpi-4-strong', selector: '.report-kpi:nth-child(4) strong', type: 'text', en: 'Size / Layout / Copy' },
    { key: 'kpi-4-desc', selector: '.report-kpi:nth-child(4) span', type: 'text', en: 'Look beyond speed and inspect the final PDF quality' },
    { key: 's1-title', selector: '#document > .report-section:nth-of-type(1) h2', type: 'text', en: 'Text, Fonts, and Copyability' },
    { key: 's1-summary', selector: '#document > .report-section:nth-of-type(1) .report-section-summary', type: 'text', en: 'This section highlights one of the most important dompdf.js capabilities: text remains text instead of being flattened into a page-sized bitmap. For real business documents, searchability, copyability, and scaling quality matter more than merely looking similar.' },
    { key: 's1-card1-title', selector: '#document > .report-section:nth-of-type(1) .report-card:first-of-type h3', type: 'text', en: 'Bilingual Business Summary' },
    { key: 's1-card1-p1', selector: '#document > .report-section:nth-of-type(1) .report-card:first-of-type p:nth-of-type(1)', type: 'text', en: 'Urban Renewal Pilot 2026 is now entering the pre-delivery review phase. This revision focuses on validating the stability of multilingual paragraphs across A4 pagination, embedded fonts, glyph width calculation, and table copyability so the exported PDF can satisfy archival, distribution, review, and search workflows.' },
    { key: 's1-card1-note', selector: '#document > .report-section:nth-of-type(1) .report-note', type: 'text', en: 'The sample intentionally includes long, dense body copy so html2pdf.js enlarges page-size bitmap output more aggressively, while dompdf.js can still keep the PDF centered around text and vector objects.' },
    { key: 's1-card2-title', selector: '#document > .report-section:nth-of-type(1) aside h3', type: 'text', en: 'What This Page Verifies' },
    { key: 's1-card2-li1', selector: '#document > .report-section:nth-of-type(1) aside li:nth-child(1)', type: 'text', en: 'Chinese, English, numbers, and punctuation remain continuously copyable' },
    { key: 's1-card2-li2', selector: '#document > .report-section:nth-of-type(1) aside li:nth-child(2)', type: 'text', en: 'Keywords and IDs remain searchable after font embedding' },
    { key: 's1-card2-li3', selector: '#document > .report-section:nth-of-type(1) aside li:nth-child(3)', type: 'text', en: 'Headers, footers, and body content do not overlap in multipage export' },
    { key: 's1-card2-li4', selector: '#document > .report-section:nth-of-type(1) aside li:nth-child(4)', type: 'text', en: 'Structured tables and lists stay sharp under scaling' },
    { key: 's1-card2-li5', selector: '#document > .report-section:nth-of-type(1) aside li:nth-child(5)', type: 'html', en: 'Complex containers can remain intact across pages via <code>divisionDisable</code>' },
    { key: 's2-title', selector: '#document > .report-section:nth-of-type(2) h2', type: 'text', en: 'Modern OKLCH Color Space Support' },
    { key: 's2-summary', selector: '#document > .report-section:nth-of-type(2) .report-section-summary', type: 'html', en: 'This section shows how dompdf.js supports the CSS Color Level 4 <code>oklch()</code> function and reproduces perceptually smoother modern palettes and vivid gradients in PDF output.' },
    { key: 's2-card1-title', selector: '#document > .report-section:nth-of-type(2) .report-card:first-of-type h3', type: 'text', en: 'OKLCH Swatch Panel' },
    { key: 's2-card2-title', selector: '#document > .report-section:nth-of-type(2) .report-card:last-of-type h3', type: 'text', en: 'OKLCH Gradient Card' },
    { key: 's2-gradient-title', selector: '.oklch-gradient-title', type: 'text', en: 'Aurora Color Flow' },
    { key: 's2-note', selector: '#document > .report-section:nth-of-type(2) .report-note', type: 'html', en: '<strong>Lossless color normalization:</strong> instead of hand-writing regex parsing for complex <code>oklch()</code> functions, the engine leverages Canvas 2D to serialize and normalize colors at runtime, which makes advanced CSS color functions work out of the box.' },
    { key: 's3-title', selector: '#document > .report-section:nth-of-type(3) h2', type: 'text', en: 'CSS Pseudo Elements and Vector Rendering' },
    { key: 's3-summary', selector: '#document > .report-section:nth-of-type(3) .report-section-summary', type: 'html', en: 'This section demonstrates text and icons generated by <code>::before</code> and <code>::after</code>. During PDF export, that content remains vector text and can still be selected and searched independently.' },
    { key: 's3-card1-title', selector: '#document > .report-section:nth-of-type(3) .report-card:first-of-type h3', type: 'text', en: 'Decorative Components with Pseudo Elements' },
    { key: 's3-info', selector: '.pseudo-card-info', type: 'html', en: '<code>dompdf.js</code> can descend into pseudo-element nodes during DOM serialization, convert them into virtual nodes, and render their text and shapes as vectors in the Rust + WASM pipeline.' },
    { key: 's3-warn', selector: '.pseudo-card-warn', type: 'html', en: 'Heavy use of <code>::before</code>/<code>::after</code> may slightly reduce DOM walk throughput, but it does not inflate the final PDF size.' },
    { key: 's3-marker-title', selector: '#document > .report-section:nth-of-type(3) h4', type: 'text', en: 'List markers via pseudo elements (::marker)' },
    { key: 's3-ul-label', selector: '#document > .report-section:nth-of-type(3) span[style*=\"无序列表\"]', type: 'text', en: 'Unordered list (ul > li)' },
    { key: 's3-ol-label', selector: '#document > .report-section:nth-of-type(3) span[style*=\"有序列表\"]', type: 'text', en: 'Ordered list (ol > li)' },
    { key: 's3-ul-a', selector: '#document > .report-section:nth-of-type(3) ul li:nth-child(1)', type: 'text', en: 'Unordered item A' },
    { key: 's3-ul-b', selector: '#document > .report-section:nth-of-type(3) ul li:nth-child(2)', type: 'text', en: 'Unordered item B' },
    { key: 's3-ol-a', selector: '#document > .report-section:nth-of-type(3) ol li:nth-child(1)', type: 'text', en: 'Ordered item 1' },
    { key: 's3-ol-b', selector: '#document > .report-section:nth-of-type(3) ol li:nth-child(2)', type: 'text', en: 'Ordered item 2' },
    { key: 's3-card2-title', selector: '#document > .report-section:nth-of-type(3) .report-card:last-of-type h3', type: 'text', en: 'Inline Pseudo Text and Links' },
    { key: 's3-card2-p1', selector: '#document > .report-section:nth-of-type(3) .report-card:last-of-type p:nth-of-type(1)', type: 'html', en: 'In long-form layouts, pseudo elements are often used to generate opening quotation punctuation: <span class="pseudo-inline-quote">This quote is rendered by the <code>::before</code> and <code>::after</code> content properties.</span>' },
    { key: 's3-card2-p2', selector: '#document > .report-section:nth-of-type(3) .report-card:last-of-type p:nth-of-type(2)', type: 'html', en: 'Or to add a directional hint after a link: learn more about the technical implementation details in the <a class="fancy-link" href="https://github.com/lmn1919/dompdf.js" target="_blank" rel="noreferrer">dompdf.js GitHub repository</a>.' },
    { key: 's3-card2-note', selector: '#document > .report-section:nth-of-type(3) .report-card:last-of-type .report-note', type: 'html', en: '<strong>Vector advantage:</strong> screenshot-based engines such as html2pdf rasterize pseudo elements together with the page, while dompdf.js can convert those letters into native PDF text operators, so you can still <strong>search for “TECHNICAL NOTE”</strong> inside the exported PDF.' },
    { key: 's4-title', selector: '#document > .report-section:nth-of-type(4) h2', type: 'text', en: 'Vector Graphics and Raster Samples' },
    { key: 's4-summary', selector: '#document > .report-section:nth-of-type(4) .report-section-summary', type: 'text', en: 'The default sample keeps one small bitmap only to validate image compression and embedding. The real focus shifts to inline SVG charts and process diagrams, which align much better with dompdf.js strengths.' },
    { key: 's4-card1-title', selector: '#document > .report-section:nth-of-type(4) .report-card:first-of-type h3', type: 'text', en: 'Inline SVG Metrics Chart' },
    { key: 's4-chart-aria', selector: '#document > .report-section:nth-of-type(4) .report-svg-figure', type: 'attr', attr: 'aria-label', en: 'Benchmark chart' },
    { key: 's4-caption', selector: '.report-figure-caption', type: 'text', en: 'Inline vector charts stay crisp and scalable in dompdf.js, while html2pdf.js tends to convert the full page into a screenshot.' },
    { key: 's4-card2-title', selector: '.report-raster-copy h3', type: 'text', en: 'Retained Raster Sample' },
    { key: 's4-card2-p', selector: '.report-raster-copy p', type: 'text', en: 'This page still keeps one Canvas-generated JPEG to validate image compression, sizing, and embedding stability, but it no longer dominates the whole demo.' },
    { key: 's4-note', selector: '.report-raster-card .report-note', type: 'text', en: 'The default sample now avoids image-heavy full-page layouts. That better matches technical document workflows and makes dompdf.js advantages in text-centric PDFs easier to see.' },
    { key: 's5-title', selector: '#document > .report-section:nth-of-type(5) h2', type: 'text', en: 'Layout, Clipping, Opacity, and Flow Diagrams' },
    { key: 's5-summary', selector: '#document > .report-section:nth-of-type(5) .report-section-summary', type: 'text', en: 'This section focuses on whether complex box models remain stable in PDF output, including translucent overlays, clipped regions, rounded corners, inline code, and vector flow diagrams.' },
    { key: 's5-card1-title', selector: '#document > .report-section:nth-of-type(5) .report-card:first-of-type h3', type: 'text', en: 'Rendering Pipeline Diagram' },
    { key: 's5-mini1-title', selector: '#document > .report-section:nth-of-type(5) .report-mini-card:nth-child(1) h4', type: 'text', en: 'Clipping Sample' },
    { key: 's5-mini1-p', selector: '.clip-box p', type: 'html', en: 'This container uses <code>overflow: hidden</code>.' },
    { key: 's5-mini2-title', selector: '#document > .report-section:nth-of-type(5) .report-mini-card:nth-child(2) h4', type: 'text', en: 'Opacity Sample' },
    { key: 's5-card2-title', selector: '#document > .report-section:nth-of-type(5) aside h3', type: 'text', en: 'Implementation Focus' },
    { key: 's5-card2-li1', selector: '#document > .report-section:nth-of-type(5) aside li:nth-child(1)', type: 'text', en: 'Use pure SVG for the flow diagram instead of a pre-baked PNG' },
    { key: 's5-card2-li2', selector: '#document > .report-section:nth-of-type(5) aside li:nth-child(2)', type: 'text', en: 'Rounded clipped containers must not leak child nodes after export' },
    { key: 's5-card2-li3', selector: '#document > .report-section:nth-of-type(5) aside li:nth-child(3)', type: 'text', en: 'Translucent stacking order should match the browser view' },
    { key: 's5-card2-li4', selector: '#document > .report-section:nth-of-type(5) aside li:nth-child(4)', type: 'html', en: 'Keep hierarchy intact for <code>code</code>, bold text, and inline labels' },
    { key: 's5-note', selector: '#document > .report-section:nth-of-type(5) aside .report-note', type: 'text', en: 'For real documents, layout reliability usually matters more than a single visual effect. This sample intentionally ranks stable typesetting above visual showpieces.' },
    { key: 's6-title', selector: '#document > .report-section:nth-of-type(6) h2', type: 'text', en: 'Structured Tables and Text Search' },
    { key: 's6-summary', selector: '#document > .report-section:nth-of-type(6) .report-section-summary', type: 'text', en: 'The detail table below generates many rows to validate column widths, wrapping, font embedding, copy order, and multipage stability at the same time. This kind of content is closer to real reports, lists, and audit documents, and it plays to dompdf.js strengths.' },
    { key: 's6-card-title', selector: '#document > .report-section:nth-of-type(6) .report-table-head h3', type: 'text', en: 'Capability Validation Matrix' },
    { key: 's6-card-subtle', selector: '.report-table-subtle', type: 'text', en: 'Covers paragraphs, identifiers, dates, amounts, status chips, and mixed CJK/Latin fields.' },
    { key: 's6-status-chip', selector: '.report-status-chip', type: 'text', en: 'Live generated' },
    { key: 's6-th-1', selector: '.report-table thead tr:first-child th:nth-child(1)', type: 'text', en: 'Region / Division' },
    { key: 's6-th-2', selector: '.report-table thead tr:first-child th:nth-child(2)', type: 'text', en: 'H1 Performance' },
    { key: 's6-th-3', selector: '.report-table thead tr:first-child th:nth-child(3)', type: 'text', en: 'H2 Forecast' },
    { key: 's6-th-4', selector: '.report-table thead tr:first-child th:nth-child(4)', type: 'text', en: 'SLA Status' },
    { key: 's6-th-5', selector: '.report-table thead tr:nth-child(2) th:nth-child(1)', type: 'text', en: 'Revenue' },
    { key: 's6-th-6', selector: '.report-table thead tr:nth-child(2) th:nth-child(2)', type: 'text', en: 'Margin' },
    { key: 's6-th-7', selector: '.report-table thead tr:nth-child(2) th:nth-child(3)', type: 'text', en: 'Revenue' },
    { key: 's6-th-8', selector: '.report-table thead tr:nth-child(2) th:nth-child(4)', type: 'text', en: 'Margin' },
    { key: 's6-callout', selector: '#document > .report-section:nth-of-type(6) blockquote', type: 'text', en: 'If this whole page can still be selected, copied, and searched in normal reading order after export, then the text objects, glyph mapping, and table structure are already in a usable state.' },
    { key: 's7-title', selector: '#document > .report-section:nth-of-type(7) h2', type: 'text', en: 'Definition Lists, Code Blocks, and Math Symbols' },
    { key: 's7-summary', selector: '#document > .report-section:nth-of-type(7) .report-section-summary', type: 'text', en: 'This section focuses on preformatted text, symbol fonts, and formula layout. The styling stays restrained so visual noise does not interfere with reading or comparison.' },
    { key: 's7-math-title', selector: '.math-block h3', type: 'text', en: 'Math and Symbol Samples' },
    { key: 's7-math-p1', selector: '.math-block p:nth-of-type(1)', type: 'text', en: 'Euler identity:' },
    { key: 's7-math-p2', selector: '.math-block p:nth-of-type(3)', type: 'text', en: 'Gaussian integral:' },
    { key: 's7-math-p3', selector: '.math-block p:nth-of-type(5)', type: 'text', en: 'Bayes theorem:' },
    { key: 's7-math-p4', selector: '.math-block p:nth-of-type(7)', type: 'text', en: 'Piecewise function:' },
    { key: 's8-title', selector: '#document > .report-section:nth-of-type(8) h2', type: 'text', en: 'Pagination Stress Test and Appendix' },
    { key: 's8-summary', selector: '#document > .report-section:nth-of-type(8) .report-section-summary', type: 'text', en: 'This section deliberately stacks long body copy and repeated records so the output naturally spans multiple pages. For html2pdf.js, each page behaves more like a large screenshot; for dompdf.js, increasing text density does not inflate the output in the same way.' },
    { key: 's8-appendix-note', selector: '.report-appendix-note', type: 'text', en: 'The items below use repeated but non-identical business text to verify list pagination, continuous copy behavior, and paragraph splitting near page boundaries.' },
    { key: 's8-timeline-title', selector: '.timeline-card-doc h3', type: 'text', en: 'Forced Page Break Sample' },
    { key: 's8-timeline-phase1', selector: '.timeline-item:nth-child(1) strong', type: 'text', en: 'Phase 1 · Snapshot Contract' },
    { key: 's8-timeline-phase1-p', selector: '.timeline-item:nth-child(1) p', type: 'text', en: 'Freeze the DOM snapshot schema so text, images, layout, and pagination control signals all enter the worker in a stable format.' },
    { key: 's8-timeline-phase2', selector: '.timeline-item:nth-child(2) strong', type: 'text', en: 'Phase 2 · Typography Validation' },
    { key: 's8-timeline-phase2-p', selector: '.timeline-item:nth-child(2) p', type: 'text', en: 'Run targeted regression checks for Chinese fonts, numbers, English words, code fragments, math symbols, and copy order.' },
    { key: 's8-timeline-phase3', selector: '.timeline-item:nth-child(3) strong', type: 'text', en: 'Phase 3 · Document Scale' },
    { key: 's8-timeline-phase3-p', selector: '.timeline-item:nth-child(3) p', type: 'text', en: 'Use realistically long content to widen the final PDF size gap and verify that pagination breakpoints stay stable.' },
    { key: 's8-division-title', selector: '.division-box h3', type: 'text', en: 'divisionDisable Sample' },
    { key: 's8-division-p1', selector: '.division-box p:nth-of-type(1)', type: 'html', en: 'This module carries the <code>divisionDisable</code> attribute. When a page break occurs, it should move to the next page as one intact block instead of being cut through the middle. In real documents, signature panels, quote summaries, approval notes, and cover sheets often need this protection.' },
    { key: 's8-division-p2', selector: '.division-box p:nth-of-type(2)', type: 'text', en: 'If this card is split at the page boundary, the pagination merge and block relocation strategy for complex containers still needs more work.' },
    { key: 'form-kicker', selector: '#form-controls-kicker', type: 'text', en: 'Forms' },
    { key: 'form-title', selector: '#form-controls-title', type: 'text', en: 'Form Controls and Interactive Field Export' },
    { key: 'form-summary', selector: '#form-controls-summary', type: 'text', en: 'This section validates the form export pipeline: static mode preserves the current visual appearance, while interactive mode emits editable PDF fields for text boxes, selects, checkboxes, and radios. Date, range, color, file, and progress-like controls stay as accurate static output.' },
    { key: 'form-card-text-title', selector: '#form-card-text-title', type: 'text', en: 'Text and Choice Controls' },
    { key: 'form-label-project', selector: '#form-label-project', type: 'text', en: 'Project Name' },
    { key: 'form-label-owner', selector: '#form-label-owner', type: 'text', en: 'Owner' },
    { key: 'form-label-email', selector: '#form-label-email', type: 'text', en: 'Notification Email' },
    { key: 'form-label-password', selector: '#form-label-password', type: 'text', en: 'Approval Passcode' },
    { key: 'form-label-stage', selector: '#form-label-stage', type: 'text', en: 'Delivery Stage' },
    { key: 'form-stage-option-1', selector: '#form-stage-option-1', type: 'text', en: 'Solution Review' },
    { key: 'form-stage-option-2', selector: '#form-stage-option-2', type: 'text', en: 'Pre-delivery Validation' },
    { key: 'form-stage-option-3', selector: '#form-stage-option-3', type: 'text', en: 'Batch Release' },
    { key: 'form-label-tags', selector: '#form-label-tags', type: 'text', en: 'Review Tags' },
    { key: 'form-tag-option-1', selector: '#form-tag-option-1', type: 'text', en: 'Stable Pagination' },
    { key: 'form-tag-option-2', selector: '#form-tag-option-2', type: 'text', en: 'Correct Text Layer' },
    { key: 'form-tag-option-3', selector: '#form-tag-option-3', type: 'text', en: 'Performance Regression' },
    { key: 'form-tag-option-4', selector: '#form-tag-option-4', type: 'text', en: 'Interactive Fields' },
    { key: 'form-label-notes', selector: '#form-label-notes', type: 'text', en: 'Export Notes' },
    { key: 'form-label-readonly', selector: '#form-label-readonly', type: 'text', en: 'Readonly ID' },
    { key: 'form-label-disabled', selector: '#form-label-disabled', type: 'text', en: 'Disabled Sample' },
    { key: 'form-note-text', selector: '#form-note-text', type: 'html', en: 'This card carries <code>divisionDisable</code> so we can verify the whole group stays intact near page boundaries. In interactive mode, text-like fields should remain editable; in static mode, the current value and placeholder appearance should be preserved.' },
    { key: 'form-card-state-title', selector: '#form-card-state-title', type: 'text', en: 'Stateful and Static-only Controls' },
    { key: 'form-row-checks', selector: '#form-row-checks', type: 'text', en: 'Checks' },
    { key: 'form-checkbox-1', selector: '#form-checkbox-1', type: 'text', en: 'Regression complete' },
    { key: 'form-checkbox-2', selector: '#form-checkbox-2', type: 'text', en: 'Needs manual review' },
    { key: 'form-row-radio', selector: '#form-row-radio', type: 'text', en: 'Release Track' },
    { key: 'form-radio-1', selector: '#form-radio-1', type: 'text', en: 'Canary' },
    { key: 'form-radio-2', selector: '#form-radio-2', type: 'text', en: 'Stable' },
    { key: 'form-label-date', selector: '#form-label-date', type: 'text', en: 'Review Date' },
    { key: 'form-label-time', selector: '#form-label-time', type: 'text', en: 'Review Time' },
    { key: 'form-label-month', selector: '#form-label-month', type: 'text', en: 'Archive Month' },
    { key: 'form-label-week', selector: '#form-label-week', type: 'text', en: 'Schedule Week' },
    { key: 'form-label-datetime', selector: '#form-label-datetime', type: 'text', en: 'Freeze Time' },
    { key: 'form-label-range', selector: '#form-label-range', type: 'text', en: 'Risk Threshold' },
    { key: 'form-label-color', selector: '#form-label-color', type: 'text', en: 'Theme Color' },
    { key: 'form-label-file', selector: '#form-label-file', type: 'text', en: 'Attachments' },
    { key: 'form-label-progress', selector: '#form-label-progress', type: 'text', en: 'Export Progress' },
    { key: 'form-label-meter', selector: '#form-label-meter', type: 'text', en: 'Quality Score' },
    { key: 'form-note-state', selector: '#form-note-state', type: 'text', en: 'Range, color, file, progress, and meter controls keep accurate static output but do not emit broken interactive fields. Checkboxes and radios should remain toggleable in an interactive PDF.' },
    { key: 'md-input-title', selector: '#panel-markdown .md-editor-panel .md-panel-title span', type: 'text', en: 'Markdown Input' },
    { key: 'md-preview-title', selector: '#panel-markdown .md-preview-panel .md-panel-title span', type: 'text', en: 'Typeset Preview (A4)' },
    { key: 'md-empty-state', selector: '.md-empty-state p', type: 'text', en: 'Type Markdown on the left and it will automatically render into an A4 layout on the right' }
  ];

  function getSavedLocale() {
    try {
      return window.localStorage.getItem(LOCALE_STORAGE_KEY) === 'zh' ? 'zh' : 'en';
    } catch (err) {
      return 'en';
    }
  }

  function getLocalePack() {
    return I18N[currentLocale];
  }

  function getRuntimeStrings() {
    return getLocalePack().runtime;
  }

  function captureStaticContent() {
    if (staticContentCaptured) return;
    for (var i = 0; i < STATIC_TRANSLATIONS.length; i++) {
      var entry = STATIC_TRANSLATIONS[i];
      if (entry.type === 'title') {
        originalStaticContent[entry.key] = document.title;
        continue;
      }
      var el = document.querySelector(entry.selector);
      if (!el) continue;
      if (entry.type === 'attr') {
        originalStaticContent[entry.key] = el.getAttribute(entry.attr);
      } else if (entry.type === 'html') {
        originalStaticContent[entry.key] = el.innerHTML;
      } else {
        originalStaticContent[entry.key] = el.textContent;
      }
    }
    staticContentCaptured = true;
  }

  function applyStaticTranslations(locale) {
    captureStaticContent();
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';

    for (var i = 0; i < STATIC_TRANSLATIONS.length; i++) {
      var entry = STATIC_TRANSLATIONS[i];
      var value = locale === 'en' ? entry.en : originalStaticContent[entry.key];
      if (typeof value === 'undefined') continue;

      if (entry.type === 'title') {
        document.title = value;
        continue;
      }

      var el = document.querySelector(entry.selector);
      if (!el) continue;

      if (entry.type === 'attr') {
        if (value === null) el.removeAttribute(entry.attr);
        else el.setAttribute(entry.attr, value);
      } else if (entry.type === 'html') {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    }
  }

  function renderLanguageSwitch() {
    var enBtn = document.getElementById('lang-btn-en');
    var zhBtn = document.getElementById('lang-btn-zh');
    if (enBtn) enBtn.classList.toggle('active', currentLocale === 'en');
    if (zhBtn) zhBtn.classList.toggle('active', currentLocale === 'zh');
  }

  function syncStatusTextForLocale() {
    var runtime = getRuntimeStrings();
    if (!statusTextEl || !statusDotEl) return;
    if (statusDotEl.className.indexOf('error') !== -1) return;

    if (statusDotEl.className.indexOf('loading') !== -1) {
      statusTextEl.textContent = runtime.processing;
      if (topLoadingOverlayEl && !topLoadingOverlayEl.hidden && topLoadingTextEl) {
        topLoadingTextEl.textContent = runtime.processing;
      }
      return;
    }

    statusTextEl.textContent = symbolFontConfig ? runtime.readyWithSymbol : runtime.ready;
  }

  function syncMarkdownForLocale(previousLocale) {
    if (!vditor) return;
    var currentValue = vditor.getValue();
    if (previousLocale && currentValue === I18N[previousLocale].mdSample) {
      vditor.setValue(I18N[currentLocale].mdSample);
      return;
    }
    updateMdStats(currentValue);
  }

  function applyLocale(previousLocale) {
    themeLabels = I18N[currentLocale].themeLabels;
    mdSamples.default = I18N[currentLocale].mdSample;
    applyStaticTranslations(currentLocale);
    renderLanguageSwitch();
    syncStatusTextForLocale();
    updateBenchmarkUi();
    buildRecordsTable();
    buildLongList(benchmarkBuildVersion);
    updateDocPageInfo();
    var sampleImg = document.getElementById('sample-img');
    if (sampleImg) sampleImg.src = createChartDataUrl();
    syncMarkdownForLocale(previousLocale);
  }

  window.setLanguage = function (locale) {
    var nextLocale = locale === 'zh' ? 'zh' : 'en';
    if (nextLocale === currentLocale) return;
    var previousLocale = currentLocale;
    currentLocale = nextLocale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, currentLocale);
    } catch (err) { /* ignore */ }
    applyLocale(previousLocale);
  };

  /* ========================= Status ========================= */
  function showTopLoading(text) {
    if (!topLoadingOverlayEl || !topLoadingTextEl) return;
    topLoadingTextEl.textContent = text || getRuntimeStrings().processing;
    topLoadingOverlayEl.hidden = false;
  }

  function hideTopLoading() {
    if (!topLoadingOverlayEl) return;
    topLoadingOverlayEl.hidden = true;
  }

  function setStatus(text, isError) {
    statusTextEl.textContent = text;
    statusDotEl.className = isError ? 'status-dot error' : 'status-dot success';
    hideTopLoading();
  }

  function setStatusLoading(text) {
    statusTextEl.textContent = text;
    statusDotEl.className = 'status-dot loading';
    showTopLoading(text);
  }

  function updateDompdfProgressStatus(progress) {
    var runtime = getRuntimeStrings();
    if (!progress || !progress.stage) return;
    if (progress.stage === 'collecting') {
      console.info('[dompdf] collecting document');
      setStatusLoading(runtime.parsingPage);
      return;
    }
    if (progress.stage === 'countingPages') {
      console.info(progress.totalPages
        ? ('[dompdf] counting pages: ' + progress.totalPages)
        : '[dompdf] counting pages');
      setStatusLoading(runtime.countingPages(progress.totalPages));
      return;
    }
    if (progress.stage === 'rendering') {
      if (progress.currentPage && progress.totalPages) {
        console.info('[dompdf] rendering page ' + progress.currentPage + ' / ' + progress.totalPages);
        setStatusLoading(runtime.renderingPdf(progress.currentPage, progress.totalPages));
        return;
      }
      if (progress.totalPages) {
        console.info('[dompdf] rendering started, total pages: ' + progress.totalPages);
        setStatusLoading(runtime.renderingPdf(null, progress.totalPages));
        return;
      }
      console.info('[dompdf] rendering');
      setStatusLoading(runtime.renderingPdf());
    }
  }

  function updateBenchmarkUi() {
    document.getElementById('benchmark-mode-light').classList.toggle('active', benchmarkMode === 'light');
    document.getElementById('benchmark-mode-heavy').classList.toggle('active', benchmarkMode === 'heavy');
    document.getElementById('benchmark-mode-extreme').classList.toggle('active', benchmarkMode === 'extreme');
    document.getElementById('benchmark-mode-light').textContent = currentLocale === 'zh' ? '7页' : '7 Pages';
    document.getElementById('benchmark-mode-heavy').textContent = currentLocale === 'zh' ? '500页' : '500 Pages';
    document.getElementById('benchmark-mode-extreme').textContent = currentLocale === 'zh' ? '10000页' : '10k Pages';
    document.querySelector('.benchmark-mode-switch').setAttribute('aria-label', currentLocale === 'zh' ? '生成页数' : 'Generated pages');
    if (benchmarkCompressToggleEl) benchmarkCompressToggleEl.checked = benchmarkCompressEnabled;
    if (benchmarkCompressLabelEl) {
      benchmarkCompressLabelEl.textContent = benchmarkCompressEnabled
        ? getRuntimeStrings().benchmarkCompressOn
        : getRuntimeStrings().benchmarkCompressOff;
    }
    if (benchmarkMetaEl) {
      benchmarkMetaEl.textContent = getRuntimeStrings().benchmarkMeta(
        benchmarkMode,
        benchmarkCompressEnabled,
        benchmarkBuildInProgress
      );
    }
  }

  function rebuildBenchmarkSample() {
    buildRecordsTable();
    benchmarkBuildVersion += 1;
    benchmarkBuildInProgress = true;
    updateBenchmarkUi();

    var buildVersion = benchmarkBuildVersion;
    benchmarkBuildPromise = buildLongList(buildVersion)
      .then(function () {
        if (buildVersion !== benchmarkBuildVersion) return;
        benchmarkBuildInProgress = false;
        updateDocPageInfo();
        resetMetrics();
        updateBenchmarkUi();
      })
      .catch(function (err) {
        if (buildVersion !== benchmarkBuildVersion) return;
        benchmarkBuildInProgress = false;
        updateBenchmarkUi();
        throw err;
      });

    return benchmarkBuildPromise;
  }

  function ensureBenchmarkSampleReady() {
    if (activeTab !== 'basic' || !benchmarkBuildInProgress) {
      return Promise.resolve();
    }
    return benchmarkBuildPromise;
  }

  function ensureDemoReady() {
    return readyPromise.then(function () {
      if (!sharedFontConfig.fontBytes) {
        throw new Error(getRuntimeStrings().fontNotReady);
      }
    });
  }

  /* ========================= Tab Switching ========================= */
  // Markdown 编辑器依赖 CDN 资源(Vditor / marked / DOMPurify)，判断是否都已就绪
  function markdownDepsReady() {
    return !!(window.Vditor && window.marked && window.DOMPurify);
  }

  // 轻量提示条(侧栏状态条被隐藏，改用居中 toast 反馈)
  var miniToastTimer = null;
  function showMiniToast(text) {
    var el = document.getElementById('mini-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mini-toast';
      el.className = 'mini-toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    // 强制回流后再加类，保证过渡动画生效
    void el.offsetWidth;
    el.classList.add('is-visible');
    if (miniToastTimer) clearTimeout(miniToastTimer);
    miniToastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 2600);
  }

  window.switchTab = function (tab) {
    // Markdown 资源未加载完成时不跳转，给出提示
    if (tab === 'markdown' && !markdownDepsReady()) {
      showMiniToast(getRuntimeStrings().markdownLoading);
      return;
    }

    activeTab = tab;
    document.getElementById('tab-btn-basic').classList.toggle('active', tab === 'basic');
    document.getElementById('tab-btn-markdown').classList.toggle('active', tab === 'markdown');
    document.getElementById('panel-basic').classList.toggle('active', tab === 'basic');
    document.getElementById('panel-markdown').classList.toggle('active', tab === 'markdown');

    // "生成页数" 基准控制仅对综合测试页有意义，Markdown 编辑器下隐藏
    var benchSection = document.getElementById('sidebar-benchmark-section');
    if (benchSection) {
      benchSection.style.display = tab === 'basic' ? '' : 'none';
    }

    if (tab === 'markdown' && !vditor) {
      initMarkdownEditor();
    }

    if (tab === 'basic') {
      updateDocPageInfo();
    }
  };

  /* ========================= Sidebar Footer Tabs ========================= */
  window.switchFooterTab = function (tab) {
    document.getElementById('footer-tab-specs').classList.toggle('active', tab === 'specs');
    document.getElementById('footer-tab-code').classList.toggle('active', tab === 'code');
    document.getElementById('footer-panel-specs').classList.toggle('active', tab === 'specs');
    document.getElementById('footer-panel-code').classList.toggle('active', tab === 'code');
  };

  window.setBenchmarkMode = function (mode) {
    benchmarkMode = mode === 'light' || mode === 'extreme' ? mode : 'heavy';
    updateBenchmarkUi();
    setStatusLoading(benchmarkMode === 'extreme'
      ? getRuntimeStrings().buildExtreme
      : getRuntimeStrings().rebuildBenchmark);
    rebuildBenchmarkSample()
      .then(function () {
        setStatus(benchmarkMode === 'extreme'
          ? getRuntimeStrings().extremeReady
          : getRuntimeStrings().benchmarkReady);
      })
      .catch(function (err) {
        setStatus('error: ' + err.message, true);
        console.error(err);
      });
  };

  window.toggleBenchmarkCompress = function (checked) {
    benchmarkCompressEnabled = !!checked;
    updateBenchmarkUi();
    resetMetrics();
  };

  /* ========================= Formatters ========================= */
  function formatDuration(ms) {
    if (ms < 1000) return ms.toFixed(1) + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /* ========================= Font Loading ========================= */
  function loadFont() {
    return fetch('./SourceHanSansSC-Regular.ttf')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(function (buf) {
        sharedFontConfig.fontBytes = new Uint8Array(buf);
      });
  }

  function loadSymbolFont() {
    return fetch('../assets/symbol-fallback.ttf')
      .then(function (res) {
        if (!res.ok) return null;
        return res.arrayBuffer();
      })
      .then(function (buf) {
        if (!buf) return;
        symbolFontConfig = {
          fontFamily: 'SymbolFallback',
          fontStyle: 'normal',
          fontWeight: 400,
          fontBytes: new Uint8Array(buf)
        };
      })
      .catch(function () { /* optional */ });
  }

  /* ========================= html2pdf lazy load ========================= */
  function ensureHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (html2pdfLoader) return html2pdfLoader;
    html2pdfLoader = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.async = true;
      script.onload = function () {
        if (window.html2pdf) resolve(window.html2pdf);
        else reject(new Error('html2pdf.js loaded but global missing'));
      };
      script.onerror = function () { reject(new Error('failed to load html2pdf.js')); };
      document.head.appendChild(script);
    }).catch(function (err) { html2pdfLoader = null; throw err; });
    return html2pdfLoader;
  }

  function ensurePdfJs() {
    if (pdfJsReady && window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsLoader) return pdfJsLoader;
    pdfJsLoader = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = function () {
        if (!window.pdfjsLib) {
          reject(new Error('pdf.js loaded but global missing'));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfJsReady = true;
        resolve(window.pdfjsLib);
      };
      script.onerror = function () { reject(new Error('failed to load pdf.js')); };
      document.head.appendChild(script);
    }).catch(function (err) {
      pdfJsLoader = null;
      console.warn('pdf.js failed to load; blank PDF detection is unavailable.', err);
      throw err;
    });
    return pdfJsLoader;
  }

  function detectBlankPdf(blob) {
    return ensurePdfJs()
      .then(function (pdfjsLib) {
        return blob.arrayBuffer().then(function (buffer) {
          var loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
          return loadingTask.promise.then(function (pdf) {
            if (!pdf.numPages) return true;
            return pdf.getPage(1).then(function (page) {
              var viewport = page.getViewport({ scale: 1.25 });
              var canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.ceil(viewport.width));
              canvas.height = Math.max(1, Math.ceil(viewport.height));
              var ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (!ctx) return false;

              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
                var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                var nonWhitePixels = 0;
                for (var i = 0; i < imageData.length; i += 4) {
                  var r = imageData[i];
                  var g = imageData[i + 1];
                  var b = imageData[i + 2];
                  var a = imageData[i + 3];
                  var maxDiff = Math.max(
                    Math.abs(255 - r),
                    Math.abs(255 - g),
                    Math.abs(255 - b)
                  );
                  if (a > 8 && maxDiff > 12) nonWhitePixels++;
                }

                var totalPixels = canvas.width * canvas.height;
                var nonWhiteRatio = totalPixels > 0 ? nonWhitePixels / totalPixels : 0;
                return nonWhitePixels < 600 || nonWhiteRatio < 0.0008;
              });
            });
          });
        });
      })
      .catch(function (err) {
        console.warn('Blank PDF detection failed:', err);
        return false;
      });
  }

  /* ========================= Export Target ========================= */
  function getExportTarget() {
    if (activeTab === 'markdown') {
      var sheet = document.getElementById('preview-sheet');
      // Clone to strip watermark layers
      var clone = sheet.cloneNode(true);
      var under = clone.querySelector('#watermark-under-layer');
      var over = clone.querySelector('#watermark-over-layer');
      if (under) under.remove();
      if (over) over.remove();
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '-9999px';
      clone.style.display = 'block';
      clone.style.margin = '0';
      document.body.appendChild(clone);
      return { element: clone, isClone: true };
    }
    return { element: docEl, isClone: false };
  }

  function cleanupTarget(target) {
    if (target.isClone && target.element.parentNode) {
      target.element.parentNode.removeChild(target.element);
    }
  }

  function getHtml2PdfTarget() {
    var cleanupFns = [];
    var element = activeTab === 'markdown'
      ? document.getElementById('preview-sheet')
      : docEl;

    if (activeTab === 'markdown' && element) {
      ['#watermark-under-layer', '#watermark-over-layer'].forEach(function (selector) {
        var layer = element.querySelector(selector);
        if (!layer) return;
        var prevDisplay = layer.style.display;
        layer.style.display = 'none';
        cleanupFns.push(function () { layer.style.display = prevDisplay; });
      });
    }

    return {
      element: element,
      cleanup: function () {
        cleanupFns.forEach(function (fn) { fn(); });
      }
    };
  }

  /* ========================= Export Options ========================= */
  function currentDompdfOptions() {
    var opts = {
      format: 'a4',
      pagination: true,
      compress: benchmarkCompressEnabled,
      form: { mode: 'hybrid' },
      marginPt: 0,
      backgroundColor: '#ffffff',
      useCORS: true,
      fontConfig: symbolFontConfig
        ? [sharedFontConfig, symbolFontConfig]
        : sharedFontConfig,
      pageConfig: {
        excludePages: [1],
        header: {
          content: getRuntimeStrings().exportHeader,
          height: 50,
          contentColor: '#334155',
          contentFontSize: 12,
          contentPosition: 'center',
          padding: [0, 0, 0, 0]
        },
        footer: {
          content: getRuntimeStrings().exportFooter,
          height: 48,
          contentColor: '#475569',
          contentFontSize: 11,
          contentPosition: 'center',
          padding: [0, 0, 0, 0]
        }
      }
    };

    // For markdown tab, use preview background
    if (activeTab === 'markdown') {
      var sheet = document.getElementById('preview-sheet');
      if (sheet) {
        var style = window.getComputedStyle(sheet);
        opts.backgroundColor = style.backgroundColor || '#ffffff';
      }
    }

    return opts;
  }

  function currentViewportWidthPx() {
    var rect = docEl.getBoundingClientRect();
    return Math.max(
      window.innerWidth || 0,
      document.documentElement.clientWidth || 0,
      Math.ceil(rect.right)
    );
  }

  /* ========================= Render Engines ========================= */
  function renderWithDompdf(target) {
    var options = currentDompdfOptions();
    options.onProgress = updateDompdfProgressStatus;
    return api(target.element, options);
  }

  function renderWithHtml2Pdf(target) {
    return ensureHtml2Pdf().then(function (html2pdf) {
      return html2pdf()
        .set({
          margin: 0,
          filename: 'html2pdf-export.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: currentViewportWidthPx(),
            scrollY: 0,
            scrollX: 0
          },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait', compress: false },
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['tr', 'h1', 'h2', 'h3', '.report-stat-card', '.report-chart-container', '.invoice-details-grid > div', '[divisionDisable]']
          }
        })
        .from(target.element)
        .output('blob');
    });
  }

  /* ========================= Download ========================= */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* ========================= Measure Engine ========================= */
  function measureEngine(engine, runner) {
    var startedAt = performance.now();
    return runner()
      .then(function (blob) {
        var duration = performance.now() - startedAt;
        if (engine === 'html2pdf') {
          return detectBlankPdf(blob).then(function (blankPdfSuspected) {
            generatedBlobs[engine] = {
              blob: blob,
              time: duration,
              size: blob.size,
              blankPdfSuspected: blankPdfSuspected
            };
            return {
              blob: blob,
              durationMs: duration,
              sizeBytes: blob.size,
              blankPdfSuspected: blankPdfSuspected
            };
          });
        }
        generatedBlobs[engine] = {
          blob: blob,
          time: duration,
          size: blob.size,
          blankPdfSuspected: false
        };
        return { blob: blob, durationMs: duration, sizeBytes: blob.size, blankPdfSuspected: false };
      });
  }

  /* ========================= Update Metrics UI ========================= */
  function updateMetricsUI(engine) {
    var data = generatedBlobs[engine];
    if (!data) return;
    if (engine === 'dompdf') {
      document.getElementById('speed-dompdf').innerText = formatDuration(data.time);
      document.getElementById('size-dompdf').innerText = formatBytes(data.size);
    } else {
      var sizeHtml2PdfEl = document.getElementById('size-html2pdf');
      document.getElementById('speed-html2pdf').innerText = formatDuration(data.time);
      sizeHtml2PdfEl.innerText = data.blankPdfSuspected
        ? (formatBytes(data.size) + getRuntimeStrings().blankPdfNote)
        : formatBytes(data.size);
      sizeHtml2PdfEl.classList.toggle('error', !!data.blankPdfSuspected);
    }
    if (generatedBlobs.dompdf && generatedBlobs.html2pdf) {
      calculateDeltas();
    }
  }

  function calculateDeltas() {
    var d = generatedBlobs.dompdf;
    var h = generatedBlobs.html2pdf;

    // Speed
    var speedRatio = h.time / d.time;
    var speedDelta = document.getElementById('speed-delta');
    if (speedRatio > 1) {
      speedDelta.className = 'metric-delta positive';
      speedDelta.innerText = getRuntimeStrings().speedFaster(speedRatio);
    } else {
      speedDelta.className = 'metric-delta';
      speedDelta.innerText = getRuntimeStrings().speedSlower(1 / speedRatio);
    }

    var totalTime = d.time + h.time;
    var dSpeedPct = Math.max(10, Math.min(90, (d.time / totalTime) * 100));
    document.getElementById('speed-bar-dompdf').style.width = dSpeedPct + '%';
    document.getElementById('speed-bar-html2pdf').style.width = (100 - dSpeedPct) + '%';

    // Size
    var sizeDiffPct = ((h.size - d.size) / h.size) * 100;
    var sizeDelta = document.getElementById('size-delta');
    if (sizeDiffPct > 0) {
      sizeDelta.className = 'metric-delta positive';
      sizeDelta.innerText = getRuntimeStrings().sizeReduced(sizeDiffPct);
    } else {
      sizeDelta.className = 'metric-delta';
      sizeDelta.innerText = getRuntimeStrings().sizeIncreased(-sizeDiffPct);
    }

    var totalSize = d.size + h.size;
    var dSizePct = Math.max(10, Math.min(90, (d.size / totalSize) * 100));
    document.getElementById('size-bar-dompdf').style.width = dSizePct + '%';
    document.getElementById('size-bar-html2pdf').style.width = (100 - dSizePct) + '%';
  }

  function resetMetrics() {
    ['speed-dompdf', 'speed-html2pdf', 'size-dompdf', 'size-html2pdf'].forEach(function (id) {
      document.getElementById(id).innerText = '--';
    });
    document.getElementById('size-html2pdf').classList.remove('error');
    ['speed-bar-dompdf', 'speed-bar-html2pdf', 'size-bar-dompdf', 'size-bar-html2pdf'].forEach(function (id) {
      document.getElementById(id).style.width = '0%';
    });
    document.getElementById('speed-delta').innerText = '';
    document.getElementById('size-delta').innerText = '';
    generatedBlobs = { dompdf: null, html2pdf: null };
  }

  /* ========================= Busy State ========================= */
  // PDF 生成/对比按钮：字体就绪前禁用，避免在字体未加载时触发导出
  var EXPORT_BTN_IDS = ['btn-export-dompdf', 'btn-export-html2pdf', 'btn-compare'];
  function setExportButtonsEnabled(enabled) {
    for (var i = 0; i < EXPORT_BTN_IDS.length; i++) {
      var btn = document.getElementById(EXPORT_BTN_IDS[i]);
      if (!btn) continue;
      btn.disabled = !enabled;
      if (enabled) {
        btn.removeAttribute('title');
      } else {
        btn.title = getRuntimeStrings().toolbarDisabledTitle;
      }
    }
  }

  function withBusy(fn) {
    var btns = document.querySelectorAll('.action-btn');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
    return fn().finally(function () {
      for (var j = 0; j < btns.length; j++) btns[j].disabled = false;
    });
  }

  /* ========================= Export Handlers ========================= */
  window.exportDompdf = function () {
    withBusy(function () {
      setStatusLoading(getRuntimeStrings().dompdfRunning);
      var target = null;
      return ensureDemoReady()
        .then(function () { return ensureBenchmarkSampleReady(); })
        .then(function () {
          setStatusLoading(getRuntimeStrings().dompdfRunning);
          target = getExportTarget();
          return measureEngine('dompdf', function () { return renderWithDompdf(target); });
        })
        .then(function (result) {
          downloadBlob(result.blob, 'dompdf-studio-demo.pdf');
          updateMetricsUI('dompdf');
          setStatus(getRuntimeStrings().dompdfDone(
            formatDuration(result.durationMs),
            formatBytes(result.sizeBytes)
          ));
        })
        .catch(function (err) {
          setStatus('error: ' + err.message, true);
          console.error(err);
        })
        .finally(function () { if (target) cleanupTarget(target); });
    });
  };

  window.exportHtml2pdf = function () {
    withBusy(function () {
      setStatusLoading(getRuntimeStrings().html2pdfRunning);
      var target = null;
      return ensureDemoReady()
        .then(function () { return ensureBenchmarkSampleReady(); })
        .then(function () {
          setStatusLoading(getRuntimeStrings().html2pdfRunning);
          target = getHtml2PdfTarget();
          return measureEngine('html2pdf', function () { return renderWithHtml2Pdf(target); });
        })
        .then(function (result) {
          downloadBlob(result.blob, 'html2pdf-studio-demo.pdf');
          updateMetricsUI('html2pdf');
          setStatus(getRuntimeStrings().html2pdfDone(
            formatDuration(result.durationMs),
            formatBytes(result.sizeBytes),
            result.blankPdfSuspected
          ));
        })
        .catch(function (err) {
          setStatus('error: ' + err.message, true);
          console.error(err);
        })
        .finally(function () {
          if (target && typeof target.cleanup === 'function') target.cleanup();
          else if (target) cleanupTarget(target);
        });
    });
  };

  window.runCompare = function () {
    resetMetrics();
    withBusy(function () {
      setStatusLoading(getRuntimeStrings().compareDompdf);
      var target = null;
      var htmlTarget = null;
      return ensureDemoReady()
        .then(function () { return ensureBenchmarkSampleReady(); })
        .then(function () {
          setStatusLoading(getRuntimeStrings().compareDompdf);
          target = getExportTarget();
          return measureEngine('dompdf', function () { return renderWithDompdf(target); });
        })
        .then(function () {
          updateMetricsUI('dompdf');
          setStatusLoading(getRuntimeStrings().compareHtml2pdf);
          // Need a fresh target for html2pdf
          cleanupTarget(target);
          target = null;
          htmlTarget = getHtml2PdfTarget();
          return measureEngine('html2pdf', function () { return renderWithHtml2Pdf(htmlTarget); })
            .then(function () {
              updateMetricsUI('html2pdf');
              setStatus(
                generatedBlobs.html2pdf && generatedBlobs.html2pdf.blankPdfSuspected
                  ? getRuntimeStrings().compareDoneBlank
                  : getRuntimeStrings().compareDone
              );
              if (typeof htmlTarget.cleanup === 'function') htmlTarget.cleanup();
              else cleanupTarget(htmlTarget);
              htmlTarget = null;
            });
        })
        .catch(function (err) {
          setStatus('error: ' + err.message, true);
          console.error(err);
          if (target) cleanupTarget(target);
          if (htmlTarget && typeof htmlTarget.cleanup === 'function') htmlTarget.cleanup();
          else if (htmlTarget) cleanupTarget(htmlTarget);
        });
    });
  };

  /* ========================= Chart Generator ========================= */
  function createChartDataUrl() {
    var width = 440, height = 280;
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    var bg = ctx.createLinearGradient(0, 0, width, height);
    var data = [84, 92, 118, 104, 132, 126];
    var barWidth = 34, gap = 22, x = 68;

    bg.addColorStop(0, '#f8fafc');
    bg.addColorStop(1, '#edf2f7');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#d8e1eb';
    ctx.lineWidth = 1;
    for (var y = 40; y < height - 20; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#7891b2';
    for (var i = 0; i < data.length; i++) {
      var barHeight = data[i] * 1.2;
      ctx.fillRect(x, height - 30 - barHeight, barWidth, barHeight);
      ctx.fillStyle = '#60758d';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i], x + 2, height - 10);
      ctx.fillStyle = '#7891b2';
      x += barWidth + gap;
    }

    ctx.strokeStyle = '#24384f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.stroke();

    ctx.strokeStyle = '#24384f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(85, 142);
    ctx.lineTo(141, 130);
    ctx.lineTo(197, 110);
    ctx.lineTo(253, 116);
    ctx.lineTo(309, 88);
    ctx.lineTo(365, 94);
    ctx.stroke();

    ctx.fillStyle = '#24384f';
    var points = [[85, 142], [141, 130], [197, 110], [253, 116], [309, 88], [365, 94]];
    for (var j = 0; j < points.length; j++) {
      ctx.beginPath();
      ctx.arc(points[j][0], points[j][1], 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 16px Inter, sans-serif';
    ctx.fillText(getRuntimeStrings().chartTitle, 40, 26);
    ctx.fillStyle = '#60758d';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(getRuntimeStrings().chartSubtitle, 40, 46);
    return canvas.toDataURL('image/jpeg', 0.86);
  }

  /* ========================= Appendix Builders ========================= */
  function buildRecordsTable() {
    var body = document.getElementById('records-body');
    if (!body) return;
    body.innerHTML = '';

    var baseGroups = getLocalePack().tableGroups;

    var groups = benchmarkMode === 'light'
      ? baseGroups.slice(0, 2)
      : baseGroups;

    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];

      for (var j = 0; j < group.rows.length; j++) {
        var row = group.rows[j];
        var tr = document.createElement('tr');
        // tr.setAttribute('divisionDisable', '');

        if (j === 0) {
          tr.innerHTML =
            '<td class="report-cell-group cn-copy" rowspan="' + group.rows.length + '">' + group.group + '</td>' +
            '<td class="report-cell-metric">' + row[0] + '</td>' +
            '<td class="report-cell-metric ' + (parseFloat(row[1]) >= 20 ? 'report-cell-positive' : 'report-cell-warning') + '">' + row[1] + '</td>' +
            '<td class="report-cell-metric">' + row[2] + '</td>' +
            '<td class="report-cell-metric ' + (parseFloat(row[3]) >= 20 ? 'report-cell-positive' : 'report-cell-warning') + '">' + row[3] + '</td>' +
            '<td class="report-cell-status ' + group.statusClass + '" rowspan="' + group.rows.length + '">' + group.statusText + '</td>';
        } else {
          tr.innerHTML =
            '<td class="report-cell-metric">' + row[0] + '</td>' +
            '<td class="report-cell-metric ' + (parseFloat(row[1]) >= 20 ? 'report-cell-positive' : 'report-cell-warning') + '">' + row[1] + '</td>' +
            '<td class="report-cell-metric">' + row[2] + '</td>' +
            '<td class="report-cell-metric ' + (parseFloat(row[3]) >= 20 ? 'report-cell-positive' : 'report-cell-warning') + '">' + row[3] + '</td>';
        }

        body.appendChild(tr);
      }
    }
  }

  function buildLongList(buildVersion) {
    var list = document.getElementById('long-list');
    if (!list) return Promise.resolve();
    list.innerHTML = '';
    if (typeof buildVersion !== 'number') buildVersion = benchmarkBuildVersion;

    var localeLongList = getLocalePack().longList;
    var entries = benchmarkMode === 'light' ? localeLongList.light : localeLongList.heavy;
    var repeatCount = benchmarkMode === 'light' ? 1 : benchmarkMode === 'extreme' ? 8940 : 440;
    var batchSize = benchmarkMode === 'extreme' ? 120 : repeatCount;

    return new Promise(function (resolve) {
      var index = 0;
      var buildStartedAt = performance.now();
      var lastLoggedStep = -1;

      console.info('[benchmark] start building sample:', benchmarkMode, 'items:', repeatCount);

      function appendBatch() {
        if (buildVersion !== benchmarkBuildVersion) {
          console.info('[benchmark] build canceled');
          resolve();
          return;
        }

        var fragment = document.createDocumentFragment();
        var end = Math.min(index + batchSize, repeatCount);

        for (; index < end; index++) {
          var li = document.createElement('li');
          li.className = 'cn-copy';
          li.appendChild(document.createTextNode(entries));
          fragment.appendChild(li);
        }

        list.appendChild(fragment);

        var percent = Math.min(100, Math.round((index / repeatCount) * 100));
        var step = Math.floor(percent / 5);
        if (step > lastLoggedStep || index === repeatCount) {
          lastLoggedStep = step;
          console.info(
            '[benchmark] building sample ' +
            percent + '% (' + index + '/' + repeatCount + '), elapsed ' +
            ((performance.now() - buildStartedAt) / 1000).toFixed(2) + 's'
          );
        }

        if (index < repeatCount) {
          setTimeout(appendBatch, 0);
          return;
        }

        console.info('[benchmark] sample build completed in ' + ((performance.now() - buildStartedAt) / 1000).toFixed(2) + 's');
        resolve();
      }

      appendBatch();
    });
  }

  function updateDocPageInfo() {
    if (!topbarPageInfo || !docEl) return;
    topbarPageInfo.textContent = getRuntimeStrings().approxDocPages(
      Math.max(1, docEl.scrollHeight / 1123).toFixed(1)
    );
  }

  /* ========================= Markdown Editor ========================= */
  function initMarkdownEditor() {
    if (vditor) return;
    if (!markedApi || typeof markedApi.parse !== 'function' || !purifier) {
      setStatus(getRuntimeStrings().markdownDepsFailed, true);
      return;
    }

    markedApi.setOptions({ gfm: true, breaks: true });

    vditor = new Vditor('vditor-container', {
      cdn: vditorCdnBase,
      mode: 'ir',
      height: '100%',
      placeholder: getRuntimeStrings().markdownPlaceholder,
      cache: { enable: false },
      preview: {
        theme: {
          current: 'light',
          path: vditorCdnBase + '/dist/css/content-theme'
        }
      },
      hint: {
        emojiPath: vditorCdnBase + '/dist/images/emoji'
      },
      theme: 'classic',
      resize: { enable: false },
      toolbar: [
        'emoji', 'headings', 'bold', 'italic', 'strike', 'link', '|',
        'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
        'quote', 'line', 'code', 'inline-code', '|',
        'table', 'undo', 'redo'
      ],
      input: function () { scheduleMdRender(); },
      after: function () {
        vditor.setValue(mdSamples.default);
        renderMarkdownNow();
      }
    });
  }

  function renderMarkdownNow() {
    if (!vditor) return;
    var markdown = vditor.getValue();
    var html = markdown.trim() ? markedApi.parse(markdown) : '';
    var previewEl = document.getElementById('markdown-preview');
    var sheetEl = document.getElementById('preview-sheet');
    previewEl.innerHTML = purifier.sanitize(html, { USE_PROFILES: { html: true } });
    sheetEl.classList.toggle('is-empty', !markdown.trim());
    updateMdStats(markdown);
  }

  function scheduleMdRender() {
    clearTimeout(mdRenderTimer);
    mdRenderTimer = setTimeout(renderMarkdownNow, 90);
  }

  function updateMdStats(text) {
    var s = text || '';
    document.getElementById('md-char-count').textContent = getRuntimeStrings().markdownChars(s.length);
    document.getElementById('md-word-count').textContent = getRuntimeStrings().markdownWords((s.trim().match(/[A-Za-z0-9_]+/g) || []).length);
    document.getElementById('md-line-count').textContent = getRuntimeStrings().markdownLines(s.split(/\r?\n/).length);
    var sheet = document.getElementById('preview-sheet');
    document.getElementById('md-page-count').textContent = getRuntimeStrings().markdownPages(
      Math.max(1, sheet.scrollHeight / 1123).toFixed(1)
    );
    document.getElementById('md-theme-indicator').textContent = themeLabels[activeTheme];
  }

  // Theme switcher for markdown
  var themeSelect = document.getElementById('md-theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', function () {
      activeTheme = themeSelect.value;
      document.getElementById('preview-sheet').setAttribute('data-theme', activeTheme);
      document.getElementById('md-theme-indicator').textContent = themeLabels[activeTheme];
    });
  }

  /* ========================= Automation API ========================= */
  var readyResolve;
  var readyPromise = new Promise(function (resolve) { readyResolve = resolve; });

  function encodeBase64(uint8) {
    var binary = '';
    var chunkSize = 32768;
    for (var i = 0; i < uint8.length; i += chunkSize) {
      var chunk = uint8.subarray(i, Math.min(i + chunkSize, uint8.length));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  window.__DOMPDF_AUTOMATION__ = {
    ready: function () { return readyPromise; },
    getMeta: function (override) {
      var options = Object.assign({}, currentDompdfOptions(), override || {});
      var rect = docEl.getBoundingClientRect();
      return {
        selector: '#document',
        rootWidthPx: rect.width,
        rootHeightPx: rect.height,
        devicePixelRatio: window.devicePixelRatio || 1,
        pageBreaks: api.computePageBreaks(docEl, options),
        options: options
      };
    },
    inspect: function (override) {
      var options = Object.assign({}, currentDompdfOptions(), override || {});
      return readyPromise.then(function () { return api.inspect(docEl, options); });
    },
    exportPdf: function (override) {
      var options = Object.assign({}, currentDompdfOptions(), override || {});
      return readyPromise.then(function () {
        return api(docEl, options).then(function (blob) {
          return blob.arrayBuffer().then(function (buf) {
            return { pdfBase64: encodeBase64(new Uint8Array(buf)), meta: {} };
          });
        });
      });
    }
  };

  /* ========================= Init ========================= */
  if (!api) {
    setStatus(getRuntimeStrings().missingBuild, true);
    return;
  }

  captureStaticContent();
  renderLanguageSwitch();
  setStatusLoading(getRuntimeStrings().loadingResources);
  setExportButtonsEnabled(false); // 字体就绪前禁用导出/对比按钮
  updateBenchmarkUi();
  buildRecordsTable();
  buildLongList();
  updateDocPageInfo();
  document.getElementById('sample-img').src = createChartDataUrl();
  applyStaticTranslations(currentLocale);
  window.addEventListener('resize', updateDocPageInfo);

  // Preload html2pdf
  ensureHtml2Pdf().catch(function () { });
  ensurePdfJs().catch(function () { });

  // Load fonts
  Promise.all([loadFont(), loadSymbolFont()])
    .then(function () {
      setStatus(symbolFontConfig ? getRuntimeStrings().readyWithSymbol : getRuntimeStrings().ready);
    })
    .catch(function (err) {
      setStatus(getRuntimeStrings().fontWarning(err.message), true);
    })
    .finally(function () {
      // 字体字节就绪才放开导出按钮；失败则保持禁用
      setExportButtonsEnabled(!!sharedFontConfig.fontBytes);
      readyResolve({
        status: statusTextEl.textContent,
        hasFontBytes: !!sharedFontConfig.fontBytes
      });
    });
})();
