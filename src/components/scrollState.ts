/**
 * Mutable scroll state shared between the DOM page and the WebGL scene.
 * `scene` is a continuous float: 0 = hero, 1 = first section, etc.
 * The 3D loaf interpolates between keyframes using this value.
 */
export const scrollState = {
  scene: 0,
  velocity: 0,
  pointerX: 0,
  pointerY: 0,
};

export function measureScene(sections: HTMLElement[]) {
  if (sections.length === 0) return 0;
  const probe = window.scrollY + window.innerHeight * 0.45;
  const tops = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);

  if (probe <= tops[0]) return 0;
  for (let i = 0; i < tops.length - 1; i++) {
    if (probe < tops[i + 1]) {
      const span = Math.max(1, tops[i + 1] - tops[i]);
      return i + (probe - tops[i]) / span;
    }
  }
  // Past the last section: push slightly beyond so the footer pose completes.
  const last = tops.length - 1;
  const doc = document.documentElement.scrollHeight - window.innerHeight;
  const remaining = Math.max(1, doc + window.innerHeight * 0.45 - tops[last]);
  return last + Math.min(1, (probe - tops[last]) / remaining);
}
