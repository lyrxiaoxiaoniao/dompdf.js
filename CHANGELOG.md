# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.2.0 (2026-01-28)


### Features

* New feature: PDF pagination rendering ([1a67b17](https://github.com/lmn1919/dompdf.js/commit/1a67b17b65e70f02f20d0378e09a7645176be76e))
* PDF pagination rendering ([8b83a87](https://github.com/lmn1919/dompdf.js/commit/8b83a87b0f2a9f1255d36b00abfc60abf265052c))
* upgrade dependencies (@rollup/plugin-node-resolve@15.2.3, jspdf@4.0.0) ([9fe9176](https://github.com/lmn1919/dompdf.js/commit/9fe9176387e8a5f7c5fbb97a442fa1b8737cd3fa))


### Bug Fixes

* 1. Remove CanvasRenderingContext2D instances and use the jsPDF API for all drawing ([6fe5280](https://github.com/lmn1919/dompdf.js/commit/6fe5280d1745461eca203454487ddaa8b585544e))
* 修复cnavns绘制黑底，英文绘制位置偏差问题 ([0db1c01](https://github.com/lmn1919/dompdf.js/commit/0db1c012a562827379a7fb546838fae3d73a3fc0))
* 修复pdf位置便宜问题 ([5cd4efd](https://github.com/lmn1919/dompdf.js/commit/5cd4efdabf3344828d08dabbd51cda4767a8c9dd))
* Cross-domain image rendering failed, but it does not affect the rendering process ([412076f](https://github.com/lmn1919/dompdf.js/commit/412076f8b2c5dc3536b5c83f359172fe0ffa072b))
* Fixed an error when calling this.jspdfCtx.restoreGraphicsState() when the internal graphics state stack of jsPDF is empty ([cc83096](https://github.com/lmn1919/dompdf.js/commit/cc830961c2810f3927b3b0159a8146e4d272bcd1))
* fontConfig init error ([58f6486](https://github.com/lmn1919/dompdf.js/commit/58f64862518b7b195a366ab26d4066163c6a315b))
* Rendering Dashed Border or Dotted Border results in a blank page ([45d0bad](https://github.com/lmn1919/dompdf.js/commit/45d0badbf8df953da79b7d9017bfd9ecf28948a6))
