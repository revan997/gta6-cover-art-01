// Vice Cover Studio v2 — screenshot scenes (?shot= driver).
// The shots harness opens the app with a ?shot= query and waits for
// window.__shotReady. Two scene kinds:
//   ?shot=cover&photo=<name>&layout=<l>&grade=<g>&size=<WxH>
//       full-frame exported cover, drawn by the app itself at viewport size
//   ?shot=editor&photo=<name>&layout=<l>&grade=<g>
//       the editor with that photo loaded and the layout/grade applied
// Photos are the app's own bundled samples (or uploads in a live session);
// nothing is fetched from the network.
import { renderCover, SAMPLE_PHOTOS, layoutSlots, smartCrop } from './cover.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

function photoIndexByName(name) {
  if (!name) return 0;
  const i = SAMPLE_PHOTOS.findIndex((s) => s.name === name);
  return i >= 0 ? i : 0;
}

function waitForVice(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if (window.__vice) return resolve(window.__vice);
      if (Date.now() - t0 > timeoutMs) return reject(new Error('__vice never appeared'));
      setTimeout(tick, 100);
    };
    tick();
  });
}

async function coverScene() {
  document.body.classList.add('shot-cover');
  const vice = await waitForVice();
  const { state } = vice;
  const layout = params.get('layout') || state.layout;
  const grade = params.get('grade') || state.grade;
  const primary = photoIndexByName(params.get('photo'));
  if (params.get('title')) state.title = params.get('title');
  if (params.get('subtitle')) state.subtitle = params.get('subtitle');
  const n = Math.max(1, state.photos.length);
  const canvas = document.getElementById('shotCanvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  // optional explicit panel order (?panels=boulevard,rooftop-dusk,...),
  // otherwise the primary photo first and the rest round-robin
  const panelsParam = params.get('panels');
  const order = panelsParam
    ? panelsParam.split(',').map((s) => photoIndexByName(s.trim()))
    : null;
  const slots = layoutSlots(layout, canvas.width, canvas.height);
  const assignments = Array.from({ length: 8 }, (_, i) => ({
    photo: order ? order[i % order.length] : (i === 0 ? primary : (primary + i) % n),
    ...smartCrop(slots[i] || { w: canvas.width, h: canvas.height }),
  }));
  await document.fonts.ready;
  renderCover(canvas, {
    photos: state.photos, assignments,
    layout, grade,
    title: state.title, subtitle: state.subtitle, ribbon: state.ribbon,
    heat: state.heat, grain: state.grain, vignette: state.vignette,
  });
  window.__shotReady = true;
}

async function editorScene() {
  const vice = await waitForVice();
  const { state } = vice;
  if (params.get('layout')) state.layout = params.get('layout');
  if (params.get('grade')) state.grade = params.get('grade');
  if (params.get('title')) state.title = params.get('title');
  const primary = photoIndexByName(params.get('photo'));
  // assign the named photo to every slot first, then the others round-robin,
  // so the editor visibly shows the shot's photo in the hero panel.
  const n = Math.max(1, state.photos.length);
  state.assignments = state.assignments.map((a, i) => ({
    ...a, photo: i === 0 ? primary : (primary + i) % n, zoom: 1, ox: 0, oy: 0,
  }));
  state.selectedSlot = 0;
  vice.renderPreview();
  await document.fonts.ready;
  vice.renderPreview();
  window.__shotReady = true;
}

if (shot === 'cover') {
  coverScene().catch((e) => { console.error('cover scene failed:', e); });
} else if (shot === 'editor') {
  editorScene().catch((e) => { console.error('editor scene failed:', e); });
}
