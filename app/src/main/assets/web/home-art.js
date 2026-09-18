// Decorative SVGs stay crisp at every screen size and are hidden from screen readers.
export function homeArt(kind) {
  // Two curved panel edges with paired stitches following each seam's tangent.
  const ball = (softball) => {
    let stitches = '';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 13; i++) {
        const t = (i + .5) / 13, y = 33.5 + 105 * t;
        const x = 110 + side * (40 - 104 * t * (1 - t));
        const dx = side * (-104 + 208 * t), length = Math.hypot(dx, 105);
        const tx = dx / length, ty = 105 / length, nx = ty, ny = -tx;
        const point = (n, along) => `${(x + nx * n + tx * along).toFixed(2)} ${(y + ny * n + ty * along).toFixed(2)}`;
        stitches += `<path d="M${point(-5, -2.6)}L${point(0, 1.8)}L${point(5, -2.6)}"/>`;
      }
    }
    return `<circle cx="110" cy="86" r="66" fill="${softball ? '#e5f43b' : '#fffaf0'}" stroke="${softball ? '#829523' : '#e6d8c9'}" stroke-width="1.5"/><g stroke="#b52e40"><path d="M70 33.5Q122 86 70 138.5M150 33.5Q98 86 150 138.5" stroke-width="1" opacity=".6"/><g stroke-width="2">${stitches}</g></g>`;
  };
  const shapes = {
    players: '<path d="m65 36 28-12q17 18 34 0l28 12 27 37-25 19-14-18v79H77V74L63 92 38 73Z"/><path d="M93 24q0 33 34 0M77 133h66M47 61l25 18m77 0 25-18"/><path d="M99 73h23l-17 40m21-40v40"/>',
    baseball: ball(false),
    softball: ball(true),
    history: '<rect x="52" y="29" width="119" height="133" rx="12"/><path d="M75 29v133M93 53h55M93 66h34M88 86h67v57H88Zm0 19h67m-67 19h67m-45-38v57m23-57v57M44 52h17M44 76h17M44 100h17M44 124h17"/><path d="m135 27 9-9 35 35-9 9Z"/>',
  };
  return `<svg class="home-art" viewBox="0 0 220 180" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[kind]}</svg>`;
}
