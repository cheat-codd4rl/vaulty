/* Helpers ported from the prototype */

export function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function fmtDate(d) {
  if (!d) return 'Date not set';
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return d;
  }
}

export function fmtBytes(n) {
  if (!n) return '';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export function svgDataUrl(svg) {
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export const PLACEHOLDER_HEIC = svgDataUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360'><rect width='100%' height='100%' fill='#242A34'/><circle cx='240' cy='150' r='30' fill='none' stroke='#C9A15A' stroke-width='3'/><text x='50%' y='240' font-family='monospace' font-size='24' fill='#C9A15A' text-anchor='middle'>HEIC</text><text x='50%' y='266' font-family='sans-serif' font-size='13' fill='#9B9587' text-anchor='middle'>converts to JPEG on delivery</text></svg>`
);

export const PLACEHOLDER_VIDEO = svgDataUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360'><rect width='100%' height='100%' fill='#1B1F26'/><polygon points='210,140 210,220 275,180' fill='#C9A15A'/></svg>`
);

export const PLACEHOLDER_GENERIC = svgDataUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360'><rect width='100%' height='100%' fill='#242A34'/><text x='50%' y='50%' font-family='sans-serif' font-size='14' fill='#9B9587' text-anchor='middle'>Preview unavailable</text></svg>`
);
