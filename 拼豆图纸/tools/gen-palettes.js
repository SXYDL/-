// 由官方/公开色卡数据生成 bead-palettes.js
//
//   node tools/gen-palettes.js
//
// 数据来源（均已逐字节原样存放在 tools/color-sources/，可自行核对）：
//
//   * 国内品牌（MARD / COCO / 漫漫 / 盼盼 / 咪小窝 / 优肯）
//     https://github.com/HansBug/pindou-color-data
//     仓库定位为拼豆色卡数据仓库，面向其他应用提供 JSON/XLSX/PDF。
//     - mard-221.json  ← mard-221-alfonse-doudou/colors.json（MARD 221，主流参考版）
//     - mard-291.json  ← mard-291-github/colors.json
//     - coco-291.json / manman-278.json / panpan-289.json / mixiaowo-290.json
//     - artkal-c-197.json / artkal-m-221.json / artkal-418.json（优肯官方 RGB 口径）
//
//   * Hama / Perler / Artkal S
//     https://github.com/maxcleme/beadcolors（MIT）
//     - hama.csv（Hama Midi 92）/ perler.csv（Perler 103）/ artkal_s.csv（Artkal S 199）
//
// 这些品牌里只有 Hama / Perler / Artkal S 有公开色名，其余只发布色号 + 色值，
// 因此没有官方色名的色号会按实际色值生成一个中文描述名（深/浅 + 色相），
// 仅用于图例辨识，不代表品牌官方命名。

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'color-sources');

/* ------------------------------------------------------------------ *
 * 色名生成（仅用于没有官方色名的色号）
 * ------------------------------------------------------------------ */

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

const HUE_NAMES = [
  [15, '红'], [40, '橙'], [65, '黄'], [95, '黄绿'], [150, '绿'],
  [180, '青绿'], [200, '青'], [240, '蓝'], [270, '靛蓝'], [300, '紫'],
  [330, '品红'], [360, '玫红'],
];

function describeColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const { h, s, l } = rgbToHsl(r, g, b);

  if (s < 0.14) {
    if (l >= 0.93) return '近白';
    if (l >= 0.8) return '浅灰';
    if (l >= 0.65) return '灰';
    if (l >= 0.48) return '中灰';
    if (l >= 0.32) return '深灰';
    if (l >= 0.18) return '暗灰';
    return '黑';
  }

  let base = '玫红';
  for (const [limit, label] of HUE_NAMES) {
    if (h < limit) { base = label; break; }
  }
  if (l >= 0.9) return `极浅${base}`;
  if (l >= 0.78) return `浅${base}`;
  if (l >= 0.64) return `淡${base}`;
  if (l >= 0.46) return base;
  if (l >= 0.34) return `深${base}`;
  if (l >= 0.22) return `暗${base}`;
  return `墨${base}`;
}

/* ------------------------------------------------------------------ *
 * 读取来源
 * ------------------------------------------------------------------ */

// 统一成 { code, name, hex }：去掉 8 位 HEX 的 alpha（透明材质取基底色），色值统一大写
function normalize(hex) {
  const value = String(hex).trim().replace(/^#/, '').toUpperCase();
  const rgb = value.slice(0, 6).padEnd(6, '0');
  if (!/^[0-9A-F]{6}$/.test(rgb)) throw new Error(`非法色值: ${hex}`);
  return `#${rgb}`;
}

// HansBug/pindou-color-data: { colors: [{ code, hex, rgb }] }
function readPaletteJson(file) {
  const data = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8'));
  return data.colors.map((entry) => {
    const hex = normalize(entry.hex);
    return { code: String(entry.code), name: describeColor(hex), hex };
  });
}

// maxcleme/beadcolors: code,name,r,g,b,contributor（带官方英文色名）
function readPaletteCsv(file) {
  return fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(','))
    .map(([code, name, r, g, b]) => {
      const hex = normalize(
        [r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join(''),
      );
      return { code: String(code).trim(), name: String(name).trim() || describeColor(hex), hex };
    });
}

/* ------------------------------------------------------------------ *
 * 色卡定义：key -> 显示名 / 来源文件
 * ------------------------------------------------------------------ */

const PALETTES = [
  { key: 'MARD221', label: 'MARD 221 标准版', file: 'mard-221.json', read: readPaletteJson },
  { key: 'MARD291', label: 'MARD 291', file: 'mard-291.json', read: readPaletteJson },
  { key: 'Hama', label: 'Hama 92', file: 'hama.csv', read: readPaletteCsv },
  { key: 'Perler', label: 'Perler 103', file: 'perler.csv', read: readPaletteCsv },
  { key: 'COCO', label: 'COCO 291', file: 'coco-291.json', read: readPaletteJson },
  { key: 'Manman', label: '漫漫 278', file: 'manman-278.json', read: readPaletteJson },
  { key: 'Panpan', label: '盼盼 289', file: 'panpan-289.json', read: readPaletteJson },
  { key: 'Mixiaowo', label: '咪小窝 290', file: 'mixiaowo-290.json', read: readPaletteJson },
  { key: 'ArtkalC197', label: '优肯 C 197', file: 'artkal-c-197.json', read: readPaletteJson },
  { key: 'ArtkalM221', label: '优肯 M 221', file: 'artkal-m-221.json', read: readPaletteJson },
  { key: 'Artkal418', label: '优肯 418', file: 'artkal-418.json', read: readPaletteJson },
  { key: 'ArtkalS199', label: 'Artkal S 199', file: 'artkal_s.csv', read: readPaletteCsv },
];

function build() {
  const palettes = {};
  const problems = [];

  for (const entry of PALETTES) {
    let colors = entry.read(entry.file);

    const seen = new Set();
    colors.forEach((color, index) => {
      if (seen.has(color.code)) problems.push(`${entry.key}: 重复色号 ${color.code}`);
      seen.add(color.code);
      if (color.name === color.code) problems.push(`${entry.key}: ${color.code} 缺少色名`);
      if (colors.length > 400 && index === 0) { /* noop */ }
    });

    if (!colors.length) problems.push(`${entry.key}: 没有读到颜色`);
    palettes[entry.key] = colors;
  }

  return { palettes, problems };
}

const { palettes, problems } = build();

const body = Object.entries(palettes)
  .map(([key, colors]) => {
    const rows = colors
      .map((c) => `    { code: ${JSON.stringify(c.code)}, name: ${JSON.stringify(c.name)}, hex: ${JSON.stringify(c.hex)} },`)
      .join('\n');
    return `  ${key}: [\n${rows}\n  ],`;
  })
  .join('\n');

const out = `/* 拼豆色卡数据：色号 -> 色值。由 tools/gen-palettes.js 从 tools/color-sources/ 生成，请勿手改。
 * 数据来源见 tools/gen-palettes.js 头部注释。 */
window.BEAD_PALETTES = {
${body}
};
`;

const target = path.join(__dirname, '..', 'bead-palettes.js');
fs.writeFileSync(target, out, 'utf8');

console.log('written', target, `${(out.length / 1024).toFixed(1)} KB`);
for (const [key, colors] of Object.entries(palettes)) {
  const named = colors.filter((c) => /[A-Za-z]/.test(c.name)).length;
  console.log(`  ${key.padEnd(12)} ${String(colors.length).padStart(3)} 色  (官方色名 ${named} / 生成色名 ${colors.length - named})`);
}
if (problems.length) {
  console.log('\n问题:');
  problems.forEach((p) => console.log('  -', p));
  process.exitCode = 1;
}
