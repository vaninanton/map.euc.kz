import type { Map as MapboxMap, Popup as MapboxPopup } from 'mapbox-gl';

const PAD = 12;

export function panMapToKeepPopupInView(map: MapboxMap, popup: MapboxPopup): void {
  const el = popup.getElement();
  if (!el) return;
  const container = map.getContainer().getBoundingClientRect();
  const r = el.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  if (r.left < container.left + PAD) dx = container.left + PAD - r.left;
  else if (r.right > container.right - PAD) dx = (container.right - PAD) - r.right;
  if (r.top < container.top + PAD) dy = container.top + PAD - r.top;
  else if (r.bottom > container.bottom - PAD) dy = (container.bottom - PAD) - r.bottom;
  if (dx !== 0 || dy !== 0) map.panBy([-dx, -dy], { duration: 200 });
}
