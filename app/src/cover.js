// Vice Cover Studio v2 — cover rendering engine (pure canvas, no network).
// Draws GTA-style multi-panel poster covers from any photos: six layouts,
// five Vice City grades, a layered procedural skyline with lit windows and
// neon signs, palm silhouettes, a halftone title block, grain + vignette.
// Everything is deterministic: all randomness comes from a seeded RNG built
// from the title + layout + grade, so the same state always renders the
// same bytes (double-run identical).
export const LAYOUTS = ['poster', 'grid', 'tilted', 'hero', 'split', 'strip'];
export const GRADES = ['sunset', 'neon', 'miami', 'noir', 'vice'];
export const SIZES = ['1080x1080', '1080x1350', '1920x1080', '1080x1920'];

export const SAMPLE_PHOTOS = [
  { name: 'boulevard', file: 'samples/boulevard.jpg', label: 'Boulevard' },
  { name: 'pier', file: 'samples/pier.jpg', label: 'Pier' },
  { name: 'neon-street', file: 'samples/neon-street.png', label: 'Neon Street' },
  { name: 'rooftop-dusk', file: 'samples/rooftop-dusk.png', label: 'Rooftop Dusk' },
];

// ---------- deterministic randomness ----------
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- photo loading ----------
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('cannot load ' + src));
    img.src = src;
  });
}
export async function loadSamplePhotos() {
  const out = [];
  for (const s of SAMPLE_PHOTOS) {
    try { out.push({ ...s, img: await loadImage(s.file) }); }
    catch (e) { /* a missing sample is skipped, the rest still work */ }
  }
  return out;
}

// ---------- drawing helpers ----------
// Shrink the font until the text fits maxW; sets ctx.font, returns the size.
export function fitFont(ctx, text, basePx, family, maxW, weight = '') {
  let px = basePx;
  ctx.font = weight ? `${weight} ${px}px ${family}` : `${px}px ${family}`;
  while (px > 12 && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = weight ? `${weight} ${px}px ${family}` : `${px}px ${family}`;
  }
  return px;
}

// Cover-fit draw of img into rect, with a crop {zoom, ox, oy} (ox/oy in -1..1).
export function drawPhoto(ctx, img, x, y, w, h, crop = {}) {
  const zoom = crop.zoom ?? 1, ox = crop.ox ?? 0, oy = crop.oy ?? 0;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale, dh = ih * scale;
  const dx = x + (w - dw) / 2 - ox * Math.max(0, dw - w) / 2;
  const dy = y + (h - dh) / 2 - oy * Math.max(0, dh - h) / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// One palm silhouette: curved trunk + 7 fronds.
export function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.12, y - s * 0.55, x + s * 0.05, y - s);
  ctx.stroke();
  const tx = x + s * 0.05, ty = y - s;
  for (let f = 0; f < 7; f++) {
    const a = (-0.1 - f * 0.26) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(
      tx + Math.cos(a) * s * 0.45, ty + Math.sin(a) * s * 0.32 + s * 0.08,
      tx + Math.cos(a) * s * 0.85, ty + Math.sin(a) * s * 0.5 + s * 0.22,
    );
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    ctx.stroke();
  }
  ctx.restore();
}

// Layered Vice City skyline with lit windows + neon signs, clipped to a rect.
export function drawSkyline(ctx, x, y, w, h, seed, palette) {
  const R = mulberry32(seed);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, palette.sky[0]); sky.addColorStop(1, palette.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  const gx = x + w * 0.68, gy = y + h * 0.42, gr = h * 0.9;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  glow.addColorStop(0, palette.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(x, y, w, h);
  const layers = [
    { hMin: 0.34, hMax: 0.55, col: palette.far, win: 0 },
    { hMin: 0.5, hMax: 0.75, col: palette.mid, win: 0.22 },
    { hMin: 0.66, hMax: 0.95, col: palette.near, win: 0.4 },
  ];
  for (const L of layers) {
    let bx = x - 10;
    while (bx < x + w) {
      const bw = w * (0.05 + R() * 0.09);
      const bh = h * (L.hMin + R() * (L.hMax - L.hMin));
      const by = y + h - bh;
      ctx.fillStyle = L.col;
      ctx.fillRect(bx, by, bw, bh);
      if (R() < 0.3) { ctx.fillRect(bx + bw / 2 - 1, by - h * 0.08, 2, h * 0.08); }
      if (L.win > 0) {
        const ww = Math.max(3, w * 0.008), wh = Math.max(4, h * 0.03);
        for (let wy = by + h * 0.05; wy < y + h - wh - 2; wy += wh * 2.1) {
          for (let wx = bx + 4; wx < bx + bw - ww - 2; wx += ww * 2.1) {
            if (R() < L.win) {
              ctx.fillStyle = R() < 0.65 ? 'rgba(255,196,90,0.95)' : 'rgba(120,225,255,0.9)';
              ctx.fillRect(wx, wy, ww, wh);
            }
          }
        }
      }
      if (L === layers[2] && R() < 0.55) {
        const sw = bw * (0.5 + R() * 0.3), sh = Math.max(4, h * 0.07);
        const sx = bx + (bw - sw) / 2, sy = by + h * 0.06;
        const signCol = palette.signs[Math.floor(R() * palette.signs.length)];
        ctx.save();
        ctx.shadowColor = signCol; ctx.shadowBlur = h * 0.12;
        ctx.fillStyle = signCol;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.restore();
      }
      bx += bw + w * 0.012;
    }
  }
  drawPalm(ctx, x + w * 0.04, y + h, h * 0.55, palette.near);
  drawPalm(ctx, x + w * 0.96, y + h, h * 0.48, palette.near);
  ctx.restore();
}

// Halftone dot field, dots grow toward the bottom of the rect.
export function drawHalftone(ctx, x, y, w, h, color, gap) {
  ctx.save();
  ctx.fillStyle = color;
  const rows = Math.floor(h / gap), cols = Math.floor(w / gap);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = (r + 1) / rows;
      const rad = gap * 0.12 + gap * 0.26 * t * t;
      ctx.beginPath();
      ctx.arc(x + c * gap + gap / 2, y + r * gap + gap / 2, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Film grain via a small tiled noise pattern (fast at poster sizes).
let noisePattern = null;
export function drawGrain(ctx, w, h, amount = 0.06) {
  if (!noisePattern) {
    const n = document.createElement('canvas');
    n.width = 160; n.height = 160;
    const nctx = n.getContext('2d');
    const img = nctx.createImageData(160, 160);
    const R = mulberry32(424242);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.floor((R() - 0.5) * 90);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    noisePattern = ctx.createPattern(n, 'repeat');
  }
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = noisePattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawVignette(ctx, w, h, strength = 0.42) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.36,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
}

// ---------- grades ----------
export const GRADE_DEFS = {
  sunset: {
    sky: ['#ff9a3d', '#e84393'], glow: 'rgba(255,190,90,0.85)',
    far: '#5a2a52', mid: '#3a1a3e', near: '#160a24',
    signs: ['#ff2d78', '#00e5d4', '#ffb347'],
    tint: 'rgba(255,110,40,0.16)', tintMode: 'overlay',
  },
  neon: {
    sky: ['#12082e', '#3d0a4e'], glow: 'rgba(255,45,120,0.7)',
    far: '#2a1145', mid: '#1c0a30', near: '#0b0518',
    signs: ['#ff2d78', '#00e5d4', '#ff5ce1'],
    tint: 'rgba(0,229,212,0.14)', tintMode: 'overlay',
  },
  miami: {
    sky: ['#7de3f0', '#ff8fb3'], glow: 'rgba(255,240,170,0.8)',
    far: '#7a5a8a', mid: '#54386a', near: '#241433',
    signs: ['#ff2d78', '#00c8b8', '#ffd166'],
    tint: 'rgba(255,140,180,0.12)', tintMode: 'soft-light',
  },
  noir: {
    sky: ['#3a3a44', '#0c0c12'], glow: 'rgba(255,255,255,0.45)',
    far: '#2e2e38', mid: '#1b1b22', near: '#08080c',
    signs: ['#ff2d78', '#f5f5f5', '#ffd166'],
    tint: 'rgba(0,0,0,0.28)', tintMode: 'multiply',
  },
  vice: {
    sky: ['#b565ff', '#ff5e62'], glow: 'rgba(255,120,220,0.8)',
    far: '#4a2560', mid: '#301640', near: '#12081e',
    signs: ['#c86bff', '#00e5d4', '#ff2d78'],
    tint: 'rgba(181,101,255,0.15)', tintMode: 'overlay',
  },
};

// ---------- layout geometry (pixel rects) ----------
function margins(W, H) {
  const u = Math.min(W, H);
  return { m: Math.round(u * 0.022), g: Math.round(u * 0.012) };
}
// Centre cell of the 3x3 grid (the title block).
export function gridTitleRect(W, H) {
  const { m, g } = margins(W, H);
  const cell = Math.floor((Math.min(W, H) - 2 * m - 2 * g) / 3);
  const ox = Math.round((W - (3 * cell + 2 * g)) / 2);
  const oy = Math.round((H - (3 * cell + 2 * g)) / 2);
  return { x: ox + cell + g, y: oy + cell + g, w: cell, h: cell };
}
export function layoutSlots(layout, W, H) {
  const { m, g } = margins(W, H);
  switch (layout) {
    case 'poster': {
      const sw = (W - 2 * m - 2 * g) / 3;
      return [
        { x: m, y: m, w: W - 2 * m, h: H * 0.52 },
        { x: m, y: H * 0.56, w: sw, h: H * 0.14 },
        { x: m + sw + g, y: H * 0.56, w: sw, h: H * 0.14 },
        { x: m + 2 * (sw + g), y: H * 0.56, w: sw, h: H * 0.14 },
      ];
    }
    case 'grid': {
      const cell = Math.floor((Math.min(W, H) - 2 * m - 2 * g) / 3);
      const ox = Math.round((W - (3 * cell + 2 * g)) / 2);
      const oy = Math.round((H - (3 * cell + 2 * g)) / 2);
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        if (r === 1 && c === 1) continue;
        out.push({ x: ox + c * (cell + g), y: oy + r * (cell + g), w: cell, h: cell });
      }
      return out;
    }
    case 'tilted': return [
      { x: 0, y: 0, w: W, h: H },
      { x: W * 0.06, y: H * 0.34, w: W * 0.3, h: H * 0.4 },
      { x: W * 0.36, y: H * 0.28, w: W * 0.3, h: H * 0.4 },
      { x: W * 0.64, y: H * 0.36, w: W * 0.3, h: H * 0.4 },
    ];
    case 'hero': return [{ x: 0, y: 0, w: W, h: H }];
    case 'split': {
      const cw = (W - 2 * m - g) / 2;
      return [
        { x: m, y: m, w: cw, h: H * 0.34 },
        { x: m + cw + g, y: m, w: cw, h: H * 0.34 },
        { x: m, y: H * 0.38, w: cw, h: H * 0.34 },
        { x: m + cw + g, y: H * 0.38, w: cw, h: H * 0.34 },
      ];
    }
    case 'strip': {
      const sw = (W - 2 * m - 2 * g) / 3;
      return [
        { x: m, y: m, w: sw, h: H * 0.7 },
        { x: m + sw + g, y: m, w: sw, h: H * 0.7 },
        { x: m + 2 * (sw + g), y: m, w: sw, h: H * 0.7 },
      ];
    }
    default: return [{ x: 0, y: 0, w: W, h: H }];
  }
}
export function slotCount(layout) { return layoutSlots(layout, 100, 100).length; }

// Ink a photo panel like poster art: white keyline.
function inkPanel(ctx, x, y, w, h, lineW) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = lineW;
  ctx.strokeRect(x + lineW / 2, y + lineW / 2, w - lineW, h - lineW);
  ctx.restore();
}

function drawStarsAndRibbon(ctx, W, H, opts, x, y, w, h) {
  if (opts.heat > 0) {
    ctx.save();
    ctx.font = `${Math.max(10, h * 0.14)}px sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('★'.repeat(opts.heat) + '☆'.repeat(Math.max(0, 5 - opts.heat)), x + w * 0.02, y + h * 0.16);
    ctx.restore();
  }
  if (opts.ribbon) {
    ctx.save();
    ctx.translate(x + w * 0.94, y + h * 0.14);
    ctx.rotate(-0.1);
    ctx.fillStyle = '#ff2d78';
    const rw = Math.max(30, w * 0.16), rh = Math.max(12, h * 0.2);
    ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.max(9, rh * 0.5)}px "Arial Black", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opts.ribbon.toUpperCase(), 0, 1);
    ctx.restore();
  }
}

// Smart default crop for a slot: very wide slots show the top of the photo
// (where faces usually are) instead of the middle band; other slots centre.
export function smartCrop(slot) {
  const aspect = slot.w / Math.max(1, slot.h);
  return { zoom: 1, ox: 0, oy: aspect > 1.8 ? -0.55 : 0 };
}

function drawTitleBlock(ctx, x, y, w, h, o, grade, bgAlpha = 0.92) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = `rgba(10,6,20,${bgAlpha})`;
  ctx.fillRect(x, y, w, h);
  drawHalftone(ctx, x, y + h * 0.55, w, h * 0.45, 'rgba(255,45,120,0.28)', Math.max(7, h * 0.055));
  fitFont(ctx, o.title, h * 0.52, 'Anton, "Arial Black", sans-serif', w * 0.86, '400');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (grade === 'neon' || grade === 'vice') {
    ctx.shadowColor = '#ff2d78'; ctx.shadowBlur = h * 0.09;
  } else if (bgAlpha < 0.9) {
    // translucent band over a bright skyline: keep the title readable
    ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = h * 0.05;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(o.title.toUpperCase(), x + w / 2, y + h * 0.34);
  ctx.shadowBlur = 0;
  fitFont(ctx, o.subtitle, h * 0.2, 'Pacifico, cursive', w * 0.7);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(o.subtitle, x + w / 2, y + h * 0.72);
  ctx.restore();
  drawStarsAndRibbon(ctx, 0, 0, o, x, y, w, h);
}

// ---------- the cover ----------
// opts: { photos: [{img}], assignments: [{photo, zoom, ox, oy}] (slot order),
//         layout, grade, title, subtitle, ribbon, heat, grain, vignette }
// Returns { slots } with the slot rects in pixels (for editor hit-testing).
export function renderCover(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const grade = GRADE_DEFS[opts.grade] || GRADE_DEFS.sunset;
  const seed = hashStr(`${opts.title}|${opts.layout}|${opts.grade}`);
  const slots = layoutSlots(opts.layout, W, H);
  const lineW = Math.max(2, W * 0.003);

  ctx.save();
  ctx.fillStyle = '#0d0b14';
  ctx.fillRect(0, 0, W, H);

  const photoAt = (slotIdx) => {
    const a = (opts.assignments || [])[slotIdx];
    const n = Math.max(1, opts.photos.length);
    const pi = a ? a.photo : slotIdx % n;
    return { photo: opts.photos[((pi % n) + n) % n], crop: a || {} };
  };

  if (opts.layout === 'tilted') {
    const bg = photoAt(0);
    if (bg.photo) drawPhoto(ctx, bg.photo.img, 0, 0, W, H, bg.crop);
    ctx.fillStyle = 'rgba(8,4,18,0.45)'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = grade.tintMode;
    ctx.fillStyle = grade.tint; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const tilts = [-0.11, 0.06, -0.05];
    for (let i = 1; i < 4; i++) {
      const s = slots[i];
      const p = photoAt(i);
      ctx.save();
      ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
      ctx.rotate(tilts[i - 1]);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = W * 0.02; ctx.shadowOffsetY = H * 0.01;
      ctx.fillStyle = '#f8f4ec';
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h + H * 0.05);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if (p.photo) drawPhoto(ctx, p.photo.img, -s.w / 2 + s.w * 0.04, -s.h / 2 + s.h * 0.04, s.w * 0.92, s.h * 0.84, p.crop);
      ctx.restore();
    }
    fitFont(ctx, opts.title, H * 0.11, 'Anton, "Arial Black", sans-serif', W * 0.6, '400');
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = '#ff2d78'; ctx.shadowBlur = H * 0.02;
    ctx.fillStyle = '#fff';
    ctx.fillText(opts.title.toUpperCase(), W * 0.05, H * 0.14);
    ctx.shadowBlur = 0;
    ctx.font = `${H * 0.045}px Pacifico, cursive`;
    ctx.fillStyle = '#ffd166';
    ctx.fillText(opts.subtitle, W * 0.05, H * 0.2);
    ctx.restore();
    drawStarsAndRibbon(ctx, W, H, opts, W * 0.78, H * 0.82, W * 0.2, H * 0.1);
  } else if (opts.layout === 'grid') {
    const t = gridTitleRect(W, H);
    let si = 0;
    for (const s of slots) {
      const p = photoAt(si++);
      if (p.photo) drawPhoto(ctx, p.photo.img, s.x, s.y, s.w, s.h, p.crop);
      inkPanel(ctx, s.x, s.y, s.w, s.h, lineW);
    }
    ctx.save();
    ctx.fillStyle = 'rgba(10,6,20,0.95)';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    drawHalftone(ctx, t.x, t.y + t.h * 0.5, t.w, t.h * 0.5, 'rgba(255,45,120,0.3)', Math.max(6, t.h * 0.06));
    fitFont(ctx, opts.title, t.h * 0.24, 'Anton, "Arial Black", sans-serif', t.w * 0.9, '400');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(opts.title.toUpperCase(), t.x + t.w / 2, t.y + t.h * 0.38);
    ctx.font = `${t.h * 0.11}px Pacifico, cursive`;
    ctx.fillStyle = '#ffd166';
    ctx.fillText(opts.subtitle, t.x + t.w / 2, t.y + t.h * 0.68);
    ctx.restore();
    inkPanel(ctx, t.x, t.y, t.w, t.h, lineW);
  } else if (opts.layout === 'hero') {
    const p = photoAt(0);
    if (p.photo) drawPhoto(ctx, p.photo.img, 0, 0, W, H, p.crop);
    ctx.save();
    ctx.globalCompositeOperation = grade.tintMode;
    ctx.fillStyle = grade.tint; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const scrim = ctx.createLinearGradient(0, H * 0.45, 0, H);
    scrim.addColorStop(0, 'rgba(5,2,12,0)'); scrim.addColorStop(1, 'rgba(5,2,12,0.82)');
    ctx.fillStyle = scrim; ctx.fillRect(0, H * 0.45, W, H * 0.55);
    fitFont(ctx, opts.title, H * 0.16, 'Anton, "Arial Black", sans-serif', W * 0.88, '400');
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = '#ff2d78'; ctx.shadowBlur = H * 0.02;
    ctx.fillStyle = '#fff';
    ctx.fillText(opts.title.toUpperCase(), W * 0.05, H * 0.88);
    ctx.shadowBlur = 0;
    ctx.font = `${H * 0.05}px Pacifico, cursive`;
    ctx.fillStyle = '#ffd166';
    ctx.fillText(opts.subtitle, W * 0.05, H * 0.95);
    ctx.restore();
    drawStarsAndRibbon(ctx, W, H, opts, W * 0.03, H * 0.02, W * 0.3, H * 0.08);
  } else {
    // poster / split / strip: photos on top, skyline + title band at bottom
    const bandY = opts.layout === 'poster' ? 0.73 : 0.75;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const p = photoAt(i);
      if (p.photo) drawPhoto(ctx, p.photo.img, s.x, s.y, s.w, s.h, p.crop);
      inkPanel(ctx, s.x, s.y, s.w, s.h, lineW);
    }
    ctx.save();
    ctx.globalCompositeOperation = grade.tintMode;
    ctx.fillStyle = grade.tint; ctx.fillRect(0, 0, W, bandY * H);
    ctx.restore();
    const by = bandY * H, bh = H - by;
    drawSkyline(ctx, 0, by, W, bh, seed ^ 0x9e3779b9, grade);
    ctx.fillStyle = 'rgba(8,4,16,0.35)';
    ctx.fillRect(0, by, W, bh);
    // translucent title band: the skyline stays visible behind the lettering
    drawTitleBlock(ctx, 0, by, W, bh, opts, opts.grade, 0.45);
  }

  if (opts.grain !== false) drawGrain(ctx, W, H, 0.06);
  if (opts.vignette !== false) drawVignette(ctx, W, H, 0.42);
  ctx.restore();
  return { slots };
}
