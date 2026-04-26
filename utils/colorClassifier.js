function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, v };
}

const REF_COLORS = [
  { name: 'U', h: 55,  s: 0.82, v: 0.92 },
  { name: 'R', h: 355, s: 0.85, v: 0.88 },
  { name: 'F', h: 225, s: 0.85, v: 0.88 },
  { name: 'D', h: 0,   s: 0.08, v: 0.95 },
  { name: 'L', h: 28,  s: 0.85, v: 0.92 },
  { name: 'B', h: 125, s: 0.80, v: 0.88 }
];

function hsvDistance(h1, s1, v1, h2, s2, v2) {
  let dh = Math.abs(h1 - h2);
  dh = Math.min(dh, 360 - dh);
  const ds = s1 - s2;
  const dv = v1 - v2;
  return Math.sqrt(
    (dh / 180) * (dh / 180) * 8.0 +
    ds * ds * 2.5 +
    dv * dv * 0.5
  );
}

function classifyByDistance(h, s, v) {
  if (v < 0.18) return '?';

  let bestName = null;
  let bestDist = Infinity;
  let secondDist = Infinity;

  for (const ref of REF_COLORS) {
    const dist = hsvDistance(h, s, v, ref.h, ref.s, ref.v);
    if (dist < bestDist) { secondDist = bestDist; bestDist = dist; bestName = ref.name; }
    else if (dist < secondDist) secondDist = dist;
  }

  const margin = bestDist / (secondDist || 1);
  if (bestName !== 'D' && margin > 0.85 && secondDist < 1.2) return '?';
  if (bestDist > 2.0) return '?';

  return bestName;
}

/**
 * Sample a square region and return trimmed-mean RGB.
 * @param {number} discardRatio Fraction to discard from each end of brightness sort (default 0.10)
 */
function sampleRegion(imageData, width, height, cx, cy, radius, discardRatio) {
  if (discardRatio === undefined) discardRatio = 0.10;
  const d = imageData;
  const x0 = Math.max(0, cx - radius);
  const y0 = Math.max(0, cy - radius);
  const x1 = Math.min(width - 1, cx + radius);
  const y1 = Math.min(height - 1, cy + radius);

  const pixels = [];
  for (let y = y0; y <= y1; y++) {
    const rowOff = y * width * 4;
    for (let x = x0; x <= x1; x++) {
      const i = rowOff + x * 4;
      pixels.push({ r: d[i], g: d[i+1], b: d[i+2], l: d[i] + d[i+1] + d[i+2] });
    }
  }

  if (pixels.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  pixels.sort((a, b) => a.l - b.l);
  const discard = Math.max(1, Math.floor(pixels.length * discardRatio));
  const core = pixels.slice(discard, pixels.length - discard);

  let sumR = 0, sumG = 0, sumB = 0;
  for (const p of core) { sumR += p.r; sumG += p.g; sumB += p.b; }
  const n = core.length;

  return { r: Math.round(sumR / n), g: Math.round(sumG / n), b: Math.round(sumB / n) };
}

function classifyColor(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  return classifyByDistance(h, s, v);
}

// ---------- OLD (kept for backward compat) ----------

function classifyWithReferences(r, g, b, references) {
  const sampleHsv = rgbToHsv(r, g, b);
  const whiteRef = references.find(ref => ref.name === 'D');
  const nonWhiteRefs = references.filter(ref => ref.name !== 'D');

  if (sampleHsv.s < 0.4) {
    if (!whiteRef) return '?';
    const whiteHsv = rgbToHsv(whiteRef.r, whiteRef.g, whiteRef.b);
    const dist = hsvDistance(sampleHsv.h, sampleHsv.s, sampleHsv.v, whiteHsv.h, whiteHsv.s, whiteHsv.v);
    return dist < 2.0 ? 'D' : '?';
  } else {
    let bestName = '?';
    let bestDist = Infinity;
    for (const ref of nonWhiteRefs) {
      const refHsv = rgbToHsv(ref.r, ref.g, ref.b);
      const dist = hsvDistance(sampleHsv.h, sampleHsv.s, sampleHsv.v, refHsv.h, refHsv.s, refHsv.v);
      if (dist < bestDist) { bestDist = dist; bestName = ref.name; }
    }
    return bestDist < 2.2 ? bestName : '?';
  }
}

// ---------- NEW continuous-weight classifier ----------

/**
 * Classify using continuous white-likelihood weighting.
 * referencesHsv: [{ name: 'U'|'R'|'F'|'D'|'L'|'B', h, s, v }, ...]
 */
function classifyWithReferencesHsv(r, g, b, referencesHsv) {
  const sample = rgbToHsv(r, g, b);

  // white_likelihood: 0=saturated colour, 1=pure grey
  const whiteLikelihood = Math.max(0, Math.min(1, (0.6 - sample.s) / 0.6));

  let bestName = '?';
  let bestDist = Infinity;
  let secondDist = Infinity;

  for (const ref of referencesHsv) {
    let dist = hsvDistance(sample.h, sample.s, sample.v, ref.h, ref.s, ref.v);

    if (ref.name === 'D') {
      // white gets discount proportional to grey-ness of sample
      dist = dist * (1.0 - whiteLikelihood * 0.7);
    } else {
      // colourful references get slight penalty when sample is grey
      dist = dist * (1.0 + whiteLikelihood * 0.3);
    }

    if (dist < bestDist) {
      secondDist = bestDist;
      bestDist = dist;
      bestName = ref.name;
    } else if (dist < secondDist) {
      secondDist = dist;
    }
  }

  // sanity – way too far from any reference
  if (bestDist > 3.0) return '?';

  // unambiguous white
  if (bestName === 'D' && bestDist < 1.5) return 'D';

  // ambiguous boundaries for colourful candidates
  if (bestName !== 'D') {
    const ratio = bestDist / (secondDist || 1);
    if (ratio < 0.6) return bestName;          // very confident
    if (ratio < 0.8) return bestName;          // acceptably confident
    return '?';                                 // too close to call – let user decide
  }

  return bestName;
}

function _distToRef(r, g, b, name, refs) {
  const s = rgbToHsv(r, g, b);
  const ref = refs.find(x => x.name === name);
  if (!ref) return Infinity;
  return hsvDistance(s.h, s.s, s.v, ref.h, ref.s, ref.v);
}

function enforceGlobalConstraint(faces, rawColors, referencesHsv) {
  const N = ['U','R','F','D','L','B'];
  faces = faces.map(f => f.slice());
  const cnt = {}; N.forEach(n => cnt[n] = 0);
  for (let fi = 0; fi < 6; fi++)
    for (let ci = 0; ci < 9; ci++)
      if (N.includes(faces[fi][ci])) cnt[faces[fi][ci]]++;
  for (const name of N) {
    if (cnt[name] <= 9) continue;
    const cells = [];
    for (let fi = 0; fi < 6; fi++)
      for (let ci = 0; ci < 9; ci++)
        if (ci !== 4 && faces[fi][ci] === name)
          cells.push({ fi, ci, dist: _distToRef(rawColors[fi][ci].r, rawColors[fi][ci].g, rawColors[fi][ci].b, name, referencesHsv) });
    cells.sort((a, b) => b.dist - a.dist);
    for (let i = 0; i < cells.length && cnt[name] > 9; i++) {
      faces[cells[i].fi][cells[i].ci] = '?';
      cnt[name]--;
    }
  }
  return faces;
}

module.exports = {
  rgbToHsv,
  classifyColor,
  sampleRegion,
  classifyByDistance,
  classifyWithReferences,
  classifyWithReferencesHsv,
  enforceGlobalConstraint,
  REF_COLORS
};