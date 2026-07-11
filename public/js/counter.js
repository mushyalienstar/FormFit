// The two counters — the app's signature element.
// setOdometer: verified reps roll over as mechanical ink digits.
// renderTally: near-misses accrue as hand-drawn pencil tally strokes.

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Odometer ----------
export function setOdometer(container, value) {
  const digits = String(value).split("");

  // Digit count changed (first render, or 9→10): rebuild statically.
  if (container.children.length !== digits.length) {
    container.innerHTML = digits
      .map(
        (d) =>
          `<span class="odo-cell" data-digit="${d}"><span class="odo-strip"><span>${d}</span></span></span>`
      )
      .join("");
    return;
  }

  digits.forEach((d, i) => {
    const cell = container.children[i];
    if (cell.dataset.digit === d) return;
    const old = cell.dataset.digit;
    cell.dataset.digit = d;
    const strip = cell.firstElementChild;
    if (reduced()) {
      strip.innerHTML = `<span>${d}</span>`;
      return;
    }
    // Old digit on top, new below — roll up one digit height, then settle.
    strip.innerHTML = `<span>${old}</span><span>${d}</span>`;
    strip.classList.remove("roll");
    void strip.offsetWidth; // restart animation
    strip.classList.add("roll");
    strip.addEventListener(
      "animationend",
      () => {
        strip.innerHTML = `<span>${d}</span>`;
        strip.classList.remove("roll");
      },
      { once: true }
    );
  });
}

// ---------- Tally marks ----------
// Groups of five: four strokes, fifth crosses them. Strokes get a small
// deterministic jitter so they read hand-drawn, not machine-set.
const MAX_STROKES = 15; // beyond this the numeric label carries the count

export function renderTally(container, count) {
  const prev = Number(container.dataset.count) || 0;
  container.dataset.count = count;
  if (count === 0) {
    container.innerHTML = "";
    return;
  }

  const shown = Math.min(count, MAX_STROKES);
  const groups = [];
  for (let g = 0; g * 5 < shown; g++) groups.push(Math.min(5, shown - g * 5));

  const groupW = 30;
  const gap = 12;
  const h = 26;
  const w = groups.length * (groupW + gap) - gap;

  const lines = [];
  let idx = 0;
  groups.forEach((n, g) => {
    const x0 = g * (groupW + gap);
    for (let i = 0; i < Math.min(n, 4); i++) {
      const jx = ((idx * 7) % 3) - 1; // -1..1 px lean, stable per stroke
      const x = x0 + i * 7 + 3;
      lines.push(`<line x1="${x + jx}" y1="3" x2="${x - jx}" y2="${h - 3}"/>`);
      idx++;
    }
    if (n === 5) {
      lines.push(
        `<line x1="${x0}" y1="${h - 5}" x2="${x0 + groupW - 4}" y2="5"/>`
      );
      idx++;
    }
  });

  // Draw the newest stroke in (unless the count shrank, e.g. a reset).
  if (count > prev && !reduced() && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(
      "<line ",
      '<line class="fresh" '
    );
  }

  container.innerHTML = `<svg class="tally" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${lines.join("")}</svg>`;
}
