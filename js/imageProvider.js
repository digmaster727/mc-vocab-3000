/**
 * 像素風圖片提供器
 * - 目前：根據單字雜湊值產生 Minecraft 風格方塊 SVG（零依賴、離線可用）
 * - 預留：未來可改接 Unsplash / Pixabay API，只要替換 renderImage 實作即可
 */

const PALETTES = [
  // 草地
  { a: '#7FB040', b: '#5D8A3A', c: '#3D5E23', accent: '#C6E89A' },
  // 泥土
  { a: '#A67B4A', b: '#8B5A2B', c: '#5A3A1A', accent: '#D4A373' },
  // 石頭
  { a: '#A8A8A8', b: '#7D7D7D', c: '#5A5A5A', accent: '#DDDDDD' },
  // 鑽石
  { a: '#81D4FA', b: '#4FC3F7', c: '#0288D1', accent: '#E1F5FE' },
  // 紅石
  { a: '#FF6B6B', b: '#E44040', c: '#8B1E1E', accent: '#FFCDD2' },
  // 黃金
  { a: '#FFE066', b: '#F4C430', c: '#B8860B', accent: '#FFF8DC' },
  // 木頭
  { a: '#C49A6C', b: '#A67B4A', c: '#7D5A34', accent: '#E8CBA0' },
];

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * 生成 8x8 左右對稱像素圖 + 首字母浮水印
 * @param {string} word
 * @returns {string} SVG 字串
 */
export function renderPixelIcon(word) {
  const h = hashStr(word.toLowerCase());
  const pal = PALETTES[h % PALETTES.length];
  const rand = rng(h);
  const size = 8;
  const half = size / 2;

  let cells = '';
  const grid = [];
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < half; x++) {
      const r = rand();
      let color;
      if (y === 0 || y === size - 1) {
        color = r < 0.6 ? pal.c : pal.b;        // 上下邊深色
      } else if (r < 0.1) {
        color = pal.accent;                     // 少量高光
      } else if (r < 0.5) {
        color = pal.a;                          // 亮色
      } else if (r < 0.85) {
        color = pal.b;                          // 中間色
      } else {
        color = pal.c;                          // 陰影
      }
      grid[y][x] = color;
      grid[y][size - 1 - x] = color;            // 左右鏡像
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${grid[y][x]}"/>`;
    }
  }

  const letter = word.charAt(0).toUpperCase();
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">
    ${cells}
    <text x="${half}" y="${half + 1.4}" text-anchor="middle"
          font-size="4.2" font-family="'Press Start 2P', monospace"
          font-weight="bold" fill="#fff"
          stroke="#000" stroke-width="0.25"
          paint-order="stroke">${letter}</text>
  </svg>`;
}

/**
 * 未來要改接真實圖片 API 時，替換這個函式即可。
 * 例：return `<img src="${await fetchUnsplash(word)}" alt="${word}">`;
 */
export async function renderImage(word) {
  return renderPixelIcon(word);
}
