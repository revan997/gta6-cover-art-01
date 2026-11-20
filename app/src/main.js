// Vice Cover Studio — editor wiring. Owns the state, the controls, undo/redo,
// photo loading, drag-to-pan cropping and PNG export. The drawing itself lives
// in ./cover.js; the fixed screenshot scenes live in ./shots.js.
import {
  GRADES, LAYOUTS, SLOT_COUNT, blankState, blankSlot,
  drawCover, renderCoverCanvas, panelHitTest,
} from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const state = blankState();

let previewSize = '1080x1080';
let selectedSlot = -1;
let pickedPhoto = 0;
let pendingAssign = false;
let history = [];
let future = [];

const EXPORT_SIZES = ['1080x1080', '1080x1350', '1920x1080', '1080x1920'];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });
}

function snapshot() {
  const { photos, ...rest } = state;
  return JSON.stringify(rest);
}

function restore(json) {
  const data = JSON.parse(json);
  const photos = state.photos;
  Object.assign(state, data, { photos });
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  syncUndoButtons();
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
  syncInputs();
  redraw();
  syncUndoButtons();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
  syncInputs();
  redraw();
  syncUndoButtons();
}

function syncUndoButtons() {
  $('undoBtn').disabled = history.length === 0;
  $('redoBtn').disabled = future.length === 0;
}

// Fit the preview canvas to the chosen export aspect, longest side 720.
function sizePreview() {
  const [w, h] = previewSize.split('x').map(Number);
  const scale = 720 / Math.max(w, h);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  $('previewSize').textContent = `${w} × ${h}`;
}

function redraw() {
  const label = `${LAYOUTS[state.layout].label} · ${GRADES[state.grade].label}`;
  $('previewLabel').textContent = `Live preview — ${label.toLowerCase()}`;
  drawCover(canvas, state);
}

function syncInputs() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('ribbonInput').value = state.ribbon;
  $('heatInput').value = state.heat;
  $('heatValue').textContent = state.heat;
  $('grainInput').checked = state.grain;
  $('vignetteInput').checked = state.vignette;
  $('palmInput').checked = state.palms;
  document.querySelectorAll('#layoutRow button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeRow button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  syncPanelHint();
  renderStrip();
}

function syncPanelHint() {
  const hint = $('panelHint');
  if (selectedSlot < 0) {
    hint.textContent = 'No panel selected — click a panel in the preview.';
    $('zoomInput').value = 1;
    return;
  }
  const slot = state.slots[selectedSlot];
  const photo = state.photos[slot.photo];
  hint.textContent = `Panel ${selectedSlot + 1}: ${photo ? photo.name : 'empty'} — drag to move, zoom to crop.`;
  $('zoomInput').value = slot.zoom;
}

function renderStrip() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  if (!state.photos.length) {
    const span = document.createElement('span');
    span.className = 'empty';
    span.textContent = 'No photos yet.';
    strip.appendChild(span);
    return;
  }
  state.photos.forEach((photo, i) => {
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.name;
    thumb.title = photo.name + ' — click to pick, then click a panel';
    if (i === pickedPhoto) thumb.classList.add('picked');
    thumb.addEventListener('click', () => {
      pickedPhoto = i;
      renderStrip();
      if (selectedSlot >= 0) {
        pushHistory();
        state.slots[selectedSlot].photo = i;
        pendingAssign = false;
        redraw();
        syncPanelHint();
      } else {
        // No panel selected yet: the next panel click drops this photo in.
        pendingAssign = true;
      }
    });
    strip.appendChild(thumb);
  });
}

async function addPhotos(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  for (const file of list) {
    if (state.photos.length >= 4) {
      $('status').textContent = 'Four photos at most — the first four are kept.';
      break;
    }
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    state.photos.push({ name: file.name, img });
  }
  pickedPhoto = 0;
  // Fresh photos go into any empty-looking slot still pointing at photo 0.
  pushHistory();
  redraw();
  renderStrip();
  $('status').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded.`;
}

async function loadSample(name) {
  const existing = state.photos.findIndex((p) => p.name === name + '.jpg');
  if (existing >= 0) return existing;
  const img = await loadImage(`samples/${name}.jpg`);
  state.photos.push({ name: name + '.jpg', img });
  return state.photos.length - 1;
}

// ---- export ----
async function exportPng(sizeLabel) {
  const [w, h] = sizeLabel.split('x').map(Number);
  const shot = renderCoverCanvas(w, h, state);
  const blob = await new Promise((resolve) => shot.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG encode failed');
  return { blob, w, h };
}

async function downloadExport(sizeLabel) {
  previewSize = sizeLabel;
  sizePreview();
  redraw();
  try {
    const { blob, w, h } = await exportPng(sizeLabel);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $('status').textContent = `Saved vice-cover-${w}x${h}.png (${(blob.size / 1024).toFixed(0)} KiB).`;
  } catch (err) {
    $('status').textContent = 'Export failed: ' + err.message;
  }
}

// ---- cover-mode (screenshot) drawing ----
function drawCoverFull() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawCover(canvas, state);
}

// ---- build the control chips ----
function buildChips() {
  const layoutRow = $('layoutRow');
  Object.entries(LAYOUTS).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = id;
    b.innerHTML = `${def.label}<small>${def.note}</small>`;
    b.addEventListener('click', () => {
      if (state.layout === id) return;
      pushHistory();
      state.layout = id;
      syncInputs();
      redraw();
    });
    layoutRow.appendChild(b);
  });
  const gradeRow = $('gradeRow');
  Object.entries(GRADES).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = id;
    b.innerHTML = `${def.label}<small>${def.note}</small>`;
    b.addEventListener('click', () => {
      if (state.grade === id) return;
      pushHistory();
      state.grade = id;
      syncInputs();
      redraw();
    });
    gradeRow.appendChild(b);
  });
}

// ---- canvas pointer: select a panel, drag to pan its photo ----
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

function photoSlack(img, rect, slot) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * slot.zoom;
  return {
    x: Math.max(0, (img.naturalWidth * base - rect.w) / 2),
    y: Math.max(0, (img.naturalHeight * base - rect.h) / 2),
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const slotIndex = panelHitTest(state.layout, canvas.width, canvas.height, p.x, p.y);
  selectedSlot = slotIndex;
  syncPanelHint();
  if (slotIndex < 0) return;
  // A photo picked in the strip drops into the clicked panel.
  const slot = state.slots[slotIndex];
  if (pendingAssign && state.photos[pickedPhoto]) {
    pushHistory();
    slot.photo = pickedPhoto;
    pendingAssign = false;
    redraw();
  }
  // Save the pre-drag state so undo restores the crop before this drag.
  pushHistory();
  const img = state.photos[slot.photo]?.img;
  drag = { slotIndex, start: p, ox: slot.ox, oy: slot.oy, img };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const slot = state.slots[drag.slotIndex];
  if (!drag.img) return;
  const rects = LAYOUTS[state.layout].panels.map((r) => ({
    w: r.w * canvas.width, h: r.h * canvas.height,
  }));
  const rect = rects[drag.slotIndex];
  const slack = photoSlack(drag.img, rect, slot);
  if (slack.x > 0) slot.ox = Math.max(-1, Math.min(1, drag.ox + (p.x - drag.start.x) / slack.x));
  if (slack.y > 0) slot.oy = Math.max(-1, Math.min(1, drag.oy + (p.y - drag.start.y) / slack.y));
  redraw();
});

canvas.addEventListener('pointerup', () => {
  drag = null;
});

// ---- wire the controls ----
function wireControls() {
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });

  $('photoInput').addEventListener('change', (e) => addPhotos(e.target.files));
  const zone = $('dropzone');
  ['dragover', 'dragenter'].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault();
    zone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault();
    zone.classList.remove('over');
  }));
  zone.addEventListener('drop', (e) => addPhotos(e.dataTransfer.files));

  // Live controls save the pre-change state on the first input of each
  // interaction, so undo always returns to the value before the drag/type.
  const liveControl = (input, apply) => {
    let armed = true;
    input.addEventListener('input', () => {
      if (armed) {
        pushHistory();
        armed = false;
      }
      apply();
    });
    input.addEventListener('change', () => {
      armed = true;
    });
  };
  liveControl($('titleInput'), () => {
    state.title = $('titleInput').value;
    redraw();
  });
  liveControl($('subtitleInput'), () => {
    state.subtitle = $('subtitleInput').value;
    redraw();
  });
  liveControl($('ribbonInput'), () => {
    state.ribbon = $('ribbonInput').value;
    redraw();
  });
  liveControl($('heatInput'), () => {
    state.heat = Number($('heatInput').value);
    $('heatValue').textContent = state.heat;
    redraw();
  });
  liveControl($('zoomInput'), () => {
    if (selectedSlot < 0) return;
    state.slots[selectedSlot].zoom = Number($('zoomInput').value);
    redraw();
  });

  $('fitBtn').addEventListener('click', () => {
    if (selectedSlot < 0) return;
    pushHistory();
    Object.assign(state.slots[selectedSlot], { zoom: 1, ox: 0, oy: 0 });
    redraw();
    syncPanelHint();
  });
  $('swapBtn').addEventListener('click', () => {
    if (selectedSlot < 0 || !state.photos.length) return;
    pushHistory();
    const slot = state.slots[selectedSlot];
    slot.photo = (slot.photo + 1) % state.photos.length;
    pickedPhoto = slot.photo;
    redraw();
    syncPanelHint();
    renderStrip();
  });

  const toggle = (key, input) => {
    input.addEventListener('change', () => {
      pushHistory();
      state[key] = input.checked;
      redraw();
    });
  };
  toggle('grain', $('grainInput'));
  toggle('vignette', $('vignetteInput'));
  toggle('palms', $('palmInput'));

  document.querySelectorAll('.export-btn').forEach((b) => {
    b.addEventListener('click', () => downloadExport(b.dataset.size));
  });
}

// Test and screenshot hooks: the shot script and the export check drive these.
const app = {
  state,
  loadSample,
  redraw,
  sizePreview,
  drawCoverFull,
  exportPng,
  setPreviewSize(size) {
    previewSize = size;
    sizePreview();
    redraw();
  },
};
window.__vice = app;

// ---- boot ----
async function boot() {
  buildChips();
  wireControls();
  sizePreview();
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
  } catch { /* fallback fonts still draw */ }
  await loadSample('pier');
  await loadSample('boulevard');
  syncInputs();
  redraw();
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, app);
  }
}

boot();
