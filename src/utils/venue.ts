// FILE: src/utils/venue.ts

export function getCanonicalVenue(venueStr: string | undefined | null): string {
  if (!venueStr || !venueStr.trim()) return 'Other / Unspecified';

  const raw = venueStr.trim();
  const lower = raw.toLowerCase();

  // Pattern checks for major venues:
  if (lower.includes('siggraph asia')) return 'SIGGRAPH Asia';
  if (lower.includes('siggraph')) return 'SIGGRAPH';
  if (lower.includes('cvpr')) return 'CVPR';
  if (lower.includes('eurographics')) return 'Eurographics';
  if (lower.includes('ra-l') && lower.includes('icra')) return 'RA-L & ICRA';
  if (lower.includes('robotics and automation letters') || lower.includes('ra-l')) return 'RA-L';
  if (lower.includes('icra')) return 'ICRA';
  if (lower.includes('iros')) return 'IROS';
  if (lower.includes('corl')) return 'CoRL';
  if (lower.includes('rss')) return 'RSS';
  if (lower.includes('eccv')) return 'ECCV';
  if (lower.includes('iccv')) return 'ICCV';
  if (lower.includes('iclr')) return 'ICLR';
  if (lower.includes('neurips')) return 'NeurIPS';
  if (/\bsca\b/i.test(raw) || lower.includes('symposium on computer animation')) return 'SCA';
  if (lower.includes('wacv')) return 'WACV';
  if (lower.includes('wafr')) return 'WAFR';
  if (lower.includes('plos computational biology')) return 'PLOS Computational Biology';
  if (lower.includes('plos one')) return 'PLOS ONE';
  if (lower.includes('biorxiv')) return 'bioRxiv';
  if (lower.includes('arxiv')) return 'arXiv';
  if (lower.includes('l4dc') || lower.includes('learning for dynamics and control')) return 'L4DC';
  if (lower.includes('tvcg') || lower.includes('transactions on computer graphics')) return 'TVCG';
  if (lower.includes('motion in games')) return 'Motion in Games';
  if (lower.includes('ieee transactions on robotics') || lower.includes('t-ro')) return 'IEEE Transactions on Robotics';

  // Fallback cleanup: remove 4-digit years, prefixes, brackets/commas
  let cleaned = raw
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/^(acm|ieee|proceedings of)\s+/i, '')
    .replace(/[\(\),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return raw;

  return cleaned;
}
