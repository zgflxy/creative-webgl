const canvas = document.querySelector('#heart-canvas');
const openLetterButton = document.querySelector('#open-letter');
const state = document.querySelector('#state');
const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
if (!gl) throw new Error('此浏览器不支持 WebGL。');

const vertexSource = `
attribute vec3 a_position; attribute vec3 a_burst; attribute float a_size; attribute float a_kind; attribute float a_seed;
uniform float u_time; uniform float u_burst; uniform float u_reveal; uniform float u_aspect; uniform float u_pointerX; uniform float u_pointerY;
varying float v_alpha; varying float v_kind;
void main() {
  vec3 p = a_position; float wave = sin(u_time * 1.4 + a_seed * 12.0) * .22;
  if (a_kind < .5) {
    float angle = u_time * .16 + u_pointerX * .20; float c = cos(angle), s = sin(angle);
    p.xz = mat2(c, -s, s, c) * p.xz; p.y += wave + u_pointerY * 1.2; p += a_burst * u_burst;
  }
  float depth = 60.0 + p.z; vec2 projected = p.xy / depth * 2.22;
  gl_Position = vec4(projected.x / u_aspect, projected.y, 0.0, 1.0);
  float twinkle = .74 + .26 * sin(u_time * 2.1 + a_seed * 30.0);
  gl_PointSize = (a_size + u_burst * 1.5) * twinkle * (1.0 + 14.0 / depth);
  v_alpha = a_kind < .5 ? u_reveal : .42 + .35 * twinkle; v_kind = a_kind;
}`;
const fragmentSource = `
precision mediump float; varying float v_alpha; varying float v_kind;
void main() {
  vec2 uv = gl_PointCoord - .5; float d = dot(uv, uv); if (d > .25) discard;
  float core = smoothstep(.25, 0.0, d);
  vec3 color = v_kind < .5 ? mix(vec3(1.0, .14, .43), vec3(1.0, .72, .87), core) : vec3(.88, .68, 1.0);
  gl_FragColor = vec4(color, core * v_alpha);
}`;
function shader(type, source) {
  const unit = gl.createShader(type); gl.shaderSource(unit, source); gl.compileShader(unit);
  if (!gl.getShaderParameter(unit, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(unit));
  return unit;
}
const program = gl.createProgram();
gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const locations = Object.fromEntries(['a_position', 'a_burst', 'a_size', 'a_kind', 'a_seed'].map((key) => [key, gl.getAttribLocation(program, key)]));
const uniforms = Object.fromEntries(['u_time', 'u_burst', 'u_reveal', 'u_aspect', 'u_pointerX', 'u_pointerY'].map((key) => [key, gl.getUniformLocation(program, key)]));

const count = innerWidth < 600 ? 6800 : 11500;
const stars = Math.round(count * .16); const total = count + stars;
const positions = new Float32Array(total * 3), bursts = new Float32Array(total * 3), sizes = new Float32Array(total), kinds = new Float32Array(total), seeds = new Float32Array(total);
function heartPoint() {
  const t = Math.random() * Math.PI * 2, fill = Math.pow(Math.random(), .46);
  return { x: 1.28 * 16 * Math.pow(Math.sin(t), 3) * fill, y: (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * fill - 1.5, z: (Math.random() - .5) * (8 + (1 - fill) * 10) };
}
for (let i = 0; i < total; i += 1) {
  const i3 = i * 3;
  if (i < count) {
    const p = heartPoint(), outward = 13 + Math.random() * 30, length = Math.hypot(p.x, p.y, p.z) || 1;
    positions.set([p.x, p.y, p.z], i3);
    bursts.set([p.x / length * outward + (Math.random() - .5) * 9, p.y / length * outward + (Math.random() - .5) * 9, p.z / length * outward + (Math.random() - .5) * 13], i3);
    sizes[i] = 2 + Math.random() * 3.7;
  } else {
    positions.set([(Math.random() - .5) * 122, (Math.random() - .5) * 78, Math.random() * 37 - 20], i3);
    sizes[i] = .55 + Math.random() * 1.65; kinds[i] = 1;
  }
  seeds[i] = Math.random();
}
function bind(name, data, size) {
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(locations[name]); gl.vertexAttribPointer(locations[name], size, gl.FLOAT, false, 0, 0);
}
bind('a_position', positions, 3); bind('a_burst', bursts, 3); bind('a_size', sizes, 1); bind('a_kind', kinds, 1); bind('a_seed', seeds, 1);

let burst = 0, reveal = 0, revealTarget = 0, pointerX = 0, pointerY = 0, lastTimestamp = 0;
function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
  gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform1f(uniforms.u_aspect, innerWidth / innerHeight);
}
function render(timestamp) {
  const elapsed = Math.min(50, timestamp - lastTimestamp || 16); lastTimestamp = timestamp; burst = Math.max(0, burst - elapsed / 1320); reveal += (revealTarget - reveal) * Math.min(1, elapsed / 580);
  gl.clearColor(.018, .003, .027, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1f(uniforms.u_time, timestamp * .001); gl.uniform1f(uniforms.u_burst, Math.sin(burst * Math.PI)); gl.uniform1f(uniforms.u_reveal, reveal); gl.uniform1f(uniforms.u_pointerX, pointerX); gl.uniform1f(uniforms.u_pointerY, pointerY);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.drawArrays(gl.POINTS, 0, total); requestAnimationFrame(render);
}
function ignite() {
  if (!document.body.classList.contains('opened')) return;
  burst = 1; document.body.classList.remove('flash'); void document.body.offsetWidth; document.body.classList.add('flash');
  state.textContent = 'A WISH IS ON ITS WAY'; setTimeout(() => { state.textContent = 'LOVE IS IN THE AIR'; }, 1900);
}
function openLetter() {
  if (document.body.classList.contains('opened')) return;
  document.body.classList.add('opened'); revealTarget = 1; state.textContent = 'MESSAGE OPENED';
  setTimeout(ignite, 720);
}
window.addEventListener('resize', resize);
window.addEventListener('pointermove', (event) => { pointerX = (event.clientX / innerWidth - .5) * 2; pointerY = (.5 - event.clientY / innerHeight) * 2; });
window.addEventListener('pointerdown', () => { if (document.body.classList.contains('opened')) ignite(); });
window.addEventListener('keydown', (event) => { if (event.code === 'Space' && !event.repeat) { event.preventDefault(); document.body.classList.contains('opened') ? ignite() : openLetter(); } });
openLetterButton.addEventListener('click', openLetter);
resize(); requestAnimationFrame(render);
