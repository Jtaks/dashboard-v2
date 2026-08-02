#!/usr/bin/env node
/**
 * Contrast ratios for Status / Severity tokens against Canvas and tinted fills.
 * WCAG 2.x relative luminance formula. Run: node scripts/contrast-audit.mjs
 */

const SURFACE = '#ffffff';

/** @type {Record<string, { fg: string, tintPct: number }>} */
const STATUS = {
  up: { fg: '#0f6b3a', tintPct: 12 },
  starting: { fg: '#1a5f8a', tintPct: 12 },
  degraded: { fg: '#8a5a00', tintPct: 12 },
  down: { fg: '#9b1c1c', tintPct: 12 },
  unknown: { fg: '#4a5568', tintPct: 12 },
};

/** @type {Record<string, { fg: string, tintPct: number }>} */
const SEVERITY = {
  info: { fg: '#1a5f8a', tintPct: 12 },
  success: { fg: '#0f6b3a', tintPct: 12 },
  warning: { fg: '#8a5a00', tintPct: 14 },
  error: { fg: '#9b1c1c', tintPct: 12 },
};

/**
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * @param {number} channel
 */
function srgbToLin(channel) {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {[number, number, number]} rgb
 */
function relativeLuminance(rgb) {
  return 0.2126 * srgbToLin(rgb[0]) + 0.7152 * srgbToLin(rgb[1]) + 0.0722 * srgbToLin(rgb[2]);
}

/**
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 */
function contrastRatio(a, b) {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * @param {string} fgHex
 * @param {number} pct
 * @param {string} baseHex
 */
function tintOver(fgHex, pct, baseHex = SURFACE) {
  const [fr, fg, fb] = hexToRgb(fgHex);
  const [br, bg, bb] = hexToRgb(baseHex);
  const a = pct / 100;
  return [
    Math.round(a * fr + (1 - a) * br),
    Math.round(a * fg + (1 - a) * bg),
    Math.round(a * fb + (1 - a) * bb),
  ];
}

/**
 * @param {[number, number, number]} rgb
 */
function fmt(rgb) {
  return `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * @param {string} kind
 * @param {Record<string, { fg: string, tintPct: number }>} map
 * @param {string} surfaceName
 */
function report(kind, map, surfaceName) {
  console.log(`\n## ${kind}`);
  for (const [name, { fg, tintPct }] of Object.entries(map)) {
    const tintBg = tintOver(fg, tintPct);
    const badgeOrBanner = contrastRatio(hexToRgb(fg), tintBg);
    const textOnCanvas = contrastRatio(hexToRgb(fg), hexToRgb(SURFACE));
    const aa = (r) => (r >= 4.5 ? 'AA' : 'FAIL');
    console.log(
      [
        name.padEnd(10),
        `fg ${fg}`,
        `${surfaceName} ${fmt(tintBg)}`,
        `tint ${badgeOrBanner.toFixed(2)}:${aa(badgeOrBanner)}`,
        `text ${textOnCanvas.toFixed(2)}:${aa(textOnCanvas)}`,
      ].join('  '),
    );
  }
}

report('Status (badge tint / text on Canvas)', STATUS, 'badge');
report('Severity (banner tint / text on Canvas)', SEVERITY, 'banner');
