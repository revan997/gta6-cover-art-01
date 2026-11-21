// Vice Cover Studio v2 — editor wiring (module script, no network).
// Owns the app state, the control panel, the live preview canvas, drag-to-pan
// + wheel-to-zoom per panel, undo/redo, the one-click "Make my cover" path
// and the real PNG export. Exposes window.__vice for the shots harness.
import {
  LAYOUTS, GRADES, SIZES, SAMPLE_PHOTOS,
  loadSamplePhotos, loadImage, renderCover, slotCount,
  layoutSlots, smartCrop,
} from './cover.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---------- state ----------
const state = {
  layout: 'poster',
  grade: 'sunset',
  size: '1920x1080',
  title: 'VICE HEIST',
  subtitle: 'neon coast nights',
  ribbon: 'COVER STAR',
  heat: 5,
  grain: true,
  vignette: true,
  photos: [],          // [{name, label, img, url?}] — samples + uploads
  assignments: [],     // per slot: {photo, zoom, ox, oy}
  selectedSlot: 0,
};

let lastSlots = [];    // pixel rects of the last preview render
let undoStack = [];
let redoStack = [];

function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, size: state.size,
    title: state.title, subtitle: state.subtitle, ribbon: state.ribbon,
    heat: state.heat, grain: state.grain, vignette: state.vignette,
    assignments: state.assignments, selectedSlot: state.selectedSlot,
  });
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}
function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  syncControls();
  renderPreview();
}
function syncUndoButtons() {
  $('#undoBtn').disabled = undoStack.length === 0;
  $('#redoBtn').disabled = redoStack.length === 0;
}

// ---------- preview ----------
function previewDims() {
  const [w, h] = state.size.split('x').map(Number);
  const scale = Math.min(980 / w, 560 / h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}
function renderPreview() {
  const canvas = $('#preview');
  const { w, h } = previewDims();
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const res = renderCover(canvas, {
    photos: state.photos, assignments: state.assignments,
    layout: state.layout, grade: state.grade,
    title: state.title, subtitle: state.subtitle, ribbon: state.ribbon,
    heat: state.heat, grain: state.grain, vignette: state.vignette,
  });
  lastSlots = res.slots;
  markSelectedSlot();
}
function markSelectedSlot() {
  const canvas = $('#preview');
  const s = lastSlots[state.selectedSlot];
  const box = $('#slotBox');
  if (!s || !box) return;
  const r = canvas.getBoundingClientRect();
  const stage = $('.stage');
  const sr = stage.getBoundingClientRect();
  box.style.display = 'block';
  box.style.left = `${r.left - sr.left + (s.x / canvas.width) * r.width - 2}px`;
  box.style.top = `${r.top - sr.top + (s.y / canvas.height) * r.height - 2}px`;
  box.style.width = `${(s.w / canvas.width) * r.width + 4}px`;
  box.style.height = `${(s.h / canvas.height) * r.height + 4}px`;
}

// ---------- controls ----------
function buildButtons() {
  const layoutBox = $('#layoutBtns');
  layoutBox.innerHTML = '';
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pick'; b.dataset.layout = l;
    b.textContent = l[0].toUpperCase() + l.slice(1);
    b.addEventListener('click', () => { pushUndo(); state.layout = l; state.selectedSlot = 0; syncControls(); renderPreview(); });
    layoutBox.appendChild(b);
  }
  const gradeBox = $('#gradeBtns');
  gradeBox.innerHTML = '';
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pick'; b.dataset.grade = g;
    b.textContent = g[0].toUpperCase() + g.slice(1);
    b.addEventListener('click', () => { pushUndo(); state.grade = g; syncControls(); renderPreview(); });
    gradeBox.appendChild(b);
  }
  const sizeBox = $('#sizeBtns');
  sizeBox.innerHTML = '';
  for (const s of SIZES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pick'; b.dataset.size = s;
    b.textContent = s;
    b.addEventListener('click', () => { pushUndo(); state.size = s; syncControls(); renderPreview(); });
    sizeBox.appendChild(b);
  }
}
function buildSampleChips() {
  const box = $('#sampleChips');
  box.innerHTML = '';
  state.photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.title = p.label || p.name;
    const img = document.createElement('img');
    img.src = p.img.src; img.alt = p.label || p.name;
    b.appendChild(img);
    const span = document.createElement('span');
    span.textContent = p.label || p.name;
    b.appendChild(span);
    b.addEventListener('click', () => assignPhotoToSelected(i));
    box.appendChild(b);
  });
}
function syncControls() {
  $$('#layoutBtns .pick').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  $$('#gradeBtns .pick').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  $$('#sizeBtns .pick').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  $('#titleInput').value = state.title;
  $('#subtitleInput').value = state.subtitle;
  $('#ribbonInput').value = state.ribbon;
  $('#heatInput').value = String(state.heat);
  $('#grainCheck').checked = state.grain;
  $('#vignetteCheck').checked = state.vignette;
  $$('.export-btn').forEach((b) => { b.textContent = `Export PNG ${b.dataset.size}`; });
}

function assignPhotoToSelected(photoIdx) {
  pushUndo();
  const n = slotCount(state.layout);
  while (state.assignments.length < n) state.assignments.push({ photo: 0, zoom: 1, ox: 0, oy: 0 });
  const a = state.assignments[state.selectedSlot];
  a.photo = photoIdx; a.zoom = 1; a.ox = 0; a.oy = 0;
  renderPreview();
}

// One-click path: sensible defaults, photos dealt round-robin, render + show.
function applyAutoCover() {
  pushUndo();
  state.layout = state.photos.length >= 3 ? 'poster' : 'hero';
  state.grade = 'sunset';
  state.ribbon = 'COVER STAR';
  state.heat = 5;
  const n = slotCount(state.layout);
  const [sw, sh] = state.size.split('x').map(Number);
  const slots = layoutSlots(state.layout, sw, sh);
  state.assignments = Array.from({ length: n }, (_, i) => ({
    photo: i % Math.max(1, state.photos.length),
    ...smartCrop(slots[i] || { w: sw, h: sh }),
  }));
  state.selectedSlot = 0;
  syncControls();
  renderPreview();
  $('#preview').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- export ----------
export async function exportPng(size) {
  const [w, h] = size.split('x').map(Number);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  renderCover(canvas, {
    photos: state.photos, assignments: state.assignments,
    layout: state.layout, grade: state.grade,
    title: state.title, subtitle: state.subtitle, ribbon: state.ribbon,
    heat: state.heat, grain: state.grain, vignette: state.vignette,
  });
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  return { blob, filename: `vice-cover-${size}.png` };
}
function downloadExport(size) {
  exportPng(size).then(({ blob, filename }) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
}

// ---------- upload ----------
async function handleFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImage(url);
      state.photos.push({ name: f.name.replace(/\.[^.]+$/, ''), label: f.name, img, url });
    } catch (e) { URL.revokeObjectURL(url); }
  }
  buildSampleChips();
  renderPreview();
}

// ---------- pointer: select / pan / zoom a panel ----------
function bindPreviewPointer() {
  const canvas = $('#preview');
  let drag = null;
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const idx = lastSlots.findIndex((s) => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
    if (idx >= 0) {
      state.selectedSlot = idx;
      drag = { x: p.x, y: p.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
      markSelectedSlot();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCanvas(e);
    const dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    const s = lastSlots[state.selectedSlot];
    const a = state.assignments[state.selectedSlot];
    if (drag.moved && s && a) {
      a.ox = Math.max(-1, Math.min(1, (a.ox || 0) + (dx / s.w) * 2));
      a.oy = Math.max(-1, Math.min(1, (a.oy || 0) + (dy / s.h) * 2));
      drag.x = p.x; drag.y = p.y;
      renderPreview();
    }
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const a = state.assignments[state.selectedSlot];
    if (!a) return;
    a.zoom = Math.max(1, Math.min(3, (a.zoom || 1) * (e.deltaY < 0 ? 1.12 : 0.89)));
    renderPreview();
  }, { passive: false });
}

// ---------- init ----------
async function init() {
  buildButtons();
  state.photos = await loadSamplePhotos();
  const n = slotCount(state.layout);
  const [iw, ih] = state.size.split('x').map(Number);
  const islots = layoutSlots(state.layout, iw, ih);
  state.assignments = Array.from({ length: n }, (_, i) => ({
    photo: i % Math.max(1, state.photos.length),
    ...smartCrop(islots[i] || { w: iw, h: ih }),
  }));
  buildSampleChips();

  $('#uploadInput').addEventListener('change', (e) => handleFiles([...e.target.files]));
  const drop = $('#dropZone');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('over');
    handleFiles([...e.dataTransfer.files]);
  });

  $('#titleInput').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
  $('#subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
  $('#ribbonInput').addEventListener('input', (e) => { state.ribbon = e.target.value; renderPreview(); });
  $('#heatInput').addEventListener('change', (e) => { pushUndo(); state.heat = Number(e.target.value); renderPreview(); });
  $('#grainCheck').addEventListener('change', (e) => { state.grain = e.target.checked; renderPreview(); });
  $('#vignetteCheck').addEventListener('change', (e) => { state.vignette = e.target.checked; renderPreview(); });
  $('#makeCoverBtn').addEventListener('click', applyAutoCover);
  $('#undoBtn').addEventListener('click', () => {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    syncUndoButtons();
  });
  $('#redoBtn').addEventListener('click', () => {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    syncUndoButtons();
  });
  $$('.export-btn').forEach((b) => b.addEventListener('click', () => downloadExport(b.dataset.size)));

  bindPreviewPointer();
  syncControls();
  syncUndoButtons();
  await document.fonts.ready;
  renderPreview();
  window.__vice = { state, exportPng, renderPreview, applyAutoCover, assignPhotoToSelected };
  window.__viceReady = true;
}

init().catch((e) => {
  console.error('editor init failed:', e);
  document.body.insertAdjacentHTML('beforeend', `<p class="fatal">Editor failed to start: ${e.message}</p>`);
});
