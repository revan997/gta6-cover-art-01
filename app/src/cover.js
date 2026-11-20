// Vice Cover Studio — cover renderer. Every pixel is drawn on a canvas here:
// panel layouts, gradient-map colour grades, a procedural Vice sunset (sky, sun,
// skyline, palm silhouettes), the halftone title block, badge ribbon, star heat
// meter, film grain and vignette. No image leaves the machine; no network.

export const GRADES = {
  sunset: {
    label: 'Sunset', note: 'orange dusk',
    sky: ['#2b1055', '#c62b6d', '#ff7a3d', '#ffb347'],
    sun: '#ffd76a', accent: '#ff2e88', wash: '#ff7a3d', deep: '#1c0a33',
  },
  neon: {
    label: 'Neon Vice', note: 'magenta + cyan',
    sky: ['#0b1035', '#4a1d8f', '#b31d7e', '#ff2e88'],
    sun: '#2ee6ff', accent: '#ff2e88', wash: '#7b2ff7', deep: '#0a0620',
  },
  heat: {
    label: 'Heat', note: 'red-hot chase',
    sky: ['#1a0505', '#7a0e0e', '#ff3d00', '#ffc400'],
    sun: '#fff3b0', accent: '#ff3d00', wash: '#ff6a00', deep: '#160404',
  },
  palm: {
    label: 'Palm Teal', note: 'tropical teal',
    sky: ['#062a33', '#0e6b6b', '#3fb8a6', '#a8e063'],
    sun: '#ffe9a8', accent: '#2ee6a8', wash: '#0e7c7b', deep: '#04141a',
  },
  noir: {
    label: 'Noir', note: 'silver night',
    sky: ['#07070c', '#232336', '#4d4d66', '#8a8a9e'],
    sun: '#e8e8f0', accent: '#c9c9de', wash: '#5a5a72', deep: '#050508',
  },
};

// Each layout is a list of panels. A panel is {x, y, w, h} in fractions of the
// frame, plus an optional rotation in degrees (tilted snapshots). Slots are
// shared across layouts: slot i always holds the same photo and crop, so
// switching layouts never loses a crop.
export const LAYOUTS = {
  hero: {
    label: 'Hero + 3', note: 'one big, three small',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 1 / 3, h: 0.38 },
      { x: 1 / 3, y: 0.62, w: 1 / 3, h: 0.38 },
      { x: 2 / 3, y: 0.62, w: 1 / 3, h: 0.38 },
    ],
  },
  fullbleed: {
    label: 'Full-bleed', note: 'one photo, edge to edge',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  grid4: {
    label: '4-panel grid', note: 'two by two',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  grid9: {
    label: '9-panel grid', note: 'three by three',
    panels: Array.from({ length: 9 }, (_, i) => ({
      x: (i % 3) / 3, y: Math.floor(i / 3) / 3, w: 1 / 3, h: 1 / 3,
    })),
  },
  tilted: {
    label: 'Tilted snapshots', note: 'polaroids on sunset',
    backdrop: true,
    panels: [
      { x: 0.05, y: 0.05, w: 0.58, h: 0.58, rot: -4 },
      { x: 0.58, y: 0.04, w: 0.38, h: 0.34, rot: 5 },
      { x: 0.5, y: 0.42, w: 0.46, h: 0.4, rot: -3 },
    ],
  },
  story: {
    label: 'Story stack', note: 'three tall strips',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.34 },
      { x: 0, y: 0.34, w: 1, h: 0.33 },
      { x: 0, y: 0.67, w: 1, h: 0.33 },
    ],
  },
};

export const SLOT_COUNT = 9;

export function blankSlot() {
  return { photo: 0, zoom: 1, ox: 0, oy: 0 };
}

export function blankState() {
  return {
    layout: 'hero',
    grade: 'sunset',
    title: 'VICE HEIST',
    subtitle: 'neon coast nights',
    ribbon: 'COVER STAR',
    heat: 4,
    grain: true,
    vignette: true,
    palms: true,
    photos: [],
    slots: Array.from({ length: SLOT_COUNT }, blankSlot),
  };
}

// Small deterministic generator so grain, skyline windows and palm fronds
// look the same on every draw of the same cover.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function panelRects(layoutId, w, h) {
  return LAYOUTS[layoutId].panels.map((p) => ({
    x: p.x * w, y: p.y * h, w: p.w * w, h: p.h * h, rot: p.rot ?? 0,
  }));
}

// Which slot (if any) sits under a point in the frame, for click-to-select.
export function panelHitTest(layoutId, w, h, px, py) {
  const rects = panelRects(layoutId, w, h);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

// Cover-fit draw of one photo into a rect, honouring zoom and pan offsets.
// ox/oy run -1..1 and shift within the slack the zoom creates.
function drawPhotoInto(ctx, img, rect, slot) {
  const { x, y, w, h } = rect;
  const zoom = slot?.zoom ?? 1;
  const ox = slot?.ox ?? 0;
  const oy = slot?.oy ?? 0;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;
  const dx = x + (w - dw) / 2 + ox * Math.max(0, (dw - w) / 2);
  const dy = y + (h - dh) / 2 + oy * Math.max(0, (dh - h) / 2);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// A gradient-map style grade: a warm wash, an overlay sweep and a soft-light
// tint, plus a dark foot so the title stays readable over bright photos.
function applyGradeToPanel(ctx, rect, grade, noir) {
  const { x, y, w, h } = rect;
  ctx.save();
  if (noir) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  const sweep = ctx.createLinearGradient(x, y, x, y + h);
  sweep.addColorStop(0, grade.accent + '00');
  sweep.addColorStop(0.55, grade.accent + '2e');
  sweep.addColorStop(1, grade.wash + '7d');
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = sweep;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.wash;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const foot = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
  foot.addColorStop(0, 'rgba(10,4,20,0)');
  foot.addColorStop(1, 'rgba(10,4,20,0.38)');
  ctx.fillStyle = foot;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawSunsetBackdrop(ctx, w, h, grade, seed) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  grade.sky.forEach((stop, i) => sky.addColorStop(i / (grade.sky.length - 1), stop));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Low glowing sun with a soft halo.
  const sx = w * 0.68;
  const sy = h * 0.34;
  const sr = Math.min(w, h) * 0.17;
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 2.4);
  halo.addColorStop(0, grade.sun + 'cc');
  halo.addColorStop(0.4, grade.accent + '55');
  halo.addColorStop(1, grade.accent + '00');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  // Thin sun slats, a synthwave touch.
  ctx.fillStyle = grade.sky[0];
  for (let i = 0; i < 3; i++) {
    const yy = sy + sr * (0.15 + i * 0.28);
    ctx.fillRect(sx - sr, yy, sr * 2, sr * 0.07);
  }
  drawSkyline(ctx, w, h, grade, seed);
}

function drawSkyline(ctx, w, h, grade, seed) {
  const rnd = mulberry32(seed + 7);
  const base = h * 0.86;
  ctx.fillStyle = grade.deep;
  let x = -w * 0.02;
  while (x < w * 1.02) {
    const bw = w * (0.05 + rnd() * 0.09);
    const bh = h * (0.05 + rnd() * 0.16);
    ctx.fillRect(x, base - bh, bw, bh + h * 0.14);
    if (rnd() > 0.6) {
      ctx.fillRect(x + bw * 0.42, base - bh - h * 0.05, w * 0.008, h * 0.05);
    }
    // Lit windows.
    ctx.fillStyle = grade.sun;
    const cols = Math.max(1, Math.floor(bw / (w * 0.018)));
    const rows = Math.max(1, Math.floor(bh / (h * 0.045)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() > 0.72) {
          ctx.fillRect(x + w * 0.008 + c * w * 0.018, base - bh + h * 0.014 + r * h * 0.045, w * 0.008, h * 0.018);
        }
      }
    }
    ctx.fillStyle = grade.deep;
    x += bw + w * 0.008;
  }
  // Waterline glow under the skyline.
  const glow = ctx.createLinearGradient(0, base, 0, h);
  glow.addColorStop(0, grade.accent + '44');
  glow.addColorStop(1, grade.accent + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, base, w, h - base);
}

// One palm silhouette: a leaning trunk and a crown of curved fronds.
function drawPalmTree(ctx, x, y, size, lean, seed) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = '#12061f';
  ctx.fillStyle = '#12061f';
  ctx.lineWidth = size * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.06, -size * 0.55, size * 0.16, -size * 0.92);
  ctx.stroke();
  const topX = size * 0.16;
  const topY = -size * 0.92;
  for (let i = 0; i < 7; i++) {
    const ang = (-160 + i * 26 + (rnd() - 0.5) * 10) * Math.PI / 180;
    const len = size * (0.42 + rnd() * 0.22);
    const tipX = topX + Math.cos(ang) * len;
    const tipY = topY + Math.sin(ang) * len * 0.55 + size * 0.1;
    const midX = topX + Math.cos(ang) * len * 0.55;
    const midY = topY + Math.sin(ang) * len * 0.28 - size * 0.08;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(midX + Math.cos(ang + 0.5) * len * 0.12, midY + size * 0.06, topX, topY);
    ctx.fill();
  }
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, filled, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.stroke();
  }
}

// The title block: a halftone-dot band, Anton title with hard offset shadow,
// Pacifico neon subtitle, and the star heat meter.
function drawHalftoneTitle(ctx, w, h, state, grade) {
  const bandH = h * 0.21;
  const bandY = h - bandH;
  const band = ctx.createLinearGradient(0, bandY, 0, h);
  band.addColorStop(0, grade.deep + 'e6');
  band.addColorStop(1, '#05020acc');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);
  // Halftone dots, denser toward the top edge of the band.
  const step = Math.max(10, w * 0.014);
  for (let yy = bandY + step * 0.4; yy < bandY + bandH * 0.42; yy += step) {
    const fade = 1 - (yy - bandY) / (bandH * 0.42);
    for (let xx = step * 0.5; xx < w; xx += step) {
      const r = step * 0.32 * fade;
      if (r < 0.6) continue;
      ctx.fillStyle = grade.accent;
      ctx.globalAlpha = 0.5 * fade;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, bandY, w, Math.max(3, h * 0.006));

  const title = (state.title || '').trim().toUpperCase();
  const cx = w / 2;
  let size = h * 0.105;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fit = (px) => {
    ctx.font = `${px}px Anton, 'Arial Narrow', sans-serif`;
    return ctx.measureText(title).width;
  };
  while (title && fit(size) > w * 0.9 && size > h * 0.03) size -= 2;
  const titleY = bandY + bandH * 0.42;
  if (title) {
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = grade.deep;
    ctx.lineWidth = size * 0.14;
    ctx.strokeText(title, cx, titleY);
    ctx.fillStyle = grade.accent;
    ctx.fillText(title, cx + size * 0.045, titleY + size * 0.06);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, cx, titleY);
  }
  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = h * 0.042;
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = subSize * 0.7;
    ctx.fillStyle = '#ffd7ec';
    ctx.fillText(sub, cx, bandY + bandH * 0.8);
    ctx.shadowBlur = 0;
  }
}

// The star heat meter lives in its own chip at the top-left corner, clear of
// the title: a dark pill with HEAT and five stars, filled up to state.heat.
function drawHeatChip(ctx, w, h, state) {
  const starR = Math.max(7, h * 0.014);
  const pad = starR * 1.1;
  const labelFs = Math.max(11, h * 0.016);
  ctx.font = `${labelFs}px Anton, sans-serif`;
  const labelW = ctx.measureText('HEAT').width;
  const chipW = pad * 2 + labelW + starR * 0.8 + starR * 2.5 * 5;
  const chipH = starR * 2.6;
  const x = w * 0.03;
  const y = h * 0.03;
  ctx.fillStyle = 'rgba(8,3,18,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = Math.max(1, h * 0.0015);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HEAT', x + pad, y + chipH / 2 + labelFs * 0.06);
  let starX = x + pad + labelW + starR * 0.8 + starR;
  const starY = y + chipH / 2;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, starX, starY, starR, i < state.heat, i < state.heat ? '#ffc44d' : '#ffffff');
    starX += starR * 2.5;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
}

function drawBadgeRibbon(ctx, w, h, state, grade) {
  const text = (state.ribbon || '').trim().toUpperCase();
  if (!text) return;
  const fs = Math.max(12, h * 0.026);
  ctx.font = `${fs}px Anton, sans-serif`;
  const tw = ctx.measureText(text).width;
  const rw = tw + fs * 2.4;
  const rh = fs * 2;
  ctx.save();
  ctx.translate(w - rw * 0.42, rh * 0.9);
  ctx.rotate(0.22);
  ctx.fillStyle = grade.accent;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = rh * 0.3;
  ctx.shadowOffsetY = rh * 0.12;
  ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, fs * 0.06);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawFilmGrain(ctx, w, h, seed) {
  const rnd = mulberry32(seed + 99);
  const dots = Math.floor((w * h) / 260);
  ctx.save();
  for (let i = 0; i < dots; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(rnd() * w, rnd() * h, 1.4, 1.4);
  }
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// The whole cover: backdrop, panels with grades, palms, title, ribbon, grain.
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const def = LAYOUTS[state.layout] ?? LAYOUTS.hero;
  const seed = 20261120;

  drawSunsetBackdrop(ctx, w, h, grade, seed);
  const rects = panelRects(state.layout, w, h);
  const gutter = Math.max(3, Math.round(Math.min(w, h) * 0.006));

  rects.forEach((rect, i) => {
    const slot = state.slots[i] ?? blankSlot();
    const img = state.photos[slot.photo]?.img ?? null;
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.rot * Math.PI) / 180);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.max(8, w * 0.02);
      ctx.shadowOffsetY = Math.max(4, h * 0.008);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-gutter * 2, -gutter * 2, rect.w + gutter * 4, rect.h + gutter * 4);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.rect(0, 0, rect.w, rect.h);
      ctx.clip();
      if (img) drawPhotoInto(ctx, img, { x: 0, y: 0, w: rect.w, h: rect.h }, slot);
      else drawSunsetBackdrop(ctx, rect.w, rect.h, grade, seed + i);
      applyGradeToPanel(ctx, { x: 0, y: 0, w: rect.w, h: rect.h }, grade, state.grade === 'noir');
      ctx.restore();
      return;
    }
    const inset = {
      x: rect.x + gutter / 2, y: rect.y + gutter / 2,
      w: rect.w - gutter, h: rect.h - gutter,
    };
    ctx.beginPath();
    ctx.rect(inset.x, inset.y, inset.w, inset.h);
    ctx.clip();
    if (img) drawPhotoInto(ctx, img, inset, slot);
    else drawSunsetBackdrop(ctx, inset.w, inset.h, grade, seed + i * 13);
    applyGradeToPanel(ctx, inset, grade, state.grade === 'noir');
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.004);
    ctx.strokeRect(inset.x, inset.y, inset.w, inset.h);
  });

  if (state.palms && !def.backdrop) {
    drawPalmTree(ctx, w * 0.015, h * 0.99, h * 0.34, 0.1, seed + 1);
    drawPalmTree(ctx, w * 0.985, h * 1.0, h * 0.3, -0.12, seed + 2);
  }
  if (state.palms && def.backdrop) {
    drawPalmTree(ctx, w * 0.02, h * 0.98, h * 0.3, 0.12, seed + 3);
  }

  drawHalftoneTitle(ctx, w, h, state, grade);
  drawBadgeRibbon(ctx, w, h, state, grade);
  drawHeatChip(ctx, w, h, state);
  if (state.grain) drawFilmGrain(ctx, w, h, seed);
  if (state.vignette) drawVignette(ctx, w, h);
}

// Renders the cover at an export size and returns the fresh canvas.
export function renderCoverCanvas(width, height, state) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas, state);
  return canvas;
}
