/**
 * WCAG contrast ratios for status/severity tokens (audit helper).
 * Run: node scripts/measure-contrast.mjs
 */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lin(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function lum(hex) {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg, bg) {
  const l1 = lum(fg);
  const l2 = lum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const page = '#ffffff';

const status = {
  up: { fg: '#1b5e20', bg: '#e8f5e9', border: '#388e3c', text: '#1b5e20' },
  starting: { fg: '#0d47a1', bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
  degraded: { fg: '#c43e00', bg: '#fff3e0', border: '#c43e00', text: '#c43e00' },
  down: { fg: '#b71c1c', bg: '#ffebee', border: '#d32f2f', text: '#b71c1c' },
  unknown: { fg: '#424242', bg: '#f5f5f5', border: '#757575', text: '#424242' },
};

const severity = {
  info: { fg: '#1a1a1a', bg: '#e3f2fd', border: '#1565c0', text: '#1565c0' },
  success: { fg: '#1a1a1a', bg: '#e8f5e9', border: '#2e7d32', text: '#2e7d32' },
  warning: { fg: '#1a1a1a', bg: '#fff3e0', border: '#c43e00', text: '#c43e00' },
  error: { fg: '#1a1a1a', bg: '#ffebee', border: '#c62828', text: '#c62828' },
};

console.log('Status tokens');
for (const [name, t] of Object.entries(status)) {
  console.log(
    JSON.stringify({
      status: name,
      badgeFgOnBg: contrast(t.fg, t.bg).toFixed(2),
      badgeBorderOnBg: contrast(t.border, t.bg).toFixed(2),
      textOnPage: contrast(t.text, page).toFixed(2),
    }),
  );
}

console.log('Severity tokens');
for (const [name, t] of Object.entries(severity)) {
  console.log(
    JSON.stringify({
      severity: name,
      bannerFgOnBg: contrast(t.fg, t.bg).toFixed(2),
      bannerBorderOnBg: contrast(t.border, t.bg).toFixed(2),
      textOnPage: contrast(t.text, page).toFixed(2),
    }),
  );
}
