/* 双梦小馆-拼豆图纸生成器 —— 纯前端实现 */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 色卡
   * ------------------------------------------------------------------ */

  const PALETTE_LABELS = {
    MARD221: 'MARD 221 标准版',
    MARD291: 'MARD 291',
    Hama: 'Hama 92',
    Perler: 'Perler 103',
    COCO: 'COCO 291',
    Manman: '漫漫 278',
    Panpan: '盼盼 289',
    Mixiaowo: '咪小窝 290',
    ArtkalC197: '优肯 C 197',
    ArtkalM221: '优肯 M 221',
    Artkal418: '优肯 418',
    ArtkalS199: 'Artkal S 199',
  };

  const DEFAULT_PALETTE = 'MARD221';

  const rawPalettes = window.BEAD_PALETTES || {};
  const paletteCache = new Map();

  function getPalette(key) {
    if (paletteCache.has(key)) return paletteCache.get(key);
    const source = rawPalettes[key] || rawPalettes[DEFAULT_PALETTE] || [];
    const colors = source.map((entry) => ({
      code: String(entry.code),
      name: entry.name || String(entry.code),
      hex: entry.hex,
      rgb: hexToRgb(entry.hex),
    }));
    paletteCache.set(key, colors);
    return colors;
  }

  function isKnownPalette(key) {
    return Object.prototype.hasOwnProperty.call(rawPalettes, key);
  }

  function paletteLabel(key) {
    return PALETTE_LABELS[key] || key;
  }

  /* ------------------------------------------------------------------ *
   * 处理模式
   * ------------------------------------------------------------------ */

  // 五种处理模式，对应参考产品的「卡通 / 真实 / 卡通真实合并 / 平滑 / 纯映射」
  const STYLE_PRESETS = {
    cartoon: {
      contrast: 1.12, saturation: 1.18, brightness: 3, smooth: 0, sharpen: 0.55,
      flatten: { radius: 2, threshold: 64 },
    },
    realistic: { contrast: 1.05, saturation: 1.05, brightness: 0, smooth: 1, sharpen: 0.15 },
    hybrid: { contrast: 1.08, saturation: 1.1, brightness: 1, smooth: 1, sharpen: 0.35 },
    smooth: {
      contrast: 0.97, saturation: 0.95, brightness: 4, smooth: 2, sharpen: 0,
      flatten: { radius: 3, threshold: 86 },
    },
    direct: { contrast: 1, saturation: 1, brightness: 0, smooth: 0, sharpen: 0 },
  };

  const STYLE_INFO = {
    cartoon: { label: '卡通', desc: '画面更清爽，适合动漫、插画和线条清晰的图片。' },
    realistic: { label: '真实', desc: '明暗过渡更自然，适合人物照片、宠物和风景。' },
    hybrid: { label: '卡通真实合并', desc: '清晰与自然兼顾，大多数图片建议优先选择。' },
    smooth: { label: '平滑', desc: '减少零碎颜色，让图纸看起来更加整齐。' },
    direct: { label: '纯映射', desc: '适合像素图、现成图纸和已经处理好的图片。' },
  };

  // 拼豆品牌 → 色卡范围。只列项目里真实存在的色卡数据，不虚构品牌。
  const BRANDS = [
    { key: 'MARD', label: 'MARD', desc: '专业 MARD 色号体系', ranges: [['MARD221', '221 色'], ['MARD291', '291 色']] },
    { key: 'COCO', label: 'COCO', desc: 'COCO 完整色号体系', ranges: [['COCO', '291 色']] },
    { key: 'Manman', label: '漫漫', desc: '漫漫完整色号体系', ranges: [['Manman', '278 色']] },
    { key: 'Panpan', label: '盼盼', desc: '盼盼完整色号体系', ranges: [['Panpan', '289 色']] },
    { key: 'Mixiaowo', label: '咪小窝', desc: '咪小窝完整色号体系', ranges: [['Mixiaowo', '290 色']] },
    {
      key: 'Artkal',
      label: '优肯 Artkal',
      desc: '优肯多系列色号体系',
      ranges: [['ArtkalC197', 'C 197 色'], ['ArtkalM221', 'M 221 色'], ['Artkal418', '418 色'], ['ArtkalS199', 'S 199 色']],
    },
    { key: 'Hama', label: 'Hama', desc: 'Hama 经典色号体系', ranges: [['Hama', '92 色']] },
    { key: 'Perler', label: 'Perler', desc: 'Perler 经典色号体系', ranges: [['Perler', '103 色']] },
  ];

  const SIZE_PRESETS = [16, 26, 32, 50, 52, 64, 80, 100, 128];

  const SCREEN_THEME = {
    padding: 24, header: 64, coord: 30,
    legendRow: 44, legendHeader: 48,
    codeFont: 0.36, minCodeFont: 5,
    coordFont: 0.38, minCoordFont: 8,
    headerTitle: 22, headerSub: 13, headerBrand: 16, headerBrandSub: 12,
    legendTitle: 18, legendTotal: 14, legendCode: 14, legendName: 11, legendCount: 13, swatch: 26,
  };

  const EXPORT_THEME = {
    padding: 32, header: 72, coord: 38,
    legendRow: 52, legendHeader: 56,
    codeFont: 0.42, minCodeFont: 10,
    coordFont: 0.4, minCoordFont: 11,
    headerTitle: 26, headerSub: 15, headerBrand: 18, headerBrandSub: 13,
    legendTitle: 22, legendTotal: 16, legendCode: 16, legendName: 12, legendCount: 15, swatch: 30,
  };

  const MAX_CELL_PIXELS = 8200;

  // 导出规格：按需求锁定为 MARD 2.6mm 硬质 + 29×29 标准拼板，禁止 5mm/其他品牌规格出图
  const BEAD_SPECS = {
    'MARD-2.6-hard': {
      id: 'MARD-2.6-hard',
      brand: 'MARD',
      label: 'MARD 2.6mm 硬质',
      diameterMm: 2.6,
      boardSize: 29,
    },
  };
  const LOCKED_SPEC_ID = 'MARD-2.6-hard';
  const MM_TO_PT = 72 / 25.4;
  const PDF_A4 = { width: 595.28, height: 841.89 };

  // MARD 扩展系列含义。
  // 来源：https://www.pindoupic.com/seka （"MARD 色号按色系分组：A 黄橙色、B 绿色、C 蓝色、D 紫色、
  //   E 粉色、F 红色、G 棕咖啡色、H 黑白灰、M 莫兰迪色。扩展系列包括 P 马卡龙、Q 荧光、R 缤纷、
  //   T 透明、Y 夜光、ZG 珠光"）与 https://www.pindou.online/colors（291 色在 221 色基础上新增
  //   P/Q/R/T/Y/ZG 特殊系列）。只有 Q/T/Y/ZG 是材质不同的特殊色，P/R 只是扩展色域，不加材质标记。
  const MARD_SERIES = {
    P: { label: '马卡龙', mark: '' },
    Q: { label: '荧光', mark: '△' },
    R: { label: '缤纷', mark: '' },
    T: { label: '透明', mark: '◇' },
    Y: { label: '夜光', mark: '☆' },
    ZG: { label: '珠光', mark: '*' },
  };
  const MARD_BASE_SERIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'];
  const MARD_PALETTES = ['MARD221', 'MARD291'];
  // 特殊色标记只认 MARD：其他品牌的 T/Y/Q/P/R 前缀含义不同（如 COCO 有 Y 系、漫漫有 Q/R/Y/P/T 系），
  // 套用 MARD 的语义会误标。
  const MARK_LEGEND = '* 珠光 · △ 荧光 · ☆ 夜光 · ◇ 透明';

  // 各色卡色号格式（按 tools/color-sources 里的真实色号归纳），导出前抽样校验用
  const CODE_SHAPES = {
    MARD221: /^[A-Z]{1,2}\d{1,3}$/,
    MARD291: /^[A-Z]{1,2}\d{1,3}$/,
    Manman: /^[A-Z]{1,3}\d{1,3}$/,
    COCO: /^[A-Z]{1,2}\d{1,3}$/,
    Hama: /^H\d{2}$/,
    Perler: /^\d{2}-\d{5}$/,
    Panpan: /^\d{1,3}$/,
    Mixiaowo: /^(\d{1,3}|ZG\d{1,2})$/,
    ArtkalC197: /^C[A-Z]?\d{2,3}$/,
    ArtkalM221: /^M[A-Z]?\d{1,3}$/,
    Artkal418: /^(C|M)[A-Z]?\d{2,3}$/,
    ArtkalS199: /^S[A-Z]?\d{2,3}$/,
  };

  // 用途预设：限制最大颜色数 + 开启最少颜色阈值（剔除孤立杂色）
  const COLOR_PRESETS = {
    custom: { label: '自定义', min: 6, max: 60, value: 40, minCount: 0 },
    illustration: { label: '插画 16~24 色', min: 16, max: 24, value: 20, minCount: 6 },
    photo: { label: '照片 20~30 色', min: 20, max: 30, value: 26, minCount: 8 },
  };

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);
  const imageInput = $('imageInput');
  const projectInput = $('projectInput');
  const fileName = $('fileName');
  const sourcePreview = $('sourcePreview');
  const cropCanvas = $('cropCanvas');
  const cropEmpty = $('cropEmpty');
  const autoTrim = $('autoTrim');
  const removeBg = $('removeBg');
  const beadWidth = $('beadWidth');
  const beadWidthInput = $('beadWidthInput');
  const beadHeight = $('beadHeight');
  const beadHeightInput = $('beadHeightInput');
  const sizeModeButtons = $('sizeModeButtons');
  const sizePresetGrid = $('sizePresetGrid');
  const sizeModeHelp = $('sizeModeHelp');
  const beadSizeValue = $('beadSizeValue');
  const beadSpec = $('beadSpec');
  const physicalSize = $('physicalSize');
  const styleMode = $('styleMode');
  const styleDesc = $('styleDesc');
  const preserveColor = $('preserveColor');
  const paletteMode = $('paletteMode');
  const brandMode = $('brandMode');
  const rangeMode = $('rangeMode');
  const beadSet = $('beadSet');
  const beadSetHint = $('beadSetHint');
  const excludedColors = $('excludedColors');
  const colorCount = $('colorCount');
  const colorCountValue = $('colorCountValue');
  const colorPreset = $('colorPreset');
  const colorPresetButtons = $('colorPresetButtons');
  const minColorCount = $('minColorCount');
  const minColorCountValue = $('minColorCountValue');
  const isolatedCleanup = $('isolatedCleanup');
  const mirrorPages = $('mirrorPages');
  const notesText = $('notesText');
  const codeCheck = $('codeCheck');
  const generateButton = $('generateButton');
  const exportButton = $('exportButton');
  const exportPdfButton = $('exportPdfButton');
  const saveProjectButton = $('saveProjectButton');
  const tileBoards = $('tileBoards');
  const undoButton = $('undoButton');
  const statusText = $('statusText');
  const patternMeta = $('patternMeta');
  const patternCanvas = $('patternCanvas');
  const canvasStage = $('canvasStage');
  const zoomFitButton = $('zoomFitButton');
  const mirrorButton = $('mirrorButton');
  const emptyState = $('emptyState');
  const paintColor = $('paintColor');
  const paintColorList = $('paintColorList');
  const paintPaletteColorList = $('paintPaletteColorList');
  const replaceSourceList = $('replaceSourceList');
  const replaceSourceSummary = $('replaceSourceSummary');
  const replaceSelectAllButton = $('replaceSelectAllButton');
  const replaceClearButton = $('replaceClearButton');
  const replaceTargetCode = $('replaceTargetCode');
  const replaceCodeOptions = $('replaceCodeOptions');
  const replacePreview = $('replacePreview');
  const replaceAllButton = $('replaceAllButton');
  const toolButtons = $('toolButtons');
  const toolHelp = $('toolHelp');
  const resultTabs = $('resultTabs');
  const copyColorsButton = $('copyColorsButton');

  const patternCtx = patternCanvas.getContext('2d');
  const cropCtx = cropCanvas.getContext('2d');

  /* ------------------------------------------------------------------ *
   * 状态
   * ------------------------------------------------------------------ */

  const TOOL_HELP = {
    pan: '双指缩放，单指拖动查看；选好颜色后轻点格子即可替换',
    paint: '按住拖动可连续涂色，整笔算一步撤销；滚轮缩放，中键拖动平移',
    eyedropper: '点图纸格子吸取该色号，或点右侧「预览」里的原图吸取对应色卡颜色',
    eraser: '按住拖动把格子擦成空位，空位不计入用料清单',
  };

  const state = {
    image: null,
    imageFile: null,
    imageUrl: '',
    crop: null,
    cropDrag: null,
    cropFrame: { x: 0, y: 0, width: 0, height: 0 },
    trimCache: null,
    pattern: null,
    view: 'pattern',
    sizeMode: 'ratio',
    mirrored: false,
    paintCode: '',
    replaceSources: new Set(),
    replaceHighlight: new Set(),
    tool: 'pan',
    stroke: null,
    undoStack: [],
  };

  const view = {
    zoom: 1,
    fitCell: 0,
    baseCell: 0,
    boardX: 0,
    boardY: 0,
    sheetWidth: 0,
    sheetHeight: 0,
    offsetX: 0,
    offsetY: 0,
    width: 0,
    height: 0,
    pointers: new Map(),
    gesture: null,
    frame: 0,
    pendingInteractive: false,
  };

  /* ------------------------------------------------------------------ *
   * 工具
   * ------------------------------------------------------------------ */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hexToRgb(hex) {
    const value = String(hex || '').replace('#', '').trim();
    const full = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value.padEnd(6, '0');
    return {
      r: parseInt(full.slice(0, 2), 16) || 0,
      g: parseInt(full.slice(2, 4), 16) || 0,
      b: parseInt(full.slice(4, 6), 16) || 0,
    };
  }

  function rgbToHex(rgb) {
    const part = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
  }

  // 感知加权的平方距离，避免开方开销
  function colorDistance(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
  }

  function luminance(rgb) {
    return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  }

  function contrastColor(rgb) {
    return luminance(rgb) > 0.62 ? '#2b3634' : '#ffffff';
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function patternIndex(pattern, x, y) {
    // 分页导出时会造出「已按显示顺序排好」的子图纸，用 pattern.mirror 关掉二次镜像
    const mirrored = pattern.mirror === undefined ? state.mirrored : pattern.mirror;
    return y * pattern.width + (mirrored ? pattern.width - 1 - x : x);
  }

  // 当前锁定的珠子规格；导出前用 assertExportSpec 再兜一次底
  function lockedSpec() {
    return BEAD_SPECS[beadSpec.value] || BEAD_SPECS[LOCKED_SPEC_ID];
  }

  function assertExportSpec() {
    const spec = lockedSpec();
    if (spec.diameterMm !== BEAD_SPECS[LOCKED_SPEC_ID].diameterMm || spec.brand !== 'MARD') {
      throw new Error('导出规格必须锁定为 MARD 2.6mm 硬质，不能用 5mm 或其他品牌规格出图');
    }
    return spec;
  }

  // 实际成品尺寸：横向格数 × 2.6mm
  function physicalSizeMm(pattern, spec) {
    return {
      width: pattern.width * spec.diameterMm,
      height: pattern.height * spec.diameterMm,
    };
  }

  function formatMm(value) {
    return value.toFixed(1);
  }

  function seriesOf(code) {
    const match = /^([A-Z]{1,2})\d+$/.exec(String(code || ''));
    return match ? match[1] : '';
  }

  // 特殊色标记只对 MARD 色卡生效（其他品牌前缀语义不同，见 MARD_SERIES 注释）
  function colorMark(code, paletteKey) {
    if (!MARD_PALETTES.includes(paletteKey)) return '';
    const series = MARD_SERIES[seriesOf(code)];
    return series ? series.mark : '';
  }

  function codeShapeFor(paletteKey) {
    return CODE_SHAPES[paletteKey] || null;
  }

  // 自有套装过滤：按选定的套装（如 MARD 221）剔掉套装里没有的色号
  function applyBeadSet(palette) {
    const key = beadSet.value;
    if (key === 'all' || !isKnownPalette(key)) return palette;
    const allowed = new Set(getPalette(key).map((color) => color.code));
    const filtered = palette.filter((color) => allowed.has(color.code));
    return filtered.length >= 2 ? filtered : palette;
  }

  function beadSetRemoved(palette) {
    const key = beadSet.value;
    if (key === 'all' || !isKnownPalette(key)) return 0;
    const allowed = new Set(getPalette(key).map((color) => color.code));
    return palette.filter((color) => !allowed.has(color.code)).length;
  }

  // 品牌 / 色卡范围两个下拉，最终都落到隐藏的 paletteMode 上
  function populateBrandOptions() {
    brandMode.replaceChildren();
    for (const brand of BRANDS) {
      const option = document.createElement('option');
      option.value = brand.key;
      option.textContent = brand.label;
      option.title = brand.desc;
      brandMode.append(option);
    }
  }

  function brandOfPalette(paletteKey) {
    return BRANDS.find((brand) => brand.ranges.some(([key]) => key === paletteKey)) || BRANDS[0];
  }

  function populateRangeOptions(brandKey, preferred) {
    const brand = BRANDS.find((item) => item.key === brandKey) || BRANDS[0];
    rangeMode.replaceChildren();
    for (const [key, label] of brand.ranges) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = label;
      rangeMode.append(option);
    }
    const target = preferred && brand.ranges.some(([key]) => key === preferred)
      ? preferred
      : brand.ranges[0][0];
    rangeMode.value = target;
    paletteMode.value = target;
    return target;
  }

  function selectPalette(paletteKey) {
    const brand = brandOfPalette(paletteKey);
    brandMode.value = brand.key;
    populateRangeOptions(brand.key, paletteKey);
    paletteMode.value = paletteKey;
  }

  function updateStyleDesc() {
    const info = STYLE_INFO[styleMode.value] || STYLE_INFO.cartoon;
    styleDesc.textContent = info.desc;
  }

  function updateBeadSetHint() {
    const key = beadSet.value;
    const paletteKey = paletteMode.value;
    const palette = activePaletteBase();
    if (key === 'all' || !isKnownPalette(key)) {
      beadSetHint.textContent = `当前色卡共 ${palette.length} 色，未按套装过滤。`;
      return;
    }
    const removed = beadSetRemoved(palette);
    beadSetHint.textContent = removed
      ? `已按「${paletteLabel(key)}」过滤，禁用 ${removed} 个套装外的色号，可用 ${palette.length - removed} 色。`
      : `当前色卡（${paletteLabel(paletteKey)}）都在「${paletteLabel(key)}」套装内。`;
  }

  // 孤立像素检测：把同色连通块只有 1~2 颗的杂色点并进周围主色，减少备料种类
  function mergeIsolatedBeads(beads, width, height, maxSize) {
    if (!(maxSize > 0)) return beads;
    const visited = new Uint8Array(beads.length);
    const result = beads.slice();
    const stack = [];
    const neighboursOf = (index) => {
      const x = index % width;
      const y = (index - x) / width;
      const list = [];
      if (x > 0) list.push(index - 1);
      if (x < width - 1) list.push(index + 1);
      if (y > 0) list.push(index - width);
      if (y < height - 1) list.push(index + width);
      return list;
    };

    for (let start = 0; start < beads.length; start += 1) {
      const bead = beads[start];
      if (bead.isBackground || visited[start]) continue;

      // 收集同色 4 邻域连通块
      stack.length = 0;
      stack.push(start);
      visited[start] = 1;
      const members = [];
      while (stack.length) {
        const index = stack.pop();
        members.push(index);
        for (const next of neighboursOf(index)) {
          if (!visited[next] && !beads[next].isBackground && beads[next].code === bead.code) {
            visited[next] = 1;
            stack.push(next);
          }
        }
      }
      if (members.length > maxSize) continue;

      // 投票选出周围出现最多的颜色
      const votes = new Map();
      for (const index of members) {
        for (const next of neighboursOf(index)) {
          const other = beads[next];
          if (other.isBackground || other.code === bead.code) continue;
          const vote = votes.get(other.code) || { color: other, count: 0 };
          vote.count += 1;
          votes.set(other.code, vote);
        }
      }
      const winner = [...votes.values()].sort((a, b) => b.count - a.count)[0];
      if (!winner) continue;
      for (const index of members) result[index] = winner.color;
    }
    return result;
  }

  // 最少颜色阈值：用量低于阈值的颜色并入最接近的保留色，剔除孤立杂色
  function pruneRareColors(beads, threshold) {
    if (!(threshold > 0)) return beads;
    const usage = new Map();
    for (const bead of beads) {
      if (bead.isBackground) continue;
      usage.set(bead.code, (usage.get(bead.code) || 0) + 1);
    }
    if (usage.size <= 2) return beads;

    const ranked = [...usage.entries()].sort((a, b) => b[1] - a[1]);
    let kept = ranked.filter(([, count]) => count >= threshold).map(([code]) => code);
    if (kept.length < 2) kept = ranked.slice(0, 2).map(([code]) => code);
    const keptSet = new Set(kept);
    if (kept.length === usage.size) return beads;

    const keptColors = [];
    const seen = new Set();
    for (const bead of beads) {
      if (bead.isBackground || !keptSet.has(bead.code) || seen.has(bead.code)) continue;
      seen.add(bead.code);
      keptColors.push(bead);
    }
    const match = makeMatcher(keptColors);
    return beads.map((bead) => {
      if (bead.isBackground || keptSet.has(bead.code)) return bead;
      return match(bead);
    });
  }

  // 抽样：用量最高的若干色 + 均匀取几个，覆盖 3~5 个关键色
  function sampleKeyColors(counts, limit) {
    if (counts.length <= limit) return counts;
    const picked = [counts[0]];
    const step = (counts.length - 1) / (limit - 1);
    for (let i = 1; i < limit; i += 1) {
      picked.push(counts[Math.round(i * step)]);
    }
    return picked;
  }

  // 导出前抽样校验：色号必须在色卡里，且符合该品牌瓶身编号格式
  function validateExportCodes(pattern) {
    const paletteKey = pattern.settings.palette;
    const shape = codeShapeFor(paletteKey);
    const paletteCodes = new Set(getPalette(paletteKey).map((color) => color.code));
    const samples = sampleKeyColors(pattern.counts, 5).map((item) => ({
      code: item.color.code,
      count: item.count,
      inPalette: paletteCodes.has(item.color.code),
      matchesShape: shape ? shape.test(item.color.code) : true,
    }));
    return {
      paletteKey,
      isMard: MARD_PALETTES.includes(paletteKey),
      samples,
      passed: samples.filter((item) => item.inPalette && item.matchesShape).length,
      total: samples.length,
    };
  }

  function formatCodeCheck(report) {
    const parts = report.samples.map((item) => `${item.code}${item.inPalette && item.matchesShape ? ' ✓' : ' ✗'}`);
    const brand = report.isMard ? 'MARD 瓶身编号格式' : `${paletteLabel(report.paletteKey)} 编号格式`;
    return `色号抽样校验：${parts.join('  ')}（${report.passed}/${report.total} 通过 · ${brand}）`;
  }

  function updateCodeCheck() {
    if (!state.pattern || !state.pattern.counts.length) {
      codeCheck.textContent = '色号抽样校验：生成图纸后显示。';
      codeCheck.classList.remove('code-check-fail');
      return;
    }
    const report = validateExportCodes(state.pattern);
    codeCheck.textContent = formatCodeCheck(report);
    codeCheck.classList.toggle('code-check-fail', report.passed !== report.total);
  }

  function updateMinColorCount() {
    const value = Number(minColorCount.value) || 0;
    minColorCountValue.textContent = value > 0 ? `≥ ${value} 颗` : '关闭';
  }

  // 用途预设：同时限制最大颜色数区间，并开启最少颜色阈值
  function applyColorPreset(key) {
    const preset = COLOR_PRESETS[key] || COLOR_PRESETS.custom;
    colorPreset.value = key;
    colorCount.min = String(preset.min);
    colorCount.max = String(preset.max);
    colorCount.value = String(clamp(preset.value, preset.min, preset.max));
    minColorCount.value = String(preset.minCount);
    updateColorCountValue();
    updateMinColorCount();
    syncColorPresetButtons();
  }

  function syncColorPresetButtons() {
    for (const button of colorPresetButtons.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', button.dataset.value === colorPreset.value ? 'true' : 'false');
    }
  }

  function updatePhysicalSize() {
    const spec = lockedSpec();
    const width = clamp(Number(beadWidth.value) || 29, 8, 180);
    const height = Math.max(8, Number(beadHeight.value) || 29);
    physicalSize.textContent = `实际成品：${formatMm(width * spec.diameterMm)} × ${formatMm(height * spec.diameterMm)} mm`
      + `（${width} × ${height} 格 × ${spec.diameterMm}mm，${spec.label}）`;
  }

  /* ------------------------------------------------------------------ *
   * 图片上传与构图
   * ------------------------------------------------------------------ */

  function handleImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    state.imageFile = file;
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = URL.createObjectURL(file);

    const image = new Image();
    image.onload = () => {
      state.image = image;
      state.trimCache = null;
      state.crop = { x: 0, y: 0, width: image.width, height: image.height };
      fileName.textContent = file.name;
      cropEmpty.hidden = true;
      cropCanvas.style.display = 'block';
      generateButton.disabled = false;
      updateBeadSizeFromCrop();
      drawCropPreview();
      setStatus(`已载入 ${image.width} x ${image.height}，拖拽框选构图区域后生成图纸。`);
    };
    image.onerror = () => setStatus('图片解析失败，请换一张 JPG / PNG / WEBP 图片。');
    image.src = state.imageUrl;
  }

  function syncSizeModeButtons() {
    for (const button of sizeModeButtons.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', button.dataset.value === state.sizeMode ? 'true' : 'false');
    }
    sizeModeHelp.textContent = state.sizeMode === 'ratio'
      ? '高度按构图区域比例自动适配。'
      : '宽高独立设置，按标准豆板规格出图。';
  }

  function updateSizePresetSelection() {
    const width = Number(beadWidth.value) || 29;
    const height = Number(beadHeight.value) || 29;
    for (const button of sizePresetGrid.querySelectorAll('button')) {
      const size = Number(button.dataset.size);
      const active = width === size && (state.sizeMode === 'ratio' || height === size);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function updateBeadSizeFromCrop() {
    let width = clamp(Math.round(Number(beadWidth.value) || 29), 8, 180);

    if (state.sizeMode === 'ratio') {
      // 按图片比例：宽度定，高度跟着构图区域比例走
      const crop = cropRect();
      const aspect = crop && crop.height > 0 ? crop.width / crop.height : 1;
      const height = clamp(Math.max(8, Math.round(width / (aspect || 1))), 8, 180);
      beadHeight.value = String(height);
    }

    width = clamp(width, 8, 180);
    const height = clamp(Math.round(Number(beadHeight.value) || 29), 8, 180);
    beadWidth.value = String(width);
    beadHeight.value = String(height);
    beadWidthInput.value = String(width);
    beadHeightInput.value = String(height);
    beadSizeValue.textContent = `${width} 颗宽 / ${height} 颗高`;
    updateSizePresetSelection();
    updatePhysicalSize();
  }

  function applySizePreset(size) {
    const value = clamp(size, 8, 180);
    beadWidth.value = String(value);
    beadWidthInput.value = String(value);
    if (state.sizeMode === 'board') {
      beadHeight.value = String(value);
      beadHeightInput.value = String(value);
    }
    updateBeadSizeFromCrop();
    setStatus(
      state.sizeMode === 'board'
        ? `图纸尺寸已设为 ${value} × ${value} 颗，重新生成生效。`
        : `图纸宽度已设为 ${value} 颗，高度自动适配，重新生成生效。`,
    );
  }

  // 自动裁剪空白边缘：在构图区域内找非白/非透明内容的包围盒，小图分析后映射回原图坐标
  function computeContentBox(image, rect) {
    const maxSide = 320;
    const scale = Math.min(1, maxSide / Math.max(rect.width, rect.height));
    const w = Math.max(1, Math.round(rect.width * scale));
    const h = Math.max(1, Math.round(rect.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const blank = data[i + 3] < 40
          || (data[i] >= 228 && data[i + 1] >= 228 && data[i + 2] >= 228);
        if (blank) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // 全空、几乎没有内容、或本来就没有空白边缘时，维持原构图
    if (maxX < 0 || maxY < 0) return null;
    const contentRatio = ((maxX - minX + 1) * (maxY - minY + 1)) / (w * h);
    if (contentRatio < 0.02) return null;
    if (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1) return null;

    const sx = rect.width / w;
    const sy = rect.height / h;
    const width = (maxX - minX + 1) * sx;
    const height = (maxY - minY + 1) * sy;
    if (width < 8 || height < 8) return null;
    return {
      x: rect.x + minX * sx,
      y: rect.y + minY * sy,
      width,
      height,
    };
  }

  function trimBlankRect(image, rect) {
    const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`;
    const cache = state.trimCache;
    if (cache && cache.key === key && cache.image === image) return cache.rect;
    const trimmed = computeContentBox(image, rect) || rect;
    state.trimCache = { key, image, rect: trimmed };
    return trimmed;
  }

  // 构图区域；开启「自动裁剪空白边缘」时再收一次内容包围盒
  function cropRect() {
    const image = state.image;
    if (!image) return { x: 0, y: 0, width: 1, height: 1 };
    const fallback = { x: 0, y: 0, width: image.width, height: image.height };
    const selection = state.crop || fallback;
    const width = clamp(selection.width, 2, image.width);
    const height = clamp(selection.height, 2, image.height);
    const rect = {
      x: clamp(selection.x, 0, image.width - width),
      y: clamp(selection.y, 0, image.height - height),
      width,
      height,
    };
    return autoTrim.checked ? trimBlankRect(image, rect) : rect;
  }

  function drawCropPreview() {
    const image = state.image;
    if (!image) return;

    const previewW = cropCanvas.width;
    const previewH = cropCanvas.height;
    const previewAspect = previewW / previewH;
    const imageAspect = image.width / image.height;
    let drawW = previewW;
    let drawH = previewH;
    let dx = 0;
    let dy = 0;

    if (imageAspect > previewAspect) {
      drawH = previewW / imageAspect;
      dy = (previewH - drawH) / 2;
    } else {
      drawW = previewH * imageAspect;
      dx = (previewW - drawW) / 2;
    }

    state.cropFrame = { x: dx, y: dy, width: drawW, height: drawH };
    cropCtx.clearRect(0, 0, previewW, previewH);
    cropCtx.fillStyle = '#eef0f2';
    cropCtx.fillRect(0, 0, previewW, previewH);
    cropCtx.imageSmoothingEnabled = true;
    cropCtx.imageSmoothingQuality = 'high';
    cropCtx.drawImage(image, 0, 0, image.width, image.height, dx, dy, drawW, drawH);
    drawCropOverlay();
    updateSourcePreview();
  }

  function drawCropOverlay() {
    if (!state.image || !state.crop) return;

    const frame = state.cropFrame;
    const sx = frame.width / state.image.width;
    const sy = frame.height / state.image.height;
    const rect = {
      x: frame.x + state.crop.x * sx,
      y: frame.y + state.crop.y * sy,
      width: state.crop.width * sx,
      height: state.crop.height * sy,
    };

    cropCtx.save();
    cropCtx.fillStyle = 'rgba(21, 33, 29, 0.42)';
    cropCtx.beginPath();
    cropCtx.rect(frame.x, frame.y, frame.width, frame.height);
    cropCtx.rect(rect.x, rect.y, rect.width, rect.height);
    cropCtx.fill('evenodd');

    cropCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    cropCtx.lineWidth = 4;
    cropCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    cropCtx.strokeStyle = 'rgba(111, 149, 134, 0.96)';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);

    // 自动裁剪生效后，用虚线标出真正参与生成的内容框
    if (autoTrim.checked) {
      const effective = cropRect();
      const differs = Math.abs(effective.x - state.crop.x) > 1
        || Math.abs(effective.y - state.crop.y) > 1
        || Math.abs(effective.width - state.crop.width) > 1
        || Math.abs(effective.height - state.crop.height) > 1;
      if (differs) {
        const inner = {
          x: frame.x + effective.x * sx,
          y: frame.y + effective.y * sy,
          width: effective.width * sx,
          height: effective.height * sy,
        };
        cropCtx.setLineDash([6, 4]);
        cropCtx.strokeStyle = 'rgba(245, 190, 70, 0.95)';
        cropCtx.lineWidth = 2;
        cropCtx.strokeRect(inner.x, inner.y, inner.width, inner.height);
        cropCtx.setLineDash([]);
      }
    }
    cropCtx.restore();
  }

  function updateSourcePreview() {
    const image = state.image;
    if (!image || !state.crop) return;
    const crop = cropRect();
    const maxSide = 900;
    const scale = Math.min(maxSide / Math.max(crop.width, crop.height), 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    sourcePreview.src = canvas.toDataURL('image/png');
    sourcePreview.style.display = 'block';
  }

  function cropPointerPoint(event) {
    const rect = cropCanvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (cropCanvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (cropCanvas.height / rect.height);
    const frame = state.cropFrame;
    const image = state.image;
    return {
      x: clamp(((canvasX - frame.x) / frame.width) * image.width, 0, image.width),
      y: clamp(((canvasY - frame.y) / frame.height) * image.height, 0, image.height),
    };
  }

  function startCropDrag(event) {
    if (!state.image) return;
    cropCanvas.setPointerCapture(event.pointerId);
    const point = cropPointerPoint(event);
    state.cropDrag = { pointerId: event.pointerId, start: point };
    state.crop = { x: point.x, y: point.y, width: 1, height: 1 };
    updateBeadSizeFromCrop();
    drawCropPreview();
  }

  function updateCropDrag(event) {
    const drag = state.cropDrag;
    if (!state.image || !drag || drag.pointerId !== event.pointerId) return;

    const point = cropPointerPoint(event);
    const x = Math.min(drag.start.x, point.x);
    const y = Math.min(drag.start.y, point.y);
    state.crop = {
      x: clamp(x, 0, state.image.width - 1),
      y: clamp(y, 0, state.image.height - 1),
      width: clamp(Math.abs(point.x - drag.start.x), 1, state.image.width - x),
      height: clamp(Math.abs(point.y - drag.start.y), 1, state.image.height - y),
    };
    updateBeadSizeFromCrop();
    drawCropPreview();
  }

  function finishCropDrag(event) {
    const drag = state.cropDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (state.crop && (state.crop.width < 8 || state.crop.height < 8)) {
      state.crop = { x: 0, y: 0, width: state.image.width, height: state.image.height };
    }
    state.cropDrag = null;
    updateBeadSizeFromCrop();
    drawCropPreview();
  }

  /* ------------------------------------------------------------------ *
   * 像素处理
   * ------------------------------------------------------------------ */

  // 单个像素的风格换算（吸管取色要与生成时用同一套换算，色号才对得上）
  function styleRgb(rgb, preset) {
    const gray = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
    const sat = (v) => gray + (v - gray) * preset.saturation;
    const con = (v) => (v - 128) * preset.contrast + 128 + preset.brightness;
    return {
      r: clamp(Math.round(con(sat(rgb.r))), 0, 255),
      g: clamp(Math.round(con(sat(rgb.g))), 0, 255),
      b: clamp(Math.round(con(sat(rgb.b))), 0, 255),
    };
  }

  function applyStyle(imageData, preset) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      // 透明部分压在纸色上；alpha 保留，用于识别透明背景
      const styled = styleRgb(
        {
          r: data[i] * alpha + 247 * (1 - alpha),
          g: data[i + 1] * alpha + 245 * (1 - alpha),
          b: data[i + 2] * alpha + 239 * (1 - alpha),
        },
        preset,
      );
      data[i] = styled.r;
      data[i + 1] = styled.g;
      data[i + 2] = styled.b;
    }
  }

  function sharpen(imageData, amount) {
    const src = imageData.data;
    const out = new Uint8ClampedArray(src);
    const width = imageData.width;
    const height = imageData.height;
    const center = 1 + 4 * amount;
    const side = -amount;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c += 1) {
          out[i + c] = clamp(
            src[i + c] * center +
              src[i + c - 4] * side +
              src[i + c + 4] * side +
              src[i + c - width * 4] * side +
              src[i + c + width * 4] * side,
            0,
            255,
          );
        }
      }
    }
    return new ImageData(out, width, height);
  }

  // 去除简单背景：从四边采样估计单一背景色，只把与边缘连通的背景像素挖成透明（保留主体内部同色区域）
  function removeSimpleBackground(imageData, width, height) {
    const data = imageData.data;
    const total = width * height;
    const step = Math.max(1, Math.floor(Math.min(width, height) / 60));
    const inset = Math.max(1, Math.min(2, Math.floor(Math.min(width, height) / 20)));
    const samples = [];
    const sample = (x, y) => {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 40) return;
      samples.push([data[i], data[i + 1], data[i + 2]]);
    };
    for (let x = inset; x < width - inset; x += step) {
      sample(x, inset);
      sample(x, height - 1 - inset);
    }
    for (let y = inset; y < height - inset; y += step) {
      sample(inset, y);
      sample(width - 1 - inset, y);
    }
    if (samples.length < 8) return imageData;

    const median = (channel) => {
      const values = samples.map((item) => item[channel]).sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    };
    const bg = { r: median(0), g: median(1), b: median(2) };

    // 四边颜色起伏太大说明不是「简单背景」，宁可不抠
    let variance = 0;
    for (const item of samples) {
      const dr = item[0] - bg.r;
      const dg = item[1] - bg.g;
      const db = item[2] - bg.b;
      variance += dr * dr + dg * dg + db * db;
    }
    const deviation = Math.sqrt(variance / samples.length);
    if (deviation > 42) return imageData;

    const limit = Math.max(34, Math.min(90, deviation * 2.5));
    const limitSq = limit * limit;
    const isBackground = (index) => {
      const i = index * 4;
      if (data[i + 3] < 40) return true;
      const dr = data[i] - bg.r;
      const dg = data[i + 1] - bg.g;
      const db = data[i + 2] - bg.b;
      return dr * dr + dg * dg + db * db <= limitSq;
    };

    const visited = new Uint8Array(total);
    const alphaBefore = new Uint8ClampedArray(total);
    for (let i = 0; i < total; i += 1) alphaBefore[i] = data[i * 4 + 3];
    const stack = [];
    const seed = (index) => {
      if (!visited[index] && isBackground(index)) {
        visited[index] = 1;
        stack.push(index);
      }
    };
    for (let x = 0; x < width; x += 1) {
      seed(x);
      seed((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      seed(y * width);
      seed(y * width + width - 1);
    }

    let removed = 0;
    while (stack.length) {
      const index = stack.pop();
      data[index * 4 + 3] = 0;
      removed += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x > 0) seed(index - 1);
      if (x < width - 1) seed(index + 1);
      if (y > 0) seed(index - width);
      if (y < height - 1) seed(index + width);
    }

    // 几乎整张都被抠掉，说明背景色和主体撞色了，退回不抠
    if (removed / total > 0.97) {
      for (let i = 0; i < total; i += 1) data[i * 4 + 3] = alphaBefore[i];
    }
    return imageData;
  }

  // 把构图区域缩放到 图纸宽高 x quality，再按块取平均，得到每颗豆子的颜色
  function buildBeadPixels(width, height, preset) {
    const quality = 8;
    const canvas = document.createElement('canvas');
    canvas.width = width * quality;
    canvas.height = height * quality;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const crop = cropRect();

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (removeBg.checked) removeSimpleBackground(imageData, canvas.width, canvas.height);
    applyStyle(imageData, preset);
    if (preset.flatten) {
      flattenColors(imageData, canvas.width, canvas.height, preset.flatten.radius, preset.flatten.threshold);
    }
    ctx.putImageData(imageData, 0, 0);

    if (preset.sharpen > 0) {
      imageData = sharpen(imageData, preset.sharpen);
      ctx.putImageData(imageData, 0, 0);
    }

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        let weight = 0;
        let solid = 0;

        for (let yy = 0; yy < quality; yy += 1) {
          for (let xx = 0; xx < quality; xx += 1) {
            const i = ((y * quality + yy) * canvas.width + x * quality + xx) * 4;
            const alpha = data[i + 3] / 255;
            if (alpha < 0.4) continue;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            weight += 1;
            if (alpha > 0.9) solid += 1;
          }
        }

        if (weight === 0 || solid < quality * quality * 0.3) {
          pixels.push({ r: 255, g: 255, b: 255, isBackground: true });
          continue;
        }

        pixels.push({
          r: Math.round(r / weight),
          g: Math.round(g / weight),
          b: Math.round(b / weight),
        });
      }
    }

    return pixels;
  }

  // 保边磨皮：邻域内色差小于阈值的像素取平均，色块变平但边界不糊
  // 用于「卡通 / 平滑」处理模式
  function flattenColors(imageData, width, height, radius, threshold) {
    const src = new Uint8ClampedArray(imageData.data);
    const out = imageData.data;
    const limit = threshold * threshold;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (src[i + 3] < 40) continue;
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(width - 1, x + radius);
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let n = 0;
        for (let yy = y0; yy <= y1; yy += 1) {
          for (let xx = x0; xx <= x1; xx += 1) {
            const j = (yy * width + xx) * 4;
            if (src[j + 3] < 40) continue;
            const dr = src[j] - r;
            const dg = src[j + 1] - g;
            const db = src[j + 2] - b;
            if (dr * dr + dg * dg + db * db > limit) continue;
            sr += src[j];
            sg += src[j + 1];
            sb += src[j + 2];
            n += 1;
          }
        }
        if (n > 1) {
          out[i] = sr / n;
          out[i + 1] = sg / n;
          out[i + 2] = sb / n;
        }
      }
    }
    return imageData;
  }

  /* ------------------------------------------------------------------ *
   * 选色 / 量化
   * ------------------------------------------------------------------ */

  // 以 5bit/通道 做缓存，避免逐像素重复遍历色卡
  function makeMatcher(colors) {
    const cache = new Map();
    return (pixel) => {
      const key = ((pixel.r >> 3) << 10) | ((pixel.g >> 3) << 5) | (pixel.b >> 3);
      const hit = cache.get(key);
      if (hit !== undefined) return colors[hit];
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < colors.length; i += 1) {
        const d = colorDistance(pixel, colors[i].rgb);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      }
      cache.set(key, best);
      return colors[best];
    };
  }

  // 统计各色卡色的使用量，取用量最高的 N 色
  function choosePaletteColors(pixels, palette, maxColors) {
    const foreground = pixels.filter((p) => !p.isBackground);
    const source = foreground.length ? foreground : pixels;
    const match = makeMatcher(palette);
    const usage = new Map();

    for (const pixel of source) {
      const color = match(pixel);
      const entry = usage.get(color.code) || { color, count: 0, error: 0 };
      entry.count += 1;
      entry.error += Math.sqrt(colorDistance(pixel, color.rgb));
      usage.set(color.code, entry);
    }

    const ranked = [...usage.values()]
      .map((entry) => ({ ...entry, score: entry.count * 1000 + entry.error }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(maxColors, palette.length))
      .map((entry) => entry.color);

    return ranked.length ? ranked : palette.slice(0, Math.min(maxColors, palette.length));
  }

  // 中位切分：用于「保持原图色彩」，直接从画面取色
  function medianCutColors(pixels, maxColors) {
    const source = pixels.filter((p) => !p.isBackground);
    if (!source.length) return [];

    const boxOf = (list) => {
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const p of list) {
        if (p.r < rMin) rMin = p.r;
        if (p.r > rMax) rMax = p.r;
        if (p.g < gMin) gMin = p.g;
        if (p.g > gMax) gMax = p.g;
        if (p.b < bMin) bMin = p.b;
        if (p.b > bMax) bMax = p.b;
      }
      return { list, rMin, rMax, gMin, gMax, bMin, bMax };
    };

    let boxes = [boxOf(source)];
    while (boxes.length < maxColors) {
      let target = -1;
      let targetScore = 0;
      boxes.forEach((box, index) => {
        if (box.list.length < 2) return;
        const volume = (box.rMax - box.rMin + 1) * (box.gMax - box.gMin + 1) * (box.bMax - box.bMin + 1);
        const score = volume * Math.log2(box.list.length + 1);
        if (score > targetScore) {
          targetScore = score;
          target = index;
        }
      });
      if (target < 0) break;

      const box = boxes[target];
      const spans = [
        { axis: 'r', span: box.rMax - box.rMin },
        { axis: 'g', span: box.gMax - box.gMin },
        { axis: 'b', span: box.bMax - box.bMin },
      ].sort((a, b) => b.span - a.span);
      const axis = spans[0].axis;
      const sorted = [...box.list].sort((a, b) => a[axis] - b[axis]);
      const mid = Math.floor(sorted.length / 2);
      boxes.splice(target, 1, boxOf(sorted.slice(0, mid)), boxOf(sorted.slice(mid)));
    }

    return boxes
      .filter((box) => box.list.length)
      .map((box) => {
        const sum = box.list.reduce((acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }), { r: 0, g: 0, b: 0 });
        const n = box.list.length;
        return { r: Math.round(sum.r / n), g: Math.round(sum.g / n), b: Math.round(sum.b / n) };
      });
  }

  // 把画面取到的颜色吸附到色卡上，保证色号真实可用
  function snapToPalette(colors, palette) {
    const used = new Set();
    return colors.map((rgb) => {
      let best = null;
      let bestDistance = Infinity;
      for (const color of palette) {
        if (used.has(color.code)) continue;
        const d = colorDistance(rgb, color.rgb);
        if (d < bestDistance) {
          bestDistance = d;
          best = color;
        }
      }
      if (!best) {
        const match = makeMatcher(palette)(rgb);
        best = { ...match, code: `${match.code}+`, rgb: match.rgb };
      }
      used.add(best.code);
      return best;
    });
  }

  // 合并过于接近的颜色，优先保留用量高的
  function compactColors(colors, pixels, threshold) {
    if (colors.length < 2) return colors;
    const source = pixels.filter((p) => !p.isBackground);
    const sample = source.length ? source : pixels;
    const match = makeMatcher(colors);
    const usage = new Map(colors.map((color) => [color.code, 0]));
    for (const pixel of sample) {
      const color = match(pixel);
      usage.set(color.code, (usage.get(color.code) || 0) + 1);
    }

    const sorted = [...colors].sort((a, b) => (usage.get(b.code) || 0) - (usage.get(a.code) || 0));
    const kept = [];
    for (const color of sorted) {
      const tooClose = kept.some((other) => Math.sqrt(colorDistance(color.rgb, other.rgb)) < threshold);
      if (!tooClose) kept.push(color);
    }
    return kept.length ? kept : colors;
  }

  // 3x3 多数投票，去掉孤立噪点
  function smoothBeads(beads, width, height, iterations) {
    let current = beads;
    for (let pass = 0; pass < iterations; pass += 1) {
      const next = [...current];
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          const original = current[index];
          if (original.isBackground) continue;

          const votes = new Map();
          for (let yy = -1; yy <= 1; yy += 1) {
            for (let xx = -1; xx <= 1; xx += 1) {
              const neighbor = current[(y + yy) * width + x + xx];
              if (!neighbor || neighbor.isBackground) continue;
              const vote = votes.get(neighbor.code) || { color: neighbor, count: 0 };
              vote.count += xx === 0 && yy === 0 ? 1 : 2;
              votes.set(neighbor.code, vote);
            }
          }

          const winner = [...votes.values()].sort((a, b) => b.count - a.count)[0];
          if (
            winner &&
            winner.color.code !== original.code &&
            winner.count >= 9 &&
            Math.sqrt(colorDistance(winner.color.rgb, original.rgb)) < 95
          ) {
            next[index] = winner.color;
          }
        }
      }
      current = next;
    }
    return current;
  }

  function countColors(beads) {
    const map = new Map();
    for (const color of beads) {
      if (color.isBackground) continue;
      const entry = map.get(color.code) || { color, count: 0 };
      entry.count += 1;
      map.set(color.code, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  // 色卡 + 手动禁用色号（不含套装过滤）
  function activePaletteBase() {
    const palette = getPalette(paletteMode.value);
    const excluded = parseExcluded();
    if (!excluded.size) return palette;
    const filtered = palette.filter((color) => !excluded.has(color.code.toUpperCase()));
    return filtered.length >= 2 ? filtered : palette;
  }

  // 生成实际可用的颜色池：色卡 → 手动禁用 → 自有套装
  function activePalette() {
    return applyBeadSet(activePaletteBase());
  }

  function parseExcluded() {
    return new Set(
      excludedColors.value
        .split(/[\s,，、;；|]+/)
        .map((token) => token.trim().toUpperCase())
        .filter(Boolean),
    );
  }

  /* ------------------------------------------------------------------ *
   * 生成
   * ------------------------------------------------------------------ */

  function generatePattern() {
    if (!state.image) {
      setStatus('请先上传一张图片。');
      return;
    }

    generateButton.disabled = true;
    setStatus('正在生成图纸…');

    // 让浏览器先把状态文字画出来，再做重计算
    window.requestAnimationFrame(() => {
      try {
        const started = performance.now();
        const width = clamp(Number(beadWidth.value) || 29, 8, 180);
        const height = Math.max(8, Number(beadHeight.value) || 29);
        const preset = STYLE_PRESETS[styleMode.value] || STYLE_PRESETS.cartoon;
        const maxColors = clamp(Number(colorCount.value) || 40, 2, 90);
        const palette = activePalette();

        const pixels = buildBeadPixels(width, height, preset);

        let chosen;
        if (preserveColor.checked) {
          // 从画面取色，再吸附到色卡上，取色数不超过色卡本身
          chosen = snapToPalette(medianCutColors(pixels, Math.min(maxColors, palette.length)), palette);
        } else {
          chosen = choosePaletteColors(pixels, palette, maxColors);
        }
        chosen = compactColors(chosen, pixels, preserveColor.checked ? 10 : 14);

        const match = makeMatcher(chosen);
        let beads = pixels.map((pixel) => (pixel.isBackground ? backgroundBead() : match(pixel)));

        if (preset.smooth > 0) beads = smoothBeads(beads, width, height, preset.smooth);
        if (isolatedCleanup.checked) beads = mergeIsolatedBeads(beads, width, height, 2);
        beads = pruneRareColors(beads, Number(minColorCount.value) || 0);

        state.pattern = {
          width,
          height,
          beads,
          colors: uniqueColors(beads),
          counts: countColors(beads),
          settings: {
            width,
            height,
            sizeMode: state.sizeMode,
            style: styleMode.value,
            palette: paletteMode.value,
            excluded: excludedColors.value,
            colorCount: maxColors,
            preserveColor: preserveColor.checked,
            spec: lockedSpec().id,
            tileBoards: tileBoards.checked,
            beadSet: beadSet.value,
            colorPreset: colorPreset.value,
            minColorCount: Number(minColorCount.value) || 0,
            isolatedCleanup: isolatedCleanup.checked,
            autoTrim: autoTrim.checked,
            removeBg: removeBg.checked,
            mirrorPages: mirrorPages.checked,
            notes: notesText.value,
          },
        };

        state.mirrored = false;
        state.undoStack = [];
        state.paintCode = state.pattern.counts.length ? state.pattern.counts[0].color.code : '';
        resetTool();
        setView('pattern');

        emptyState.hidden = true;
        patternCanvas.style.display = 'block';
        view.zoom = 1;
        view.fitCell = 0;

        renderPaintOptions();
        renderPaintPaletteOptions();
        renderReplaceSuggestions();
        resetReplaceControls();
        updateMirrorButton();
        updatePatternMeta();
        updateSourcePreview();
        updateCodeCheck();
        drawPattern();

        const ms = Math.round(performance.now() - started);
        setStatus(`生成完成：${width} x ${height}，${state.pattern.counts.length} 色，用时 ${ms} ms。`);
      } catch (error) {
        console.error(error);
        setStatus(`生成失败：${error.message}`);
      } finally {
        generateButton.disabled = false;
        updateExportButtons();
      }
    });
  }

  function backgroundBead() {
    return { code: 'BG', name: '空位', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, isBackground: true };
  }

  function uniqueColors(beads) {
    const map = new Map();
    for (const color of beads) {
      if (color.isBackground) continue;
      if (!map.has(color.code)) map.set(color.code, color);
    }
    return [...map.values()];
  }

  /* ------------------------------------------------------------------ *
   * 图纸绘制
   * ------------------------------------------------------------------ */

  function sheetMetrics(pattern, cellSize, theme) {
    const boardWidth = pattern.width * cellSize;
    const boardHeight = pattern.height * cellSize;
    const boardX = theme.padding + theme.coord;
    const boardY = theme.padding + theme.header + theme.coord;
    const sheetWidth = boardWidth + theme.coord + theme.padding * 2;
    const columns = Math.max(1, Math.min(5, Math.floor((boardWidth + theme.coord) / 210)));
    const rows = Math.max(1, Math.ceil(pattern.counts.length / columns));
    const legendHeight = theme.legendHeader + rows * theme.legendRow + 20;
    const legendY = boardY + boardHeight + 16;
    const sheetHeight = legendY + legendHeight + theme.padding;
    return { cellSize, boardWidth, boardHeight, boardX, boardY, sheetWidth, sheetHeight, columns, rows, legendY, legendHeight, theme };
  }

  function sheetBackground(ctx, metrics) {
    const gradient = ctx.createLinearGradient(0, 0, metrics.sheetWidth, metrics.sheetHeight);
    gradient.addColorStop(0, '#f7faf8');
    gradient.addColorStop(0.45, '#e5e9f2');
    gradient.addColorStop(1, '#d7e8d5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, metrics.sheetWidth, metrics.sheetHeight);
  }

  function visible(x, y, w, h, box) {
    return x < box.right && x + w > box.left && y < box.bottom && y + h > box.top;
  }

  function drawSheet(ctx, pattern, metrics, box, options = {}) {
    const { theme } = metrics;
    sheetBackground(ctx, metrics);

    if (visible(0, 0, metrics.sheetWidth, theme.header, box)) drawHeader(ctx, pattern, metrics);
    drawCells(ctx, pattern, metrics, box, options);
    drawCoordinates(ctx, pattern, metrics, box);
    drawGrid(ctx, pattern, metrics, box);
    if (visible(0, metrics.legendY, metrics.sheetWidth, metrics.legendHeight, box)) {
      drawLegend(ctx, pattern, metrics);
    }
  }

  function drawHeader(ctx, pattern, metrics) {
    const { theme, sheetWidth } = metrics;
    const gradient = ctx.createLinearGradient(0, 0, sheetWidth, 0);
    gradient.addColorStop(0, '#dce9df');
    gradient.addColorStop(0.52, '#c5d9ca');
    gradient.addColorStop(1, '#91ad9f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, sheetWidth, theme.header);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, theme.header - 0.5);
    ctx.lineTo(sheetWidth, theme.header - 0.5);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#315448';
    ctx.font = `800 ${theme.headerTitle}px Arial`;
    ctx.fillText('拼豆图纸', theme.padding, theme.header * 0.47);
    ctx.fillStyle = 'rgba(49, 84, 72, 0.82)';
    ctx.font = `700 ${theme.headerSub}px Arial`;
    const board = pattern.board;
    ctx.fillText(
      board
        ? `第 ${board.index}/${board.total} 板 · 行 ${board.rowStart}-${board.rowEnd} / 列 ${board.colStart}-${board.colEnd} · ${pattern.width} x ${pattern.height} 格 / ${pattern.counts.length} 色`
        : `${pattern.width} x ${pattern.height} 格 / ${pattern.counts.length} 色`,
      theme.padding,
      theme.header * 0.8,
    );

    const spec = lockedSpec();
    const size = physicalSizeMm(pattern, spec);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${theme.headerBrand}px Arial`;
    ctx.fillText(paletteLabel(pattern.settings.palette), sheetWidth - theme.padding, theme.header * 0.47);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.font = `700 ${theme.headerBrandSub}px Arial`;
    ctx.fillText(
      `${formatMm(size.width)} x ${formatMm(size.height)} mm · ${spec.diameterMm}mm · 按 100% 打印`,
      sheetWidth - theme.padding,
      theme.header * 0.8,
    );
  }

  function drawCells(ctx, pattern, metrics, box, options = {}) {
    const { theme, cellSize, boardX, boardY } = metrics;
    const highlight = options.highlight;
    const startX = Math.max(0, Math.floor((box.left - boardX) / cellSize));
    const endX = Math.min(pattern.width, Math.ceil((box.right - boardX) / cellSize));
    const startY = Math.max(0, Math.floor((box.top - boardY) / cellSize));
    const endY = Math.min(pattern.height, Math.ceil((box.bottom - boardY) / cellSize));

    // 按图纸里最长的色号缩字号，保证每个格子里都放得下
    const maxFont = Math.max(theme.minCodeFont, Math.floor(cellSize * theme.codeFont));
    let font = maxFont;
    let sample = '';
    for (const item of pattern.counts) {
      const short = shortCode(item.color.code);
      if (short.length > sample.length) sample = short;
    }
    if (sample) {
      ctx.font = '700 100px Arial';
      const widthAt100 = ctx.measureText(sample).width || 1;
      font = Math.min(maxFont, Math.floor((cellSize * 0.94 * 100) / widthAt100));
    }
    const showCodes = cellSize >= 9 && font >= 5;

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const index = patternIndex(pattern, x, y);
        const color = pattern.beads[index];
        const px = boardX + x * cellSize;
        const py = boardY + y * cellSize;

        ctx.fillStyle = color.hex;
        ctx.fillRect(px, py, cellSize, cellSize);

        if (highlight && highlight.has(index)) {
          // 替换前预览：将要变动的格子加一圈描边
          const inset = Math.min(2, Math.max(1, cellSize * 0.12));
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.lineWidth = inset * 2;
          ctx.strokeRect(px + inset, py + inset, cellSize - inset * 2, cellSize - inset * 2);
          ctx.strokeStyle = '#c2453f';
          ctx.lineWidth = inset;
          ctx.strokeRect(px + inset * 1.5, py + inset * 1.5, cellSize - inset * 3, cellSize - inset * 3);
        }
      }
    }

    if (!showCodes) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${font}px Arial`;

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const color = pattern.beads[patternIndex(pattern, x, y)];
        if (color.isBackground) continue;
        ctx.fillStyle = contrastColor(color.rgb);
        ctx.fillText(shortCode(color.code), boardX + x * cellSize + cellSize / 2, boardY + y * cellSize + cellSize / 2);
      }
    }
  }

  function drawCoordinates(ctx, pattern, metrics, box) {
    const { theme, cellSize, boardX, boardY, boardWidth, boardHeight } = metrics;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';

    const topVisible = visible(boardX, boardY - theme.coord, boardWidth, theme.coord, box);
    const leftVisible = visible(boardX - theme.coord, boardY, theme.coord, boardHeight, box);
    if (topVisible) ctx.fillRect(boardX, boardY - theme.coord, boardWidth, theme.coord);
    if (leftVisible) ctx.fillRect(boardX - theme.coord, boardY, theme.coord, boardHeight);

    ctx.fillStyle = '#5f776e';
    ctx.font = `700 ${Math.max(theme.minCoordFont, Math.floor(cellSize * theme.coordFont))}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (topVisible) {
      for (let x = 0; x < pattern.width; x += 1) {
        if (x === 0 || (x + 1) % 10 === 0 || x === pattern.width - 1) {
          ctx.fillText(String(x + 1), boardX + x * cellSize + cellSize / 2, boardY - theme.coord / 2);
        }
      }
    }
    if (leftVisible) {
      for (let y = 0; y < pattern.height; y += 1) {
        if (y === 0 || (y + 1) % 10 === 0 || y === pattern.height - 1) {
          ctx.fillText(String(y + 1), boardX - theme.coord / 2, boardY + y * cellSize + cellSize / 2);
        }
      }
    }
  }

  function drawGrid(ctx, pattern, metrics, box) {
    const { cellSize, boardX, boardY, boardWidth, boardHeight } = metrics;
    const startX = Math.max(0, Math.floor((box.left - boardX) / cellSize));
    const endX = Math.min(pattern.width, Math.ceil((box.right - boardX) / cellSize));
    const startY = Math.max(0, Math.floor((box.top - boardY) / cellSize));
    const endY = Math.min(pattern.height, Math.ceil((box.bottom - boardY) / cellSize));
    const line = (index) => (index % 10 === 0
      ? { style: 'rgba(74, 105, 94, 0.72)', width: 2 }
      : index % 5 === 0
        ? { style: 'rgba(74, 105, 94, 0.38)', width: 1 }
        : { style: 'rgba(74, 105, 94, 0.16)', width: 1 });

    ctx.beginPath();
    for (let x = startX; x <= endX; x += 1) {
      const px = boardX + x * cellSize + 0.5;
      const spec = line(x);
      ctx.strokeStyle = spec.style;
      ctx.lineWidth = spec.width;
      ctx.beginPath();
      ctx.moveTo(px, boardY + startY * cellSize);
      ctx.lineTo(px, boardY + endY * cellSize);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += 1) {
      const py = boardY + y * cellSize + 0.5;
      const spec = line(y);
      ctx.strokeStyle = spec.style;
      ctx.lineWidth = spec.width;
      ctx.beginPath();
      ctx.moveTo(boardX + startX * cellSize, py);
      ctx.lineTo(boardX + endX * cellSize, py);
      ctx.stroke();
    }

    ctx.strokeStyle = '#5f776e';
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX + 0.5, boardY + 0.5, boardWidth, boardHeight);
  }

  function drawLegend(ctx, pattern, metrics, options = {}) {
    const { theme, legendY, sheetWidth, columns } = metrics;
    const counts = pattern.counts;
    const total = counts.reduce((sum, item) => sum + item.count, 0);
    const width = sheetWidth - theme.padding * 2;
    const columnWidth = width / columns;
    const paletteKey = pattern.settings.palette;

    const gradient = ctx.createLinearGradient(0, legendY, sheetWidth, legendY);
    gradient.addColorStop(0, 'rgba(229, 233, 242, 0.96)');
    gradient.addColorStop(0.5, 'rgba(215, 232, 213, 0.96)');
    gradient.addColorStop(1, 'rgba(150, 179, 162, 0.96)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, legendY, sheetWidth, theme.legendHeader);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, legendY + 0.5);
    ctx.lineTo(sheetWidth, legendY + 0.5);
    ctx.moveTo(0, legendY + theme.legendHeader - 0.5);
    ctx.lineTo(sheetWidth, legendY + theme.legendHeader - 0.5);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${theme.legendTitle}px Arial`;
    ctx.fillText(options.title || '用料清单', theme.padding, legendY + theme.legendHeader / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.font = `700 ${theme.legendTotal}px Arial`;
    ctx.fillText(
      options.subtitle || `共 ${counts.length} 色 / 总计 ${total.toLocaleString()} 颗`,
      sheetWidth - theme.padding,
      legendY + theme.legendHeader / 2,
    );

    counts.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const itemX = theme.padding + col * columnWidth;
      const itemY = legendY + theme.legendHeader + 10 + row * theme.legendRow;
      const swatch = theme.swatch;
      const contentX = itemX + swatch + 12;
      const countText = `${item.count.toLocaleString()} 颗`;
      ctx.font = `800 ${theme.legendCount}px Arial`;
      const countWidth = ctx.measureText(countText).width + 14;
      const codeMaxWidth = Math.max(swatch, columnWidth - swatch - 24 - countWidth);

      ctx.fillStyle = item.color.hex;
      ctx.fillRect(itemX, itemY + (theme.legendRow - swatch) / 2 - 6, swatch, swatch);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(itemX + 0.5, itemY + (theme.legendRow - swatch) / 2 - 5.5, swatch, swatch);

      ctx.fillStyle = '#24302d';
      ctx.font = `800 ${theme.legendCode}px Arial`;
      ctx.textAlign = 'left';
      const mark = colorMark(item.color.code, paletteKey);
      fitText(ctx, mark ? `${item.color.code} ${mark}` : item.color.code, contentX, itemY + theme.legendRow / 2 - 7, codeMaxWidth);

      ctx.fillStyle = '#63756f';
      ctx.font = `700 ${theme.legendName}px Arial`;
      fitText(ctx, item.color.name, contentX, itemY + theme.legendRow / 2 + 9, codeMaxWidth);

      ctx.fillStyle = '#3f5e53';
      ctx.font = `800 ${theme.legendCount}px Arial`;
      ctx.textAlign = 'right';
      ctx.fillText(countText, itemX + columnWidth - 8, itemY + theme.legendRow / 2);
    });
  }

  function fitText(ctx, text, x, y, maxWidth) {
    const value = String(text == null ? '' : text);
    if (ctx.measureText(value).width <= maxWidth) {
      ctx.fillText(value, x, y);
      return;
    }
    let clipped = value;
    while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
      clipped = clipped.slice(0, -1);
    }
    ctx.fillText(`${clipped}…`, x, y);
  }

  // 格子里空间有限，长色号取有辨识度的部分；图例始终显示完整色号
  function shortCode(code) {
    const perler = /^\d{2}-(\d{5})$/.exec(code);
    if (perler) return perler[1].slice(1);
    return code;
  }

  function scheduleDraw(interactive = false) {
    if (!state.pattern) return;
    if (view.frame) {
      view.pendingInteractive = view.pendingInteractive && interactive;
      return;
    }
    view.pendingInteractive = interactive;
    view.frame = window.requestAnimationFrame(() => {
      const useInteractive = view.pendingInteractive;
      view.frame = 0;
      view.pendingInteractive = false;
      drawPattern(useInteractive);
    });
  }

  function drawPattern(interactive = false) {
    const pattern = state.pattern;
    if (!pattern) return;

    const width = Math.max(1, canvasStage.clientWidth);
    const height = Math.max(1, canvasStage.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.round(width * ratio);
    const targetHeight = Math.round(height * ratio);
    if (patternCanvas.width !== targetWidth || patternCanvas.height !== targetHeight) {
      patternCanvas.width = targetWidth;
      patternCanvas.height = targetHeight;
    }

    patternCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    patternCtx.clearRect(0, 0, width, height);
    patternCtx.fillStyle = '#f7faf8';
    patternCtx.fillRect(0, 0, width, height);

    // 效果图 / 原图是只读视图，不参与格子编辑和缩放
    if (state.view === 'render') {
      view.fitCell = 0;
      drawRenderView(pattern, width, height);
      zoomFitButton.disabled = true;
      return;
    }
    if (state.view === 'source') {
      view.fitCell = 0;
      drawSourceView(width, height);
      zoomFitButton.disabled = true;
      return;
    }

    const baseCell = Math.max(7, Math.min(18, Math.floor(1420 / pattern.width)));
    const metrics = sheetMetrics(pattern, baseCell, SCREEN_THEME);
    const fitScale = Math.min(1, (width - 16) / metrics.sheetWidth, (height - 16) / metrics.sheetHeight);
    const fitCell = baseCell * fitScale;

    if (view.fitCell && view.fitCell !== fitCell && view.zoom > 1) {
      // 保持缩放中心稳定
      const cx = (view.width / 2 - view.offsetX) / (view.fitCell * view.zoom);
      const cy = (view.height / 2 - view.offsetY) / (view.fitCell * view.zoom);
      view.offsetX = width / 2 - cx * fitCell * view.zoom;
      view.offsetY = height / 2 - cy * fitCell * view.zoom;
    }

    view.fitCell = fitCell;
    view.baseCell = baseCell;
    view.boardX = metrics.boardX;
    view.boardY = metrics.boardY;
    view.sheetWidth = metrics.sheetWidth;
    view.sheetHeight = metrics.sheetHeight;
    view.width = width;
    view.height = height;
    clampOffset();

    const scale = fitScale * view.zoom;
    const left = view.offsetX;
    const top = view.offsetY;
    const box = {
      left: -left / scale,
      top: -top / scale,
      right: (width - left) / scale,
      bottom: (height - top) / scale,
    };

    patternCtx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * left, ratio * top);
    drawSheet(patternCtx, pattern, metrics, box, { highlight: state.replaceHighlight });
    patternCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

    zoomFitButton.disabled = view.zoom <= 1.001;
  }

  // 效果图：只画豆子色块，不画网格/色号，模拟拼完后的样子
  function drawRenderView(pattern, width, height) {
    const pad = 16;
    const cell = Math.max(1, Math.min((width - pad * 2) / pattern.width, (height - pad * 2) / pattern.height));
    const boardWidth = cell * pattern.width;
    const boardHeight = cell * pattern.height;
    const ox = (width - boardWidth) / 2;
    const oy = (height - boardHeight) / 2;

    patternCtx.fillStyle = '#ffffff';
    patternCtx.fillRect(ox, oy, boardWidth, boardHeight);
    for (let y = 0; y < pattern.height; y += 1) {
      for (let x = 0; x < pattern.width; x += 1) {
        const color = pattern.beads[patternIndex(pattern, x, y)];
        if (color.isBackground) continue;
        patternCtx.fillStyle = color.hex;
        // +0.5 避免相邻色块之间出现白缝
        patternCtx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5);
      }
    }
  }

  // 原图：显示当前构图区域
  function drawSourceView(width, height) {
    const image = state.image;
    if (!image) return;
    const crop = cropRect();
    const scale = Math.min(width / crop.width, height / crop.height);
    const drawWidth = crop.width * scale;
    const drawHeight = crop.height * scale;
    patternCtx.imageSmoothingEnabled = true;
    patternCtx.imageSmoothingQuality = 'high';
    patternCtx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  }

  function setView(viewName, force) {
    if (!force && state.view === viewName) return;
    state.view = viewName;
    for (const button of resultTabs.querySelectorAll('button[data-view]')) {
      button.setAttribute('aria-selected', button.dataset.view === viewName ? 'true' : 'false');
    }
    view.fitCell = 0;
    if (state.pattern) scheduleDraw();
  }

  function clampOffset() {
    if (!state.pattern || !view.fitCell) return;
    const scale = (view.fitCell * view.zoom) / view.baseCell;
    const sheetWidth = view.sheetWidth * scale;
    const sheetHeight = view.sheetHeight * scale;
    view.offsetX = sheetWidth <= view.width
      ? (view.width - sheetWidth) / 2
      : clamp(view.offsetX, view.width - sheetWidth - 12, 12);
    view.offsetY = sheetHeight <= view.height
      ? (view.height - sheetHeight) / 2
      : clamp(view.offsetY, view.height - sheetHeight - 12, 12);
  }

  function resetView() {
    view.zoom = 1;
    view.fitCell = 0;
    view.baseCell = 0;
    view.offsetX = 0;
    view.offsetY = 0;
    view.pointers.clear();
    view.gesture = null;
    patternCanvas.classList.remove('dragging');
    if (state.pattern) drawPattern();
  }

  function changeZoom(value, anchorX, anchorY) {
    if (!state.pattern || !view.fitCell) return;
    const ax = anchorX == null ? view.width / 2 : anchorX;
    const ay = anchorY == null ? view.height / 2 : anchorY;
    const maxZoom = Math.min(48, Math.max(8, 48 / view.fitCell));
    const next = clamp(value, 1, maxZoom);
    const cell = view.fitCell * view.zoom;
    const boardX = (ax - view.offsetX) / cell;
    const boardY = (ay - view.offsetY) / cell;
    view.zoom = next;
    view.offsetX = ax - boardX * view.fitCell * next;
    view.offsetY = ay - boardY * view.fitCell * next;
    drawPattern();
  }

  /* ------------------------------------------------------------------ *
   * 画布交互
   * ------------------------------------------------------------------ */

  /* ---------------- 编辑工具 ---------------- */

  function setTool(tool) {
    if (!TOOL_HELP[tool] || !state.pattern) return;
    endStroke();
    state.tool = tool;
    patternCanvas.style.cursor = tool === 'pan' ? '' : 'crosshair';
    document.body.classList.toggle('picking', tool === 'eyedropper');
    renderToolButtons();
    if (tool === 'eyedropper') setStatus('吸管已开启：点图纸格子吸取色号，或点右侧「预览」里的原图取色。');
  }

  function resetTool() {
    endStroke();
    state.tool = 'pan';
    patternCanvas.style.cursor = '';
    document.body.classList.remove('picking');
    renderToolButtons();
  }

  function renderToolButtons() {
    const enabled = Boolean(state.pattern);
    for (const button of toolButtons.querySelectorAll('button[data-tool]')) {
      button.disabled = !enabled;
      button.setAttribute('aria-pressed', button.dataset.tool === state.tool ? 'true' : 'false');
    }
    toolHelp.textContent = TOOL_HELP[state.tool];
  }

  function cellAt(viewX, viewY) {
    const pattern = state.pattern;
    if (!pattern || !view.fitCell) return null;
    const cell = view.fitCell * view.zoom;
    const scale = cell / view.baseCell;
    const x = Math.floor((viewX - view.offsetX - view.boardX * scale) / cell);
    const y = Math.floor((viewY - view.offsetY - view.boardY * scale) / cell);
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return null;
    return { x, y };
  }

  // 两个格子之间的直线（Bresenham），快速拖动时补齐中间格子
  function lineCells(from, to) {
    const cells = [];
    let x = from.x;
    let y = from.y;
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const sx = from.x < to.x ? 1 : -1;
    const sy = from.y < to.y ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      cells.push({ x, y });
      if (x === to.x && y === to.y) break;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return cells;
  }

  // 画笔色：优先用图纸里的颜色对象；被擦光后回落到色卡里的同色号
  function brushColor() {
    const pattern = state.pattern;
    if (!pattern || !state.paintCode) return null;
    return pattern.colors.find((item) => item.code === state.paintCode)
      || getPalette(paletteMode.value).find((item) => item.code === state.paintCode)
      || null;
  }

  function beginStroke(point) {
    const color = state.tool === 'eraser' ? backgroundBead() : brushColor();
    if (!color) {
      setStatus('先选一个画笔颜色，或改用吸管从图纸 / 原图取色。');
      return false;
    }
    state.stroke = { color, changes: [], seen: new Set(), last: null };
    extendStroke(point);
    return true;
  }

  function strokeApply(x, y) {
    const pattern = state.pattern;
    const stroke = state.stroke;
    const index = patternIndex(pattern, x, y);
    const before = pattern.beads[index];
    if (before.code === stroke.color.code) return;
    if (!stroke.seen.has(index)) {
      stroke.seen.add(index);
      stroke.changes.push({ index, color: before });
    }
    pattern.beads[index] = stroke.color;
    scheduleDraw(true);
  }

  function extendStroke(point) {
    const stroke = state.stroke;
    if (!stroke) return;
    const cell = cellAt(point.x, point.y);
    if (!cell) return;
    if (stroke.last && (stroke.last.x !== cell.x || stroke.last.y !== cell.y)) {
      for (const step of lineCells(stroke.last, cell)) strokeApply(step.x, step.y);
    } else {
      strokeApply(cell.x, cell.y);
    }
    stroke.last = cell;
  }

  // 整笔只记一条撤销
  function endStroke() {
    const stroke = state.stroke;
    state.stroke = null;
    if (!stroke || !stroke.changes.length) return;
    state.undoStack.push({ changes: stroke.changes });
    afterEdit(`已${state.tool === 'eraser' ? '擦除' : '涂色'} ${stroke.changes.length} 格，可点击撤销。`);
  }

  function tapAt(viewX, viewY) {
    if (state.tool === 'eyedropper') {
      pickFromPattern(viewX, viewY);
      return;
    }
    paintCell(viewX, viewY);
  }

  function setBrush(color, message) {
    const editable = ensureEditableColor(color);
    state.paintCode = editable.code;
    renderPaintOptions();
    renderPaintPaletteOptions();
    if (state.tool === 'eyedropper') setTool('paint');
    if (message) setStatus(message);
  }

  function pickFromPattern(viewX, viewY) {
    const pattern = state.pattern;
    const cell = cellAt(viewX, viewY);
    if (!cell) return;
    const color = pattern.beads[patternIndex(pattern, cell.x, cell.y)];
    if (color.isBackground) {
      setStatus('这一格是空位，没有色号可吸。');
      return;
    }
    setBrush(color, `已吸取 ${color.code}（第 ${cell.y + 1} 行、第 ${cell.x + 1} 列），已切回拖动涂色。`);
  }

  function pickFromSourceImage(event) {
    const source = state.image;
    if (!source || !state.pattern) return;
    const rect = sourcePreview.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;

    const crop = cropRect();
    const ix = clamp(Math.floor(crop.x + nx * crop.width), 0, source.width - 1);
    const iy = clamp(Math.floor(crop.y + ny * crop.height), 0, source.height - 1);

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, ix, iy, 1, 1, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    if (data[3] < 40) {
      setStatus('这里没有内容，换个位置吸取。');
      return;
    }

    // 与生成时用同一套风格换算，吸到的色号才和图纸一致
    const styled = styleRgb({ r: data[0], g: data[1], b: data[2] }, STYLE_PRESETS[styleMode.value] || STYLE_PRESETS.realistic);
    const match = makeMatcher(activePalette())(styled);
    setBrush(match, `已从原图吸取 ${match.code}（${match.name}），已切回拖动涂色。`);
  }

  /* ---------------- 指针手势 ---------------- */

  function pointerPoint(event) {
    const rect = patternCanvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startGesture(event) {
    if (!state.pattern) return;
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    event.preventDefault();
    patternCanvas.setPointerCapture(event.pointerId);
    const point = pointerPoint(event);
    view.pointers.set(event.pointerId, point);

    if (view.pointers.size === 2) {
      // 第二根手指按下：结束笔画，转为双指缩放
      endStroke();
      const [a, b] = [...view.pointers.values()];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const cell = view.fitCell * view.zoom;
      view.gesture = {
        type: 'pinch',
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: view.zoom,
        boardX: (midX - view.offsetX) / cell,
        boardY: (midY - view.offsetY) / cell,
      };
      return;
    }
    if (view.pointers.size !== 1) return;

    const dragPaints = state.tool === 'paint' || state.tool === 'eraser';
    const panIntent = !dragPaints || (event.pointerType === 'mouse' && event.button !== 0);
    if (!panIntent) {
      if (beginStroke(point)) view.gesture = { type: 'stroke', pointerId: event.pointerId };
      return;
    }
    view.gesture = {
      type: 'pan',
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      offsetX: view.offsetX,
      offsetY: view.offsetY,
      moved: false,
    };
  }

  function moveGesture(event) {
    if (!view.pointers.has(event.pointerId) || !state.pattern) return;
    event.preventDefault();
    const point = pointerPoint(event);
    view.pointers.set(event.pointerId, point);
    const gesture = view.gesture;

    if (gesture && gesture.type === 'stroke' && gesture.pointerId === event.pointerId) {
      extendStroke(point);
    } else if (gesture && gesture.type === 'pinch' && view.pointers.size >= 2) {
      const [a, b] = [...view.pointers.values()];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const maxZoom = Math.min(48, Math.max(8, 48 / view.fitCell));
      view.zoom = clamp((gesture.zoom * distance) / gesture.distance, 1, maxZoom);
      const cell = view.fitCell * view.zoom;
      view.offsetX = midX - gesture.boardX * cell;
      view.offsetY = midY - gesture.boardY * cell;
      scheduleDraw(true);
    } else if (gesture && gesture.type === 'pan' && gesture.pointerId === event.pointerId) {
      const dx = point.x - gesture.startX;
      const dy = point.y - gesture.startY;
      if (Math.hypot(dx, dy) > 6) gesture.moved = true;
      if (gesture.moved) {
        view.offsetX = gesture.offsetX + dx;
        view.offsetY = gesture.offsetY + dy;
        patternCanvas.classList.add('dragging');
        scheduleDraw(true);
      }
    }
  }

  function finishGesture(event) {
    if (!view.pointers.has(event.pointerId)) return;
    const gesture = view.gesture;

    if (gesture && gesture.type === 'stroke' && gesture.pointerId === event.pointerId) {
      endStroke();
    } else if (event.type === 'pointerup' && gesture && gesture.type === 'pan' && !gesture.moved && gesture.pointerId === event.pointerId) {
      const point = pointerPoint(event);
      tapAt(point.x, point.y);
    }

    view.pointers.delete(event.pointerId);
    patternCanvas.classList.remove('dragging');

    if (view.pointers.size === 1) {
      const [pointerId, remaining] = [...view.pointers.entries()][0];
      view.gesture = {
        type: 'pan',
        pointerId,
        startX: remaining.x,
        startY: remaining.y,
        offsetX: view.offsetX,
        offsetY: view.offsetY,
        moved: true,
      };
    } else {
      view.gesture = null;
    }
    scheduleDraw();
  }

  function paintCell(viewX, viewY) {
    const pattern = state.pattern;
    if (!pattern || !state.paintCode) return;

    const cell = cellAt(viewX, viewY);
    if (!cell) return;

    const index = patternIndex(pattern, cell.x, cell.y);
    const color = brushColor();
    if (!color || pattern.beads[index].code === color.code) return;

    state.undoStack.push({ index, color: pattern.beads[index] });
    pattern.beads[index] = color;
    afterEdit(`已修改第 ${cell.y + 1} 行、第 ${cell.x + 1} 列。`);
  }

  /* ------------------------------------------------------------------ *
   * 手动编辑
   * ------------------------------------------------------------------ */

  function afterEdit(message) {
    const pattern = state.pattern;
    pattern.counts = countColors(pattern.beads);
    pattern.colors = uniqueColors(pattern.beads);
    drawPattern();
    renderPaintOptions();
    renderReplaceSourceOptions();
    updatePatternMeta();
    undoButton.disabled = state.undoStack.length === 0;
    if (message) setStatus(message);
  }

  function undoEdit() {
    const pattern = state.pattern;
    if (!pattern || !state.undoStack.length) return;
    const last = state.undoStack.pop();
    if (last.changes) {
      for (const change of last.changes) pattern.beads[change.index] = change.color;
    } else {
      pattern.beads[last.index] = last.color;
    }
    afterEdit('已撤销上一步手动修改。');
  }

  function ensureEditableColor(color) {
    const pattern = state.pattern;
    let existing = pattern.colors.find((item) => item.code === color.code);
    if (!existing) {
      existing = { code: color.code, name: color.name || color.code, hex: color.hex, rgb: color.rgb || hexToRgb(color.hex) };
      pattern.colors.push(existing);
    }
    return existing;
  }

  function renderPaintOptions() {
    const pattern = state.pattern;
    paintColor.replaceChildren();
    paintColorList.replaceChildren();
    if (!pattern) return;

    // 图纸里用到的颜色在前（按用量），吸管吸到但还没用上的颜色跟在后面
    const used = pattern.counts.map((item) => item.color);
    const usedCodes = new Set(used.map((color) => color.code));
    const extras = pattern.colors.filter((color) => !usedCodes.has(color.code));

    for (const color of [...used, ...extras]) {
      const mark = colorMark(color.code, pattern.settings.palette);
      const option = document.createElement('option');
      option.value = color.code;
      option.textContent = mark ? `${color.code} ${mark}` : color.code;
      paintColor.append(option);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `paint-color-option${color.code === state.paintCode ? ' active' : ''}`;
      button.dataset.code = color.code;
      button.append(swatch(color.hex));
      const text = document.createElement('span');
      text.className = 'paint-color-text';
      text.textContent = `${color.code}${mark ? ` ${mark}` : ''} · ${color.name}`;
      button.append(text);
      button.addEventListener('click', () => selectPaintColor(color));
      paintColorList.append(button);
    }

    paintColor.disabled = !pattern;
    paintColor.value = state.paintCode;
    paintColorList.classList.toggle('disabled', !pattern);
  }

  function renderPaintPaletteOptions() {
    paintPaletteColorList.replaceChildren();
    // 已按「自有套装」过滤，套装外的色号不参与手绘
    const palette = applyBeadSet(getPalette(paletteMode.value));
    const excluded = parseExcluded();
    const paletteKey = paletteMode.value;

    for (const color of palette) {
      const mark = colorMark(color.code, paletteKey);
      const series = MARD_SERIES[seriesOf(color.code)];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `palette-paint-option${color.code === state.paintCode ? ' active' : ''}`;
      button.dataset.code = color.code;
      button.title = `${color.code} ${color.name}${series && series.mark ? `（${series.label}特殊色）` : ''}${excluded.has(color.code.toUpperCase()) ? '（已禁用）' : ''}`;
      button.append(swatch(color.hex));
      const text = document.createElement('span');
      text.textContent = mark ? `${color.code}${mark}` : color.code;
      button.append(text);
      button.addEventListener('click', () => selectPaintColor(color));
      paintPaletteColorList.append(button);
    }
    paintPaletteColorList.classList.toggle('disabled', !state.pattern);
  }

  function selectPaintColor(color) {
    if (!state.pattern || !color || !color.code) return;
    setBrush(color, `画笔已切换为 ${color.code}，轻点或按住拖动格子即可替换。`);
  }

  function swatch(hex) {
    const span = document.createElement('span');
    span.className = 'swatch';
    span.style.background = hex;
    return span;
  }

  function renderReplaceSuggestions() {
    replaceCodeOptions.replaceChildren();
    for (const color of getPalette(paletteMode.value)) {
      const option = document.createElement('option');
      option.value = color.code;
      replaceCodeOptions.append(option);
    }
  }

  function resetReplaceControls() {
    state.replaceSources.clear();
    state.replaceHighlight = new Set();
    replaceTargetCode.value = '';
    renderReplaceSourceOptions();
  }

  function renderReplaceSourceOptions() {
    const pattern = state.pattern;
    const counts = pattern ? pattern.counts : [];
    replaceSourceList.replaceChildren();

    for (const item of counts) {
      const code = item.color.code;
      const selected = state.replaceSources.has(code);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'replace-source-option';
      button.dataset.code = code;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.title = `勾选后可与其他色号一起替换`;

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = selected;
      box.tabIndex = -1;
      box.setAttribute('aria-hidden', 'true');

      const codeEl = document.createElement('span');
      codeEl.className = 'replace-source-code';
      codeEl.textContent = `${code} · ${item.color.name}`;

      const countEl = document.createElement('span');
      countEl.className = 'replace-source-count';
      countEl.textContent = `${item.count.toLocaleString()} 颗`;

      button.append(box, swatch(item.color.hex), codeEl, countEl);
      button.addEventListener('click', () => toggleReplaceSource(code));
      replaceSourceList.append(button);
    }

    replaceSourceList.classList.toggle('disabled', !counts.length);
    replaceSelectAllButton.disabled = !counts.length;
    replaceClearButton.disabled = !state.replaceSources.size;
    replaceTargetCode.disabled = !pattern;
    updateReplacePreview();
  }

  function toggleReplaceSource(code) {
    const selected = !state.replaceSources.has(code);
    if (selected) state.replaceSources.add(code);
    else state.replaceSources.delete(code);

    // 就地更新，避免重建列表把滚动位置弄丢
    for (const button of replaceSourceList.children) {
      if (button.dataset.code !== code) continue;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      const box = button.querySelector('input');
      if (box) box.checked = selected;
      break;
    }
    replaceClearButton.disabled = !state.replaceSources.size;
    updateReplacePreview();
  }

  function selectAllReplaceSources() {
    const pattern = state.pattern;
    if (!pattern) return;
    state.replaceSources = new Set(pattern.counts.map((item) => item.color.code));
    renderReplaceSourceOptions();
  }

  function clearReplaceSources() {
    state.replaceSources.clear();
    renderReplaceSourceOptions();
  }

  function replacementTarget() {
    const code = replaceTargetCode.value.trim().normalize('NFKC').toUpperCase();
    if (!code) return null;
    return getPalette(paletteMode.value).find((color) => color.code.toUpperCase() === code) || null;
  }

  // 当前选中且图纸里确实存在的原色号
  function activeReplaceSources() {
    const pattern = state.pattern;
    if (!pattern) return [];
    const present = new Set(pattern.counts.map((item) => item.color.code));
    return [...state.replaceSources].filter((code) => present.has(code));
  }

  function updateReplacePreview() {
    const pattern = state.pattern;
    const sources = activeReplaceSources();
    state.replaceHighlight = new Set();
    replaceAllButton.disabled = true;
    replaceSourceSummary.textContent = sources.length ? `已选 ${sources.length} 色` : '未选择';

    if (!pattern) {
      replacePreview.textContent = '生成图纸后可将色号批量替换到整张图纸。';
      return;
    }
    if (!sources.length) {
      replacePreview.textContent = '先勾选图纸中需要替换的原色号，可多选。';
      scheduleDraw();
      return;
    }

    const target = replacementTarget();
    if (!replaceTargetCode.value.trim()) {
      replacePreview.textContent = `已选 ${sources.length} 个色号，输入目标色号后即可替换。`;
      scheduleDraw();
      return;
    }
    if (!target) {
      replacePreview.textContent = '未找到目标色号，请输入当前所选色卡中的有效色号。';
      scheduleDraw();
      return;
    }

    const effective = sources.filter((code) => code !== target.code);
    if (!effective.length) {
      replacePreview.textContent = '目标色号与所选色号相同，无需替换。';
      scheduleDraw();
      return;
    }

    // 高亮所有将被改动的格子，替换前先看清楚
    const set = new Set(effective);
    let total = 0;
    pattern.beads.forEach((color, index) => {
      if (!color.isBackground && set.has(color.code)) {
        state.replaceHighlight.add(index);
        total += 1;
      }
    });
    replacePreview.textContent = `将 ${effective.length} 个色号共 ${total.toLocaleString()} 颗替换为 ${target.code}，图纸上已圈出这些格子。`;
    replaceAllButton.disabled = total === 0;
    scheduleDraw();
  }

  function replaceAll() {
    const pattern = state.pattern;
    if (!pattern) return;
    const target = replacementTarget();
    if (!target) return;

    const sources = activeReplaceSources().filter((code) => code !== target.code);
    if (!sources.length) return;

    const editable = ensureEditableColor(target);
    const set = new Set(sources);
    const changes = [];
    pattern.beads.forEach((color, index) => {
      if (!color.isBackground && set.has(color.code)) {
        changes.push({ index, color });
        pattern.beads[index] = editable;
      }
    });
    if (!changes.length) return;

    state.undoStack.push({ changes });
    state.replaceSources.clear();
    state.replaceHighlight = new Set();
    pattern.colors = uniqueColors(pattern.beads);
    replaceTargetCode.value = target.code;
    afterEdit(`已将 ${sources.length} 个色号的 ${changes.length.toLocaleString()} 颗替换为 ${target.code}，可点击撤销。`);
  }

  function updatePatternMeta() {
    const pattern = state.pattern;
    if (!pattern) {
      patternMeta.textContent = '';
      return;
    }
    // 「颗」用实际用豆数（排除空位），擦除后能直接看出少了多少
    const used = pattern.counts.reduce((sum, item) => sum + item.count, 0);
    patternMeta.textContent = `${pattern.width} x ${pattern.height} / ${used} 颗 / ${pattern.counts.length} 色`;
  }

  function updateMirrorButton() {
    mirrorButton.disabled = !state.pattern;
    mirrorButton.setAttribute('aria-pressed', state.mirrored ? 'true' : 'false');
    mirrorButton.textContent = state.mirrored ? '恢复原图' : '左右镜像';
  }

  function toggleMirror() {
    if (!state.pattern) return;
    state.mirrored = !state.mirrored;
    updateMirrorButton();
    drawPattern();
    setStatus(state.mirrored ? '图纸已左右镜像，导出将使用镜像图纸。' : '图纸已恢复原图方向。');
  }

  function updateExportButtons() {
    const enabled = Boolean(state.pattern);
    exportButton.disabled = !enabled;
    exportPdfButton.disabled = !enabled;
    saveProjectButton.disabled = !enabled;
    mirrorButton.disabled = !enabled;
    copyColorsButton.disabled = !enabled;
    renderToolButtons();
  }

  function colorInfoText(pattern) {
    const total = pattern.counts.reduce((sum, item) => sum + item.count, 0);
    const lines = [
      `${paletteLabel(pattern.settings.palette)}`,
      `${pattern.width} × ${pattern.height} 格 / ${pattern.counts.length} 色 / 共 ${total} 颗`,
    ];
    for (const item of pattern.counts) {
      const mark = colorMark(item.color.code, pattern.settings.palette);
      lines.push(`${item.color.code}${mark ? ` ${mark}` : ''} × ${item.count}`);
    }
    return lines.join('\n');
  }

  async function copyColorInfo() {
    if (!state.pattern) return;
    const text = colorInfoText(state.pattern);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('颜色清单已复制到剪贴板。');
    } catch (error) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      try {
        document.execCommand('copy');
        setStatus('颜色清单已复制到剪贴板。');
      } catch (fallbackError) {
        setStatus('复制失败，请手动选择颜色清单文本。');
      }
      area.remove();
    }
  }

  /* ------------------------------------------------------------------ *
   * 导出
   * ------------------------------------------------------------------ */

  // 位图导出：格宽决定分辨率。每格 2.6mm 时，格宽 px / (2.6mm 换算成英寸) 就是 DPI
  function renderExportCanvas(pattern) {
    let cell = 32; // 32px / 0.1024in ≈ 313 DPI，高于 300
    let metrics = sheetMetrics(pattern, cell, EXPORT_THEME);
    // 超大图纸按比例缩小格宽，避免画布超出浏览器上限
    const overflow = Math.max(metrics.sheetWidth / MAX_CELL_PIXELS, metrics.sheetHeight / MAX_CELL_PIXELS, 1);
    if (overflow > 1) {
      cell = Math.max(12, Math.floor(cell / overflow));
      metrics = sheetMetrics(pattern, cell, EXPORT_THEME);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(metrics.sheetWidth);
    canvas.height = Math.ceil(metrics.sheetHeight);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawSheet(ctx, pattern, metrics, { left: 0, top: 0, right: metrics.sheetWidth, bottom: metrics.sheetHeight });
    return { canvas, cell };
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('画布导出失败'))), type, quality);
    });
  }

  // 按标准拼板切分图纸：每块 boardSize × boardSize，边缘不足一块的也单独成板
  function boardList(pattern, boardSize) {
    const columns = Math.ceil(pattern.width / boardSize);
    const rows = Math.ceil(pattern.height / boardSize);
    const total = columns * rows;
    const boards = [];
    for (let by = 0; by < rows; by += 1) {
      for (let bx = 0; bx < columns; bx += 1) {
        const x0 = bx * boardSize;
        const y0 = by * boardSize;
        const width = Math.min(boardSize, pattern.width - x0);
        const height = Math.min(boardSize, pattern.height - y0);
        boards.push({
          index: boards.length + 1,
          total,
          x0,
          y0,
          width,
          height,
          rowStart: y0 + 1,
          rowEnd: y0 + height,
          colStart: x0 + 1,
          colEnd: x0 + width,
        });
      }
    }
    return boards;
  }

  // 从整图里裁出一块拼板，坐标是「板内坐标」，和实体拼板对齐
  // 左右镜像一整张图纸（含拼板顺序），用于熨烫翻面对照
  function mirroredPattern(pattern) {
    const { width, height } = pattern;
    const beads = new Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        beads[y * width + (width - 1 - x)] = pattern.beads[patternIndex(pattern, x, y)];
      }
    }
    return {
      width,
      height,
      beads,
      colors: uniqueColors(beads),
      counts: countColors(beads),
      settings: pattern.settings,
      mirror: false,
    };
  }

  function boardPattern(pattern, board) {
    const beads = [];
    for (let y = 0; y < board.height; y += 1) {
      for (let x = 0; x < board.width; x += 1) {
        beads.push(pattern.beads[patternIndex(pattern, board.x0 + x, board.y0 + y)]);
      }
    }
    return {
      width: board.width,
      height: board.height,
      beads,
      colors: uniqueColors(beads),
      counts: countColors(beads),
      settings: pattern.settings,
      board,
      mirror: false,
    };
  }

  /* ------------------------------------------------------------------ *
   * 矢量 PDF（PDF 1.4）
   * 图案、色号、坐标全是矢量对象，放大不糊、体积远小于整页位图。
   * ASCII 色号/数字用随文件自带的 5×7 点阵字形（Type3，等于把字体嵌进 PDF），
   * 中文用 PDF 规范内置的 STSong-Light（Adobe-GB1），都不依赖设备字体、不会错位。
   * ------------------------------------------------------------------ */

  const TYPE3_EM = 1000;
  const TYPE3_DOT = TYPE3_EM / 6; // 字宽 5 点 + 1 点间距 = 6 点/字符
  const TYPE3_FONT = 'FV';
  const CJK_FONT = 'FC';
  const MARK_COLOR = '#c2453f';

  // 只放色号/坐标会用到的字符（0-9、A-Z、-、空格），其余 ASCII 走中文字体
  const TYPE3_GLYPHS = {
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  };

  function pdfNum(value) {
    return String(Number(Number(value).toFixed(3)));
  }

  function pdfRgb(hex) {
    const rgb = hexToRgb(hex);
    return [rgb.r, rgb.g, rgb.b].map((v) => Number((v / 255).toFixed(4)));
  }

  function type3GlyphProc(rows) {
    const ops = [`${TYPE3_EM} 0 d0`];
    for (let row = 0; row < 7; row += 1) {
      const bits = rows[row];
      let col = 0;
      while (col < 5) {
        if (bits[col] === '1') {
          let end = col;
          while (end + 1 < 5 && bits[end + 1] === '1') end += 1;
          ops.push(
            `${pdfNum(col * TYPE3_DOT)} ${pdfNum((6 - row) * TYPE3_DOT)} `
              + `${pdfNum((end - col + 1) * TYPE3_DOT)} ${pdfNum(TYPE3_DOT)} re`,
          );
          col = end + 1;
        } else {
          col += 1;
        }
      }
    }
    ops.push('f');
    return ops.join('\n');
  }

  function pdfLiteral(text) {
    let out = '';
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`;
      else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
      else out += ch;
    }
    return `(${out})`;
  }

  function pdfHexText(text) {
    let out = '';
    for (let i = 0; i < text.length; i += 1) out += text.charCodeAt(i).toString(16).padStart(4, '0');
    return `<${out}>`;
  }

  // 逐字符分流：字形表里有的 ASCII 走自绘 Type3，其余（含中文）走 CID 字体
  function pdfTextRuns(text) {
    const runs = [];
    for (const ch of String(text)) {
      const code = ch.charCodeAt(0);
      const font = code >= 32 && code <= 126 && TYPE3_GLYPHS[ch] ? TYPE3_FONT : CJK_FONT;
      const last = runs[runs.length - 1];
      if (last && last.font === font) last.text += ch;
      else runs.push({ font, text: ch });
    }
    return runs;
  }

  function pdfRunWidth(run, size) {
    if (run.font === CJK_FONT) {
      // 中文按全角 1em、ASCII 按半角 0.5em 估（CID 字体的 /W 也是这么设的）
      let units = 0;
      for (const ch of run.text) units += ch.charCodeAt(0) < 128 ? 0.5 : 1;
      return units * size;
    }
    return run.text.length * size;
  }

  function pdfTextWidth(text, size) {
    return pdfTextRuns(text).reduce((sum, run) => sum + pdfRunWidth(run, size), 0);
  }

  // 逐字符折行（中英混排都按实际估算宽度算）
  function wrapPdfText(text, maxWidth, size) {
    const lines = [];
    let current = '';
    for (const ch of String(text == null ? '' : text)) {
      if (ch === '\n') {
        lines.push(current);
        current = '';
        continue;
      }
      const next = current + ch;
      if (current && pdfTextWidth(next, size) > maxWidth) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // 页脚备注栏：印在纸张底部，最多 3 行
  function pageFooterNote(page, text, pageWidth, pageHeight, options = {}) {
    const value = String(text == null ? '' : text).trim();
    if (!value) return;
    const margin = options.margin || 28;
    const size = options.size || 9;
    const lineHeight = size * 1.6;
    const maxWidth = pageWidth - margin * 2;
    const lines = wrapPdfText(`备注：${value}`, maxWidth, size).slice(0, 3);
    const top = pageHeight - margin - lines.length * lineHeight;
    pageStroke(page, '#8fa79c', 0.5, margin, top, pageWidth - margin, top);
    lines.forEach((line, index) => {
      pageText(page, line, margin, top + lineHeight * (index + 0.5), size, '#3f5e53', 'left');
    });
  }

  function newPdfPage(widthPt, heightPt) {
    return { widthPt, heightPt, fills: new Map(), strokes: new Map(), polys: new Map(), texts: [] };
  }

  function pageFill(page, hex, x, y, w, h) {
    let list = page.fills.get(hex);
    if (!list) { list = []; page.fills.set(hex, list); }
    list.push([x, y, w, h]);
  }

  function pageStroke(page, hex, width, x1, y1, x2, y2) {
    const key = `${hex}|${pdfNum(width)}`;
    let list = page.strokes.get(key);
    if (!list) { list = []; page.strokes.set(key, list); }
    list.push([x1, y1, x2, y2]);
  }

  function pagePoly(page, hex, points) {
    let list = page.polys.get(hex);
    if (!list) { list = []; page.polys.set(hex, list); }
    list.push(points);
  }

  // y 传的是「视觉中心」（canvas 坐标，y 向下），基线按字形高度换算
  function pageText(page, text, x, yCenter, size, hex, align) {
    const value = String(text == null ? '' : text);
    if (!value) return;
    const runs = pdfTextRuns(value);
    const total = runs.reduce((sum, run) => sum + pdfRunWidth(run, size), 0);
    let cursor = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    const baseline = yCenter + size * 0.58;
    for (const run of runs) {
      page.texts.push({ font: run.font, text: run.text, x: cursor, y: baseline, size, hex });
      cursor += pdfRunWidth(run, size);
    }
  }

  // 特殊色标记画成矢量图形，避免依赖符号字体
  function pageMark(page, mark, cx, cy, size, hex) {
    const r = size * 0.55;
    if (mark === '*') {
      for (let i = 0; i < 3; i += 1) {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        pageStroke(
          page,
          hex,
          Math.max(0.25, size * 0.16),
          cx - Math.cos(angle) * r,
          cy - Math.sin(angle) * r,
          cx + Math.cos(angle) * r,
          cy + Math.sin(angle) * r,
        );
      }
      return;
    }
    if (mark === '△') {
      pagePoly(page, hex, [[cx, cy - r], [cx + r, cy + r * 0.8], [cx - r, cy + r * 0.8]]);
      return;
    }
    if (mark === '◇') {
      pagePoly(page, hex, [[cx, cy - r], [cx + r * 0.8, cy], [cx, cy + r], [cx - r * 0.8, cy]]);
      return;
    }
    if (mark === '☆') {
      const points = [];
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? r : r * 0.45;
        const angle = -Math.PI / 2 + (Math.PI / 5) * i;
        points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
      }
      pagePoly(page, hex, points);
      return;
    }
    if (mark === '○') {
      const points = [];
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      pagePoly(page, hex, points);
    }
  }

  function renderPdfPageContent(page) {
    const height = page.heightPt;
    const parts = [];
    for (const [hex, rects] of page.fills) {
      const [r, g, b] = pdfRgb(hex);
      parts.push(`${r} ${g} ${b} rg`);
      for (const [x, y, w, h] of rects) {
        parts.push(`${pdfNum(x)} ${pdfNum(height - y - h)} ${pdfNum(w)} ${pdfNum(h)} re`);
      }
      parts.push('f');
    }
    for (const [hex, polys] of page.polys) {
      const [r, g, b] = pdfRgb(hex);
      parts.push(`${r} ${g} ${b} rg`);
      for (const points of polys) {
        points.forEach(([x, y], index) => {
          parts.push(`${pdfNum(x)} ${pdfNum(height - y)} ${index === 0 ? 'm' : 'l'}`);
        });
        parts.push('h');
      }
      parts.push('f');
    }
    for (const [key, lines] of page.strokes) {
      const [hex, width] = key.split('|');
      const [r, g, b] = pdfRgb(hex);
      parts.push(`${r} ${g} ${b} RG ${width} w`);
      for (const [x1, y1, x2, y2] of lines) {
        parts.push(`${pdfNum(x1)} ${pdfNum(height - y1)} m ${pdfNum(x2)} ${pdfNum(height - y2)} l`);
      }
      parts.push('S');
    }
    const groups = new Map();
    for (const item of page.texts) {
      const key = `${item.font}|${pdfNum(item.size)}|${item.hex}`;
      let group = groups.get(key);
      if (!group) {
        group = { font: item.font, size: item.size, hex: item.hex, runs: [] };
        groups.set(key, group);
      }
      group.runs.push(item);
    }
    for (const group of groups.values()) {
      const [r, g, b] = pdfRgb(group.hex);
      parts.push(`BT /${group.font} ${pdfNum(group.size)} Tf ${r} ${g} ${b} rg`);
      for (const run of group.runs) {
        const payload = run.font === CJK_FONT ? pdfHexText(run.text) : pdfLiteral(run.text);
        parts.push(`1 0 0 1 ${pdfNum(run.x)} ${pdfNum(height - run.y)} Tm ${payload} Tj`);
      }
      parts.push('ET');
    }
    return parts.join('\n');
  }

  // 版面换算：canvas 主题里的 px 值换成 pt，每格恒为 2.6mm
  function pdfLayout(cols, rows, cell, theme) {
    const s = (lockedSpec().diameterMm * MM_TO_PT) / cell;
    const P = (px) => px * s;
    const cellPt = cell * s;
    return {
      s,
      P,
      cellPt,
      padding: P(theme.padding),
      coord: P(theme.coord),
      header: P(theme.header),
      legendHeader: P(theme.legendHeader),
      legendRow: P(theme.legendRow),
      swatch: P(theme.swatch),
      boardX: P(theme.padding) + P(theme.coord),
      boardY: P(theme.padding) + P(theme.header) + P(theme.coord),
      boardW: cols * cellPt,
      boardH: rows * cellPt,
      f: {
        headerTitle: P(theme.headerTitle),
        headerSub: P(theme.headerSub),
        headerBrand: P(theme.headerBrand),
        headerBrandSub: P(theme.headerBrandSub),
        legendTitle: P(theme.legendTitle),
        legendTotal: P(theme.legendTotal),
        legendCode: P(theme.legendCode),
        legendName: P(theme.legendName),
        legendCount: P(theme.legendCount),
        coord: Math.max(P(theme.minCoordFont), cellPt * theme.coordFont),
        code: Math.max(P(theme.minCodeFont), cellPt * theme.codeFont),
      },
    };
  }

  function boardTileBox(cols, rows, cell, theme) {
    const L = pdfLayout(cols, rows, cell, theme);
    const columns = clamp(Math.floor((cols * cell + theme.coord) / 210), 1, 5);
    const legendRows = Math.max(1, Math.ceil(Math.max(1, rows) / columns));
    const legendHeight = L.legendHeader + legendRows * L.legendRow + 20 * L.s;
    return {
      L,
      columns,
      legendHeight,
      gap: 16 * L.s,
      width: L.boardW + L.coord + L.padding * 2,
      height: L.boardY + L.boardH + 16 * L.s + legendHeight + L.padding,
      compactHeight: L.boardY + L.boardH + L.padding,
    };
  }

  // 把一块拼板画到 page 上（canvas 坐标，pt，y 向下），左上角在 (ox, oy)
  function emitBoardTile(page, sub, spec, cell, theme, ox, oy, options = {}) {
    const withLegend = Boolean(options.withLegend);
    const box = boardTileBox(sub.width, sub.height, cell, theme);
    const L = box.L;
    const columns = options.columns || box.columns;
    const X = (v) => ox + v;
    const Y = (v) => oy + v;

    // 页眉
    const mirrored = Boolean(options.mirrored);
    pageFill(page, mirrored ? '#a9bcc9' : '#c5d9ca', X(0), Y(0), box.width, L.header);
    pageText(page, mirrored ? '拼豆图纸 · 镜像' : '拼豆图纸', X(L.padding), Y(L.header * 0.38), L.f.headerTitle, '#315448', 'left');
    const board = sub.board;
    pageText(
      page,
      board
        ? `第 ${board.index}/${board.total} 板 · 行 ${board.rowStart}-${board.rowEnd} / 列 ${board.colStart}-${board.colEnd} · ${sub.width} x ${sub.height} 格 / ${sub.counts.length} 色`
        : `${sub.width} x ${sub.height} 格 / ${sub.counts.length} 色`,
      X(L.padding),
      Y(L.header * 0.72),
      L.f.headerSub,
      '#3f5e53',
      'left',
    );
    const size = physicalSizeMm(sub, spec);
    pageText(
      page,
      mirrored ? `${paletteLabel(sub.settings.palette)} · 左右翻转` : paletteLabel(sub.settings.palette),
      X(box.width - L.padding),
      Y(L.header * 0.38),
      L.f.headerBrand,
      '#ffffff',
      'right',
    );
    pageText(
      page,
      `${formatMm(size.width)} x ${formatMm(size.height)} mm · ${spec.diameterMm}mm · 按 100% 打印`,
      X(box.width - L.padding),
      Y(L.header * 0.72),
      L.f.headerBrandSub,
      '#ffffff',
      'right',
    );

    // 格子（按颜色批量填充）
    for (let y = 0; y < sub.height; y += 1) {
      for (let x = 0; x < sub.width; x += 1) {
        const color = sub.beads[patternIndex(sub, x, y)];
        if (color.isBackground) continue;
        pageFill(page, color.hex, X(L.boardX + x * L.cellPt), Y(L.boardY + y * L.cellPt), L.cellPt, L.cellPt);
      }
    }

    // 格内色号
    let maxLen = 1;
    for (const item of sub.counts) maxLen = Math.max(maxLen, shortCode(item.color.code).length);
    const codeSize = Math.min(L.f.code, (L.cellPt * 0.94) / maxLen);
    if (codeSize >= 1.1) {
      for (let y = 0; y < sub.height; y += 1) {
        for (let x = 0; x < sub.width; x += 1) {
          const color = sub.beads[patternIndex(sub, x, y)];
          if (color.isBackground) continue;
          const code = shortCode(color.code);
          if (!code) continue;
          pageText(
            page,
            code,
            X(L.boardX + (x + 0.5) * L.cellPt),
            Y(L.boardY + (y + 0.5) * L.cellPt),
            codeSize,
            contrastColor(color.rgb),
            'center',
          );
        }
      }
    }

    // 坐标：标整图绝对行列号（第 1 列、每 10 列、最后一列）
    const offsetX = board ? board.x0 : 0;
    const offsetY = board ? board.y0 : 0;
    for (let x = 0; x < sub.width; x += 1) {
      const abs = offsetX + x + 1;
      if (!(x === 0 || abs % 10 === 0 || x === sub.width - 1)) continue;
      pageText(page, String(abs), X(L.boardX + (x + 0.5) * L.cellPt), Y(L.boardY - L.coord / 2), L.f.coord, '#5f776e', 'center');
    }
    for (let y = 0; y < sub.height; y += 1) {
      const abs = offsetY + y + 1;
      if (!(y === 0 || abs % 10 === 0 || y === sub.height - 1)) continue;
      pageText(page, String(abs), X(L.boardX - L.coord / 2), Y(L.boardY + (y + 0.5) * L.cellPt), L.f.coord, '#5f776e', 'center');
    }

    // 网格
    for (let x = 0; x <= sub.width; x += 1) {
      const line = x % 10 === 0
        ? { hex: '#4a695e', width: Math.max(0.5, L.s * 2) }
        : x % 5 === 0
          ? { hex: '#7d968b', width: Math.max(0.3, L.s) }
          : { hex: '#b3c4bb', width: Math.max(0.2, L.s * 0.6) };
      pageStroke(page, line.hex, line.width, X(L.boardX + x * L.cellPt), Y(L.boardY), X(L.boardX + x * L.cellPt), Y(L.boardY + L.boardH));
    }
    for (let y = 0; y <= sub.height; y += 1) {
      const line = y % 10 === 0
        ? { hex: '#4a695e', width: Math.max(0.5, L.s * 2) }
        : y % 5 === 0
          ? { hex: '#7d968b', width: Math.max(0.3, L.s) }
          : { hex: '#b3c4bb', width: Math.max(0.2, L.s * 0.6) };
      pageStroke(page, line.hex, line.width, X(L.boardX), Y(L.boardY + y * L.cellPt), X(L.boardX + L.boardW), Y(L.boardY + y * L.cellPt));
    }

    if (!withLegend) return;

    // 图例
    const legendY = L.boardY + L.boardH + box.gap;
    const total = sub.counts.reduce((sum, item) => sum + item.count, 0);
    const paletteKey = sub.settings.palette;
    pageFill(page, '#c5d9ca', X(0), Y(legendY), box.width, L.legendHeader);
    pageText(page, '用料清单', X(L.padding), Y(legendY + L.legendHeader / 2), L.f.legendTitle, '#ffffff', 'left');
    pageText(
      page,
      `共 ${sub.counts.length} 色 / 总计 ${total} 颗`,
      X(box.width - L.padding),
      Y(legendY + L.legendHeader / 2),
      L.f.legendTotal,
      '#ffffff',
      'right',
    );

    const columnWidth = (box.width - L.padding * 2) / columns;
    sub.counts.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const itemX = L.padding + col * columnWidth;
      const centerY = legendY + L.legendHeader + 10 * L.s + row * L.legendRow + L.legendRow / 2;
      pageFill(page, item.color.hex, X(itemX), Y(centerY - L.swatch / 2), L.swatch, L.swatch);
      const textX = itemX + L.swatch + 12 * L.s;
      pageText(page, item.color.code, X(textX), Y(centerY - L.f.legendCode * 0.5), L.f.legendCode, '#24302d', 'left');
      pageText(page, item.color.name, X(textX), Y(centerY + L.f.legendName * 0.8), L.f.legendName, '#63756f', 'left');
      pageText(page, `${item.count} 颗`, X(itemX + columnWidth - 8 * L.s), Y(centerY), L.f.legendCount, '#3f5e53', 'right');
      const mark = colorMark(item.color.code, paletteKey);
      if (mark) {
        pageMark(page, mark, X(textX + item.color.code.length * L.f.legendCode + L.f.legendCode * 0.9), Y(centerY - L.f.legendCode * 0.5), L.f.legendCode * 0.62, MARK_COLOR);
      }
    });
  }

  // 一块拼板一页：A4 纸 + 对应横竖方向，内容按「每格 = 2.6mm」居中放置，绝不缩放
  function buildBoardVectorPage(pattern, board, spec, options = {}) {
    const theme = EXPORT_THEME;
    const sub = boardPattern(pattern, board);
    const margin = 18;
    let cell = 48;
    let box = boardTileBox(sub.width, sub.height, cell, theme);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const landscape = box.width > box.height;
      const pageWidth = landscape ? PDF_A4.height : PDF_A4.width;
      const pageHeight = landscape ? PDF_A4.width : PDF_A4.height;
      if (box.width <= pageWidth - margin * 2 && box.height <= pageHeight - margin * 2) break;
      cell *= 1.4;
      box = boardTileBox(sub.width, sub.height, cell, theme);
    }
    const landscape = box.width > box.height;
    const pageWidth = landscape ? PDF_A4.height : PDF_A4.width;
    const pageHeight = landscape ? PDF_A4.width : PDF_A4.height;
    const page = newPdfPage(pageWidth, pageHeight);
    emitBoardTile(page, sub, spec, cell, theme, (pageWidth - box.width) / 2, (pageHeight - box.height) / 2, {
      withLegend: true,
      mirrored: options.mirrored,
    });
    pageFooterNote(page, options.note, pageWidth, pageHeight);
    return { width: pageWidth, height: pageHeight, data: renderPdfPageContent(page) };
  }

  // 省纸模式：一张 A4 排多块紧凑拼板，仍是 100% 实际大小
  function buildTiledVectorPages(pattern, spec, options = {}) {
    const theme = EXPORT_THEME;
    const cell = 24;
    const margin = 12;
    const slot = boardTileBox(spec.boardSize, spec.boardSize, cell, theme);
    const columns = Math.max(1, Math.floor((PDF_A4.width - margin * 2) / slot.width));
    const rows = Math.max(1, Math.floor((PDF_A4.height - margin * 2) / slot.compactHeight));
    const perPage = columns * rows;
    const gridWidth = columns * slot.width;
    const gridHeight = rows * slot.compactHeight;
    const originX = (PDF_A4.width - gridWidth) / 2;
    const originY = (PDF_A4.height - gridHeight) / 2;

    const boards = boardList(pattern, spec.boardSize);
    const pages = [];
    for (let start = 0; start < boards.length; start += perPage) {
      const slice = boards.slice(start, start + perPage);
      const page = newPdfPage(PDF_A4.width, PDF_A4.height);
      slice.forEach((board, index) => {
        const sub = boardPattern(pattern, board);
        const tileBox = boardTileBox(sub.width, sub.height, cell, theme);
        const col = index % columns;
        const row = Math.floor(index / columns);
        emitBoardTile(
          page,
          sub,
          spec,
          cell,
          theme,
          originX + col * slot.width + (slot.width - tileBox.width) / 2,
          originY + row * slot.compactHeight + (slot.compactHeight - tileBox.compactHeight) / 2,
          { withLegend: false, mirrored: options.mirrored },
        );
      });
      pageFooterNote(page, options.note, PDF_A4.width, PDF_A4.height, { margin: 20, size: 8 });
      pages.push({ width: PDF_A4.width, height: PDF_A4.height, data: renderPdfPageContent(page) });
    }
    return { pages, columns, rows, perPage };
  }

  // 首页：成品缩略图 + 关键信息，快速确认整体效果
  function buildCoverVectorPage(pattern, spec, note) {
    const pageWidth = PDF_A4.width;
    const pageHeight = PDF_A4.height;
    const page = newPdfPage(pageWidth, pageHeight);
    const margin = 42;
    const headerHeight = 58;
    const infoSize = 11;
    const lineHeight = infoSize * 1.9;

    pageFill(page, '#c5d9ca', 0, 0, pageWidth, headerHeight);
    pageText(page, '拼豆图纸 · 成品预览', margin, headerHeight / 2, 21, '#ffffff', 'left');

    // 缩略图（同样是矢量，放大不糊）
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight * 0.5;
    const aspect = pattern.width / pattern.height;
    let thumbWidth = maxWidth;
    let thumbHeight = thumbWidth / aspect;
    if (thumbHeight > maxHeight) {
      thumbHeight = maxHeight;
      thumbWidth = thumbHeight * aspect;
    }
    const thumbX = (pageWidth - thumbWidth) / 2;
    const thumbY = headerHeight + 36;
    const cellW = thumbWidth / pattern.width;
    const cellH = thumbHeight / pattern.height;
    for (let y = 0; y < pattern.height; y += 1) {
      for (let x = 0; x < pattern.width; x += 1) {
        const color = pattern.beads[patternIndex(pattern, x, y)];
        if (color.isBackground) continue;
        // +0.2pt 让相邻格之间不露白缝
        pageFill(page, color.hex, thumbX + x * cellW, thumbY + y * cellH, cellW + 0.2, cellH + 0.2);
      }
    }
    pageStroke(page, '#8fa79c', 0.6, thumbX, thumbY, thumbX + thumbWidth, thumbY);
    pageStroke(page, '#8fa79c', 0.6, thumbX, thumbY + thumbHeight, thumbX + thumbWidth, thumbY + thumbHeight);
    pageStroke(page, '#8fa79c', 0.6, thumbX, thumbY, thumbX, thumbY + thumbHeight);
    pageStroke(page, '#8fa79c', 0.6, thumbX + thumbWidth, thumbY, thumbX + thumbWidth, thumbY + thumbHeight);

    const size = physicalSizeMm(pattern, spec);
    const total = pattern.counts.reduce((sum, item) => sum + item.count, 0);
    const boards = boardList(pattern, spec.boardSize).length;
    const infoY = thumbY + thumbHeight + 34;
    const lines = [
      `图纸 ${pattern.width} x ${pattern.height} 格 / ${pattern.counts.length} 色 / 共 ${total.toLocaleString()} 颗`,
      `实际成品 ${formatMm(size.width)} x ${formatMm(size.height)} mm（${spec.label}，每颗 ${spec.diameterMm}mm）`,
      `色卡 ${paletteLabel(pattern.settings.palette)} · 分 ${boards} 块 ${spec.boardSize} x ${spec.boardSize} 标准拼板`,
    ];
    lines.forEach((line, index) => {
      pageText(page, line, margin, infoY + index * lineHeight, infoSize, '#24302d', 'left');
    });

    pageFooterNote(page, note, pageWidth, pageHeight);
    return { width: pageWidth, height: pageHeight, data: renderPdfPageContent(page) };
  }

  function createPdfDocument() {
    const objects = [null];
    return {
      objects,
      // objects 以 1 为基，push 后下标才是对象号
      add(content) { objects.push(content); return objects.length - 1; },
      stream(data) { return `<< /Length ${data.length} >>\nstream\n${data}\nendstream`; },
    };
  }

  // ASCII 字体：Type3，字形过程就写在 PDF 里（等于自带字体，不依赖设备）
  function pdfAsciiFont(doc) {
    const charProcs = [];
    const differences = [];
    const widths = [];
    for (let code = 32; code <= 90; code += 1) {
      const rows = TYPE3_GLYPHS[String.fromCharCode(code)];
      if (rows) {
        const id = doc.add(doc.stream(type3GlyphProc(rows)));
        charProcs.push(`/n${code} ${id} 0 R`);
        differences.push(`${code} /n${code}`);
        widths.push(TYPE3_EM);
      } else {
        widths.push(0);
      }
    }
    return doc.add(
      '<< /Type /Font /Subtype /Type3 /Name /' + TYPE3_FONT
        + ` /FontBBox [0 ${pdfNum(-TYPE3_DOT)} ${TYPE3_EM} ${pdfNum(TYPE3_DOT * 7.5)}]`
        + ' /FontMatrix [0.001 0 0 0.001 0 0]'
        + ` /CharProcs << ${charProcs.join(' ')} >>`
        + ` /Encoding << /Type /Encoding /Differences [${differences.join(' ')}] >>`
        + ` /FirstChar 32 /LastChar 90 /Widths [${widths.join(' ')}] /Resources << >> >>`,
    );
  }

  // 中文：PDF 规范内置的 STSong-Light（Adobe-GB1），不嵌入也能被各阅读器替换显示
  function pdfCjkFont(doc) {
    const descriptor = doc.add(
      '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4'
        + ' /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 93 >>',
    );
    const cid = doc.add(
      '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light'
        + ' /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >>'
        + ` /FontDescriptor ${descriptor} 0 R /DW 1000 /W [32 126 500] >>`,
    );
    return doc.add(
      `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cid} 0 R] >>`,
    );
  }

  function serializePdf(doc, rootId) {
    const encoder = new TextEncoder();
    const chunks = [];
    let size = 0;
    const offsets = [];
    const push = (data) => {
      const bytes = typeof data === 'string' ? encoder.encode(data) : data;
      chunks.push(bytes);
      size += bytes.length;
    };

    push('%PDF-1.4\n');
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

    const count = doc.objects.length;
    for (let id = 1; id < count; id += 1) {
      const body = doc.objects[id];
      if (body == null) continue;
      offsets[id] = size;
      push(`${id} 0 obj\n${body}\nendobj\n`);
    }

    const xrefOffset = size;
    let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let id = 1; id < count; id += 1) xref += `${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`;
    push(xref);
    push(`trailer\n<< /Size ${count} /Root ${rootId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  function buildVectorPdf(pages) {
    const doc = createPdfDocument();
    const catalogId = doc.add('');
    const pagesId = doc.add('');
    const asciiFontId = pdfAsciiFont(doc);
    const cjkFontId = pdfCjkFont(doc);
    const resources = `/Resources << /Font << /${TYPE3_FONT} ${asciiFontId} 0 R /${CJK_FONT} ${cjkFontId} 0 R >> >>`;

    const pageIds = pages.map((page) => {
      const contentId = doc.add(doc.stream(page.data));
      return doc.add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pdfNum(page.width)} ${pdfNum(page.height)}] `
          + `${resources} /Contents ${contentId} 0 R >>`,
      );
    });

    doc.objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    doc.objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    return serializePdf(doc, catalogId);
  }

  // 「颜色清单」页：整张图的色号 + 用量，固定 A4 版面（文字页，不涉及图案缩放）
  function buildColorListVectorPage(pattern, note) {
    const margin = 28;
    const pageWidth = PDF_A4.width;
    const pageHeight = PDF_A4.height;
    const page = newPdfPage(pageWidth, pageHeight);
    const columns = 3;
    const rowHeight = 16;
    const headerHeight = 34;
    const titleSize = 15;
    const codeSize = 9;
    const nameSize = 7.5;
    const countSize = 8.5;
    const swatch = 11;
    const counts = pattern.counts;
    const total = counts.reduce((sum, item) => sum + item.count, 0);
    const paletteKey = pattern.settings.palette;

    pageFill(page, '#c5d9ca', 0, 0, pageWidth, headerHeight);
    pageText(page, '颜色清单', margin, headerHeight / 2, titleSize, '#ffffff', 'left');
    pageText(page, `共 ${counts.length} 色 / 总计 ${total} 颗`, pageWidth - margin, headerHeight / 2, countSize, '#ffffff', 'right');

    const contentTop = headerHeight + 14;
    const columnWidth = (pageWidth - margin * 2) / columns;
    counts.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const itemX = margin + col * columnWidth;
      const centerY = contentTop + row * rowHeight + rowHeight / 2;
      pageFill(page, item.color.hex, itemX, centerY - swatch / 2, swatch, swatch);
      const textX = itemX + swatch + 6;
      pageText(page, item.color.code, textX, centerY - 2, codeSize, '#24302d', 'left');
      pageText(page, item.color.name, textX, centerY + 5, nameSize, '#63756f', 'left');
      pageText(page, `${item.count} 颗`, itemX + columnWidth - 8, centerY, countSize, '#3f5e53', 'right');
      const mark = colorMark(item.color.code, paletteKey);
      if (mark) {
        pageMark(page, mark, textX + item.color.code.length * codeSize + codeSize * 0.9, centerY - 2, codeSize * 0.62, MARK_COLOR);
      }
    });

    const footerY = pageHeight - margin;
    pageText(page, `特殊色标记：${MARK_LEGEND}`, margin, footerY, nameSize, '#63756f', 'left');
    pageText(page, '本页为颜色清单；图案页请务必按 100% 实际大小打印', pageWidth - margin, footerY, nameSize, '#63756f', 'right');
    if (note && String(note).trim()) {
      pageText(page, `备注：${String(note).trim()}`, margin, footerY + nameSize * 1.8, nameSize, '#3f5e53', 'left');
    }
    return { width: pageWidth, height: pageHeight, data: renderPdfPageContent(page) };
  }

  function download(blob, name) {
    const link = document.createElement('a');
    link.download = name;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  }

  function exportBaseName() {
    const pattern = state.pattern;
    return `pindou-pattern-${pattern.width}x${pattern.height}${state.mirrored ? '-mirror' : ''}`;
  }

  async function exportPng() {
    if (!state.pattern) return;
    exportButton.disabled = true;
    setStatus('正在导出 PNG…');
    try {
      const spec = assertExportSpec();
      const report = validateExportCodes(state.pattern);
      updateCodeCheck();
      if (report.passed !== report.total) {
        const bad = report.samples.filter((item) => !item.inPalette || !item.matchesShape).map((item) => item.code);
        throw new Error(`色号抽样校验未通过（${bad.join('、')}），已中止导出`);
      }
      const { canvas, cell } = renderExportCanvas(state.pattern);
      const blob = await canvasBlob(canvas, 'image/png');
      download(blob, `${exportBaseName()}-${Math.round(dpiOf(cell, spec))}dpi.png`);
      const size = physicalSizeMm(state.pattern, spec);
      setStatus(
        `PNG 已导出（整图，不缩放）。位图分辨率 ${dpiNote(cell, spec)}。`
          + `实际成品 ${formatMm(size.width)} × ${formatMm(size.height)} mm。`,
      );
    } catch (error) {
      setStatus(`PNG 导出失败：${error.message}`);
    } finally {
      exportButton.disabled = false;
    }
  }

  // 位图 DPI：每格像素 ÷ 每格实际英寸（2.6mm = 0.1024in）
  function dpiOf(cell, spec) {
    return cell / (spec.diameterMm / 25.4);
  }

  function dpiNote(cell, spec) {
    const dpi = dpiOf(cell, spec);
    if (dpi >= 300) return `${Math.round(dpi)} DPI（≥300，色号清晰）`;
    if (dpi >= 150) return `${Math.round(dpi)} DPI（低于 300，放大后色号可能发虚）`;
    return `${Math.round(dpi)} DPI（低于 150，色号会明显发虚）`;
  }

  // 导出前核对：物理尺寸以「格数 × 2.6mm」为准，和预览里显示的一致才放行
  function verifyExportGeometry(pattern, spec) {
    const size = physicalSizeMm(pattern, spec);
    const previewWidth = Number(beadWidth.value);
    const previewHeight = Number(beadHeight.value);
    if (pattern.width !== previewWidth || pattern.height !== previewHeight) {
      console.warn('图纸格数与预览不一致', { pattern: [pattern.width, pattern.height], preview: [previewWidth, previewHeight] });
    }
    if (!(size.width > 0 && size.height > 0)) {
      throw new Error('实际成品尺寸计算异常，已中止导出');
    }
    return size;
  }

  async function exportPdf() {
    if (!state.pattern) return;
    exportPdfButton.disabled = true;
    setStatus('正在导出矢量 PDF…');
    try {
      const spec = assertExportSpec();
      const pattern = state.pattern;
      const size = verifyExportGeometry(pattern, spec);
      const boards = boardList(pattern, spec.boardSize);

      // 导出前抽样校验 3~5 个关键色色号
      const report = validateExportCodes(pattern);
      updateCodeCheck();
      if (report.passed !== report.total) {
        const bad = report.samples.filter((item) => !item.inPalette || !item.matchesShape).map((item) => item.code);
        throw new Error(`色号抽样校验未通过（${bad.join('、')}），已中止导出，请检查色卡或禁用色号`);
      }

      const note = notesText.value;
      const pages = [buildCoverVectorPage(pattern, spec, note)];

      let layout;
      if (tileBoards.checked) {
        // 省纸模式：一张 A4 排多块拼板，仍是 100% 实际大小
        const tiled = buildTiledVectorPages(pattern, spec, { note });
        pages.push(...tiled.pages);
        layout = `${boards.length} 块拼板排成 ${tiled.pages.length} 页（每页 ${tiled.columns} x ${tiled.rows} = ${tiled.perPage} 块，无图例）`;
      } else {
        // 默认：一块拼板一页，带图例
        boards.forEach((board) => pages.push(buildBoardVectorPage(pattern, board, spec, { note })));
        layout = `${boards.length} 页（29×29 标准拼板，每页一块）`;
      }

      // 镜像翻转页：图案页之后追加一整套左右翻转的图纸，供熨烫翻面对照
      let mirrorLayout = '';
      if (mirrorPages.checked) {
        const flipped = mirroredPattern(pattern);
        if (tileBoards.checked) {
          const tiledMirror = buildTiledVectorPages(flipped, spec, { note, mirrored: true });
          pages.push(...tiledMirror.pages);
          mirrorLayout = ` + ${tiledMirror.pages.length} 页镜像`;
        } else {
          boardList(flipped, spec.boardSize).forEach((board) => {
            pages.push(buildBoardVectorPage(flipped, board, spec, { note, mirrored: true }));
          });
          mirrorLayout = ` + ${boards.length} 页镜像`;
        }
      }

      // 末尾追加一页「颜色清单」（整图色号 + 用量）
      pages.push(buildColorListVectorPage(pattern, note));

      const blob = buildVectorPdf(pages);
      download(blob, `${exportBaseName()}-vector-2.6mm.pdf`);
      setStatus(
        `矢量 PDF 已导出：1 页成品缩略图 + ${layout}${mirrorLayout} + 1 页颜色清单，PDF 1.4，每颗豆 2.6mm 未缩放，放大不模糊。`
          + `实际成品 ${formatMm(size.width)} × ${formatMm(size.height)} mm，打印请选 A4 + 实际大小 / 100%。`,
      );
    } catch (error) {
      setStatus(`PDF 导出失败：${error.message}`);
    } finally {
      exportPdfButton.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ *
   * 项目存档
   * ------------------------------------------------------------------ */

  function saveProject() {
    const pattern = state.pattern;
    if (!pattern) return;

    const palette = [...new Map(pattern.beads.filter((c) => !c.isBackground).map((c) => [c.code, c])).values()]
      .map((color) => ({ code: color.code, name: color.name, hex: color.hex }));

    const project = {
      app: 'pindou-pattern-maker',
      version: 1,
      settings: {
        ...pattern.settings,
        mirrored: state.mirrored,
      },
      crop: state.crop,
      imageName: state.imageFile ? state.imageFile.name : '',
      palette,
      beads: Array.from({ length: pattern.height }, (_, y) =>
        Array.from({ length: pattern.width }, (_, x) => {
          const color = pattern.beads[y * pattern.width + x];
          return color.isBackground ? null : color.code;
        }),
      ),
    };

    if (state.image) {
      // 图片按最长边压缩后存档；crop 必须换算到压缩后的坐标系，否则重新生成会错位
      const canvas = document.createElement('canvas');
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(state.image.width, state.image.height));
      canvas.width = Math.round(state.image.width * scale);
      canvas.height = Math.round(state.image.height * scale);
      canvas.getContext('2d').drawImage(state.image, 0, 0, canvas.width, canvas.height);
      project.image = { width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL('image/jpeg', 0.9) };
      if (project.crop) {
        project.crop = {
          x: project.crop.x * scale,
          y: project.crop.y * scale,
          width: project.crop.width * scale,
          height: project.crop.height * scale,
        };
      }
    }

    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    download(blob, `${exportBaseName()}.json`);
    setStatus('项目已保存为 JSON。');
  }

  function handleProjectLoad(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = JSON.parse(String(reader.result));
        applyProject(project);
      } catch (error) {
        setStatus(`载入失败：${error.message}`);
      } finally {
        projectInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  function applyProject(project) {
    if (!project || !Array.isArray(project.beads)) throw new Error('项目文件格式不正确');

    const settings = project.settings || {};
    if (settings.style && STYLE_PRESETS[settings.style]) {
      styleMode.value = settings.style;
    }
    updateStyleDesc();
    // 老存档可能引用已下线的色卡，忽略而不是让下拉框变成空值
    if (settings.palette && isKnownPalette(settings.palette)) {
      selectPalette(settings.palette);
      renderReplaceSuggestions();
    }
    if (settings.beadSet && beadSet.querySelector(`option[value="${settings.beadSet}"]`)) {
      beadSet.value = settings.beadSet;
    }
    if (settings.colorPreset) applyColorPreset(settings.colorPreset);
    if (settings.excluded != null) excludedColors.value = settings.excluded;
    if (settings.colorCount) colorCount.value = String(settings.colorCount);
    if (settings.minColorCount != null) minColorCount.value = String(settings.minColorCount);
    isolatedCleanup.checked = settings.isolatedCleanup !== false;
    autoTrim.checked = settings.autoTrim !== false;
    removeBg.checked = settings.removeBg !== false;
    state.trimCache = null;
    mirrorPages.checked = settings.mirrorPages !== false;
    if (settings.notes != null) notesText.value = settings.notes;
    if (settings.sizeMode === 'board' || settings.sizeMode === 'ratio') {
      state.sizeMode = settings.sizeMode;
    }
    syncSizeModeButtons();
    // 规格只认锁定值，老存档里的其他规格一律回落到 2.6mm 硬质
    beadSpec.value = BEAD_SPECS[settings.spec] ? settings.spec : LOCKED_SPEC_ID;
    tileBoards.checked = Boolean(settings.tileBoards);
    preserveColor.checked = Boolean(settings.preserveColor);
    updateColorCountValue();
    updateMinColorCount();
    updateBeadSetHint();
    updatePhysicalSize();

    const loadPattern = (image) => {
      if (image) state.image = image;
      if (project.crop) state.crop = project.crop;

      const width = project.beads[0].length;
      const height = project.beads.length;
      const map = new Map();
      for (const entry of project.palette || []) {
        map.set(entry.code, { code: entry.code, name: entry.name || entry.code, hex: entry.hex, rgb: hexToRgb(entry.hex) });
      }
      const beads = [];
      for (const row of project.beads) {
        for (const code of row) {
          if (!code) {
            beads.push(backgroundBead());
          } else if (map.has(code)) {
            beads.push(map.get(code));
          } else {
            const fallback = getPalette(paletteMode.value).find((color) => color.code === code);
            beads.push(fallback || { code, name: code, hex: '#CCCCCC', rgb: { r: 204, g: 204, b: 204 } });
          }
        }
      }

      state.pattern = {
        width,
        height,
        beads,
        colors: uniqueColors(beads),
        counts: countColors(beads),
        settings: { ...settings, width, height },
      };
      state.mirrored = Boolean(settings.mirrored);
      state.undoStack = [];
      state.paintCode = state.pattern.counts.length ? state.pattern.counts[0].color.code : '';
      resetTool();

      beadWidth.value = String(settings.width || width);
      beadWidthInput.value = String(settings.width || width);
      beadHeight.value = String(height);
      beadHeightInput.value = String(height);
      beadSizeValue.textContent = `${width} 颗宽 / ${height} 颗高`;
      updateSizePresetSelection();
      updatePhysicalSize();

      if (state.image) {
        fileName.textContent = project.imageName || '已载入项目';
        cropEmpty.hidden = true;
        cropCanvas.style.display = 'block';
        generateButton.disabled = false;
        drawCropPreview();
      }

      emptyState.hidden = true;
      patternCanvas.style.display = 'block';
      view.zoom = 1;
      view.fitCell = 0;

      renderPaintOptions();
      renderPaintPaletteOptions();
      resetReplaceControls();
      updateMirrorButton();
      updateExportButtons();
      updateCodeCheck();
      drawPattern();
      updatePatternMeta();
      setStatus(`项目已载入：${width} x ${height}，${state.pattern.counts.length} 色。`);
    };

    if (project.image && project.image.dataUrl) {
      const image = new Image();
      image.onload = () => loadPattern(image);
      image.onerror = () => loadPattern(null);
      image.src = project.image.dataUrl;
    } else {
      loadPattern(null);
    }
  }

  /* ------------------------------------------------------------------ *
   * 控件
   * ------------------------------------------------------------------ */

  function updateColorCountValue() {
    const preset = COLOR_PRESETS[colorPreset.value] || COLOR_PRESETS.custom;
    const range = colorPreset.value === 'custom' ? '' : `（${preset.min}~${preset.max}）`;
    colorCountValue.textContent = `${colorCount.value} 色${range}`;
  }

  function bindEvents() {
    imageInput.addEventListener('change', handleImageUpload);
    projectInput.addEventListener('change', handleProjectLoad);
    generateButton.addEventListener('click', generatePattern);
    exportButton.addEventListener('click', exportPng);
    exportPdfButton.addEventListener('click', exportPdf);
    saveProjectButton.addEventListener('click', saveProject);
    undoButton.addEventListener('click', undoEdit);
    zoomFitButton.addEventListener('click', resetView);
    mirrorButton.addEventListener('click', toggleMirror);
    replaceAllButton.addEventListener('click', replaceAll);

    paintColor.addEventListener('change', () => {
      state.paintCode = paintColor.value;
      renderPaintOptions();
      renderPaintPaletteOptions();
    });

    styleMode.addEventListener('change', () => {
      updateStyleDesc();
      setStatus(`处理模式：${STYLE_INFO[styleMode.value].label}，重新点击「生成图纸」生效。`);
    });

    const onPaletteChanged = () => {
      renderPaintPaletteOptions();
      renderReplaceSuggestions();
      updateReplacePreview();
      updateBeadSetHint();
    };
    brandMode.addEventListener('change', () => {
      populateRangeOptions(brandMode.value);
      onPaletteChanged();
      setStatus(`拼豆品牌：${BRANDS.find((brand) => brand.key === brandMode.value).label}，重新生成生效。`);
    });
    rangeMode.addEventListener('change', () => {
      paletteMode.value = rangeMode.value;
      onPaletteChanged();
      setStatus(`色卡范围：${rangeMode.selectedOptions[0] ? rangeMode.selectedOptions[0].textContent : rangeMode.value}，重新生成生效。`);
    });
    beadSet.addEventListener('change', () => {
      updateBeadSetHint();
      renderPaintPaletteOptions();
      setStatus('自有套装已更新，重新点击「生成图纸」生效。');
    });
    colorPresetButtons.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-value]');
      if (!button) return;
      applyColorPreset(button.dataset.value);
      setStatus(`颜色预设：${COLOR_PRESETS[button.dataset.value].label}，重新点击「生成图纸」生效。`);
    });
    minColorCount.addEventListener('input', () => {
      updateMinColorCount();
      setStatus('最少颜色阈值已更新，重新点击「生成图纸」生效。');
    });
    excludedColors.addEventListener('change', () => {
      renderPaintPaletteOptions();
      setStatus('禁用色号已更新，重新点击「生成图纸」生效。');
    });
    replaceTargetCode.addEventListener('input', updateReplacePreview);
    replaceSelectAllButton.addEventListener('click', selectAllReplaceSources);
    replaceClearButton.addEventListener('click', clearReplaceSources);
    colorCount.addEventListener('input', updateColorCountValue);

    beadSpec.addEventListener('change', () => {
      updatePhysicalSize();
      setStatus(`导出规格已锁定为 ${lockedSpec().label}，不会用 5mm 或其他品牌规格出图。`);
    });
    tileBoards.addEventListener('change', () => {
      setStatus(tileBoards.checked
        ? '省纸模式已开启：一张 A4 排多块拼板，仍是 100% 实际大小，但不印图例。'
        : '省纸模式已关闭：一块拼板一页，带图例。');
    });
    isolatedCleanup.addEventListener('change', () => {
      setStatus(isolatedCleanup.checked
        ? '孤立像素检测已开启：1~2 颗的杂色点会自动并入周围主色，重新生成生效。'
        : '孤立像素检测已关闭，重新生成生效。');
    });
    mirrorPages.addEventListener('change', () => {
      setStatus(mirrorPages.checked ? '导出时会附加一套镜像翻转页。' : '导出时不再附加镜像页。');
    });
    notesText.addEventListener('change', () => setStatus('页脚备注已更新，导出 PDF 时会印在页脚。'));

    const refreshImageOptions = (message) => {
      state.trimCache = null;
      if (state.image) {
        updateBeadSizeFromCrop();
        drawCropPreview();
      }
      setStatus(message);
    };
    autoTrim.addEventListener('change', () => refreshImageOptions(
      autoTrim.checked ? '自动裁剪空白边缘已开启，构图框内的空白会被去掉。' : '自动裁剪空白边缘已关闭。',
    ));
    removeBg.addEventListener('change', () => setStatus(
      removeBg.checked ? '去除简单背景已开启，重新点击「生成图纸」生效。' : '去除简单背景已关闭，重新点击「生成图纸」生效。',
    ));

    // 尺寸：按图片比例 / 按豆板尺寸 + 常用尺寸 + 自定义宽高
    sizeModeButtons.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-value]');
      if (!button) return;
      state.sizeMode = button.dataset.value;
      syncSizeModeButtons();
      updateBeadSizeFromCrop();
      setStatus(state.sizeMode === 'ratio'
        ? '按图片比例：高度随构图比例自动适配。'
        : '按豆板尺寸：宽高可独立设置。');
    });
    sizePresetGrid.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-size]');
      if (button) applySizePreset(Number(button.dataset.size));
    });
    const commitWidth = (raw) => {
      const value = clamp(Math.round(Number(raw) || 29), 8, 180);
      beadWidth.value = String(value);
      beadWidthInput.value = String(value);
      updateBeadSizeFromCrop();
    };
    beadWidthInput.addEventListener('input', () => {
      const value = Number(beadWidthInput.value);
      if (Number.isFinite(value) && value >= 8 && value <= 180) commitWidth(value);
    });
    beadWidthInput.addEventListener('change', () => commitWidth(beadWidthInput.value));
    const commitHeight = (raw) => {
      const value = clamp(Math.round(Number(raw) || 29), 8, 180);
      beadHeight.value = String(value);
      beadHeightInput.value = String(value);
      if (state.sizeMode !== 'board') {
        state.sizeMode = 'board';
        syncSizeModeButtons();
      }
      updateBeadSizeFromCrop();
    };
    beadHeightInput.addEventListener('input', () => {
      const value = Number(beadHeightInput.value);
      if (Number.isFinite(value) && value >= 8 && value <= 180) commitHeight(value);
    });
    beadHeightInput.addEventListener('change', () => commitHeight(beadHeightInput.value));

    // 结果视图：原图 / 效果图 / 图纸
    resultTabs.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-view]');
      if (button) setView(button.dataset.view);
    });
    copyColorsButton.addEventListener('click', copyColorInfo);

    toolButtons.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-tool]');
      if (button) setTool(button.dataset.tool);
    });
    // 吸管模式下点右侧「预览」里的原图取色
    sourcePreview.addEventListener('click', (event) => {
      if (state.tool === 'eyedropper') pickFromSourceImage(event);
    });

    cropCanvas.addEventListener('pointerdown', startCropDrag);
    cropCanvas.addEventListener('pointermove', updateCropDrag);
    cropCanvas.addEventListener('pointerup', finishCropDrag);
    cropCanvas.addEventListener('pointercancel', finishCropDrag);

    patternCanvas.addEventListener('pointerdown', startGesture);
    patternCanvas.addEventListener('pointermove', moveGesture);
    patternCanvas.addEventListener('pointerup', finishGesture);
    patternCanvas.addEventListener('pointercancel', finishGesture);
    // 右键/中键拖动用于平移，屏蔽右键菜单
    patternCanvas.addEventListener('contextmenu', (event) => {
      if (state.pattern) event.preventDefault();
    });
    patternCanvas.addEventListener('wheel', (event) => {
      if (!state.pattern) return;
      event.preventDefault();
      const rect = patternCanvas.getBoundingClientRect();
      changeZoom(view.zoom * (event.deltaY < 0 ? 1.12 : 0.89), event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });

    new ResizeObserver(() => {
      if (state.pattern) scheduleDraw();
    }).observe(canvasStage);
  }

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */

  function init() {
    bindEvents();
    populateBrandOptions();
    selectPalette(paletteMode.value || 'MARD221');
    updateStyleDesc();
    state.sizeMode = 'ratio';
    syncSizeModeButtons();
    updateColorCountValue();
    syncColorPresetButtons();
    updateMinColorCount();
    updateBeadSetHint();
    updateBeadSizeFromCrop();
    renderReplaceSuggestions();
    renderPaintOptions();
    renderPaintPaletteOptions();
    updateExportButtons();
    updateReplacePreview();
    undoButton.disabled = true;
    setView('pattern', true);
    updateCodeCheck();
    setStatus('请先上传一张图片。');
  }

  init();
})();
