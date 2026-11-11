const SUFFIX = ['', 'K', 'M', 'B', 'T'];

export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
  let tier = Math.floor(Math.log10(n) / 3);
  let scaled = n / Math.pow(10, tier * 3);
  if (scaled >= 999.5) { tier++; scaled /= 1000; }
  let suffix;
  if (tier < SUFFIX.length) suffix = SUFFIX[tier];
  else {
    const i = tier - SUFFIX.length;
    suffix = String.fromCharCode(97 + Math.floor(i / 26) % 26) + String.fromCharCode(97 + (i % 26));
  }
  return scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0) + suffix;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
