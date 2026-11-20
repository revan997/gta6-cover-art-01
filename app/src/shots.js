// Fixed scenes for screenshots. `?shot=cover` draws the exported cover alone,
// filling the viewport, from the query's size / layout / grade / photo / caption.
// `?shot=editor` shows the editor with a sample photo loaded. Both set
// window.__shotReady once the fonts are in and the frame is painted.
export async function runShot(shot, query, app) {
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const state = app.state;

  await Promise.all([
    document.fonts.load('40px Anton'),
    document.fonts.load('40px Pacifico'),
  ]).catch(() => {});

  const photoIndex = await app.loadSample(photo);
  state.title = caption;
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('size')) app.setPreviewSize(query.get('size'));

  if (shot === 'cover') {
    // Every panel shows the same sample photo, as a one-photo cover would.
    // Stage the crop: the first (hero) slot looks at the top of the photo so
    // a face stays in frame on wide panels; the rest sit near-centre.
    state.slots.forEach((slot, i) => {
      slot.photo = photoIndex;
      slot.oy = i === 0 ? 0.85 : 0.1;
    });
    document.body.classList.add('shot-cover');
    app.drawCoverFull();
  } else {
    // Editor scene: the sample is the active photo, hero layout, both samples in.
    await app.loadSample(photo === 'pier' ? 'boulevard' : 'pier');
    state.slots.forEach((slot, i) => {
      slot.photo = i % 2 === 0 ? photoIndex : 1 - photoIndex;
    });
    app.redraw();
  }

  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
