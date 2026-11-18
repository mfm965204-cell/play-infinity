import * as THREE from 'three';
import './style.css';

/* ------------------------------------------------------------------ *
 * Device budget: this scene has to hold 30fps on a cheap Android
 * phone, so geometry, pixel ratio and particle counts are all scaled
 * down when the hardware looks weak.
 * ------------------------------------------------------------------ */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowEnd =
  (navigator.hardwareConcurrency || 4) <= 4 ||
  (navigator.deviceMemory || 4) <= 3 ||
  Math.min(window.innerWidth, window.innerHeight) < 420;

const CONFIG = {
  posters: lowEnd ? 6 : 10,
  particles: lowEnd ? 70 : 190,
  maxPixelRatio: lowEnd ? 1 : 1.6,
  antialias: !lowEnd,
  ringRadius: 3.6,
  fogNear: 6,
  fogFar: 16,
};

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: CONFIG.antialias,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0b0f, CONFIG.fogNear, CONFIG.fogFar);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 60);
camera.position.set(0, 0.25, 8.2);

/* ----------------------------- lights ----------------------------- */

scene.add(new THREE.AmbientLight(0xffffff, 1.15));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(3, 5, 6);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0xe50914, 26, 18, 2);
rimLight.position.set(-4, -1.5, 3);
scene.add(rimLight);

const warmLight = new THREE.PointLight(0xff6a00, 18, 16, 2);
warmLight.position.set(4.5, 2.5, -2);
scene.add(warmLight);

/* --------------------------- textures ----------------------------- */

function makePosterTexture(hue, label) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = Math.round(size * 1.5);
  const ctx = c.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, c.width, c.height);
  gradient.addColorStop(0, `hsl(${hue}, 82%, 56%)`);
  gradient.addColorStop(0.55, `hsl(${(hue + 24) % 360}, 78%, 34%)`);
  gradient.addColorStop(1, `hsl(${(hue + 300) % 360}, 70%, 14%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * c.width,
      Math.random() * c.height,
      20 + Math.random() * 70,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, c.height - 64, c.width, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(label, 18, c.height - 24);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 1;
  return texture;
}

function makeScreenTexture() {
  const w = 256;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#17060b');
  bg.addColorStop(0.5, '#0b0b0f');
  bg.addColorStop(1, '#1a0a05');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const halo = ctx.createRadialGradient(w * 0.5, h * 0.42, 8, w * 0.5, h * 0.42, w * 0.85);
  halo.addColorStop(0, 'rgba(229,9,20,0.55)');
  halo.addColorStop(1, 'rgba(229,9,20,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.36);
  ctx.lineTo(w * 0.66, h * 0.44);
  ctx.lineTo(w * 0.42, h * 0.52);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText('Play Infinity', 24, h - 96);

  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.font = '500 13px system-ui, sans-serif';
  ctx.fillText('Movies · Anime · Live TV', 24, h - 74);

  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const wCard = 58;
    ctx.fillRect(24 + i * (wCard + 12), h - 56, wCard, 34);
  }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------- poster ring ---------------------------- */

const ring = new THREE.Group();
scene.add(ring);

const posterLabels = ['Action', 'Anime', 'Live', 'Drama', 'Sci-Fi', 'Comedy', 'Kids', 'News', 'Music', 'Docs'];
const posterGeometry = new THREE.PlaneGeometry(1.15, 1.72);

for (let i = 0; i < CONFIG.posters; i += 1) {
  const angle = (i / CONFIG.posters) * Math.PI * 2;
  const material = new THREE.MeshBasicMaterial({
    map: makePosterTexture(200 + i * 26, posterLabels[i % posterLabels.length]),
    transparent: true,
    opacity: 0.9,
  });
  const poster = new THREE.Mesh(posterGeometry, material);
  poster.position.set(
    Math.sin(angle) * CONFIG.ringRadius,
    Math.sin(i * 1.7) * 0.55,
    Math.cos(angle) * CONFIG.ringRadius,
  );
  poster.lookAt(0, poster.position.y, 0);
  poster.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.045;
  ring.add(poster);
}

/* --------------------------- phone -------------------------------- */

const phone = new THREE.Group();
phone.position.set(0, 0, 0.6);
phone.rotation.set(-0.06, 0.28, 0.02);
scene.add(phone);

const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x121218,
  roughness: 0.42,
  metalness: 0.65,
});
const body = new THREE.Mesh(new THREE.BoxGeometry(1.62, 3.24, 0.17), bodyMaterial);
phone.add(body);

const bezel = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 3.06, 0.02),
  new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.9 }),
);
bezel.position.z = 0.09;
phone.add(bezel);

const screen = new THREE.Mesh(
  new THREE.PlaneGeometry(1.4, 2.92),
  new THREE.MeshBasicMaterial({ map: makeScreenTexture() }),
);
screen.position.z = 0.101;
phone.add(screen);

const glowRing = new THREE.Mesh(
  new THREE.RingGeometry(1.95, 2.02, 64),
  new THREE.MeshBasicMaterial({
    color: 0xe50914,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  }),
);
glowRing.rotation.x = Math.PI / 2.2;
glowRing.position.set(0, -1.75, 0);
scene.add(glowRing);

/* -------------------------- particles ----------------------------- */

const particleCount = CONFIG.particles;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i += 1) {
  positions[i * 3] = (Math.random() - 0.5) * 16;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
}
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particles = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({
    color: 0xff8f8f,
    size: 0.035,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
scene.add(particles);

/* --------------------------- resize ------------------------------- */

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Keep the composition readable on tall phones and wide monitors.
  const scale = width < 860 ? 0.78 : 1;
  phone.scale.setScalar(scale);
  ring.scale.setScalar(scale);
  camera.position.z = width < 860 ? 9.4 : 8.2;
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resize, 120);
});

/* --------------------------- pointer ------------------------------ */

const pointer = { x: 0, y: 0 };
const target = { x: 0, y: 0 };

function onPointerMove(event) {
  const x = event.touches ? event.touches[0].clientX : event.clientX;
  const y = event.touches ? event.touches[0].clientY : event.clientY;
  target.x = (x / window.innerWidth - 0.5) * 2;
  target.y = (y / window.innerHeight - 0.5) * 2;
}

window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('touchmove', onPointerMove, { passive: true });

/* ---------------------------- loop -------------------------------- */

const clock = new THREE.Clock();
let running = true;
let frame = 0;

function renderFrame(delta, elapsed) {
  frame += 1;

  pointer.x += (target.x - pointer.x) * 0.045;
  pointer.y += (target.y - pointer.y) * 0.045;

  ring.rotation.y = elapsed * 0.09 + pointer.x * 0.18;
  ring.position.y = Math.sin(elapsed * 0.6) * 0.08;

  phone.position.y = Math.sin(elapsed * 0.9) * 0.11;
  phone.rotation.y = 0.28 + Math.sin(elapsed * 0.45) * 0.12 + pointer.x * 0.22;
  phone.rotation.x = -0.06 + pointer.y * -0.12;

  glowRing.rotation.z = elapsed * 0.2;
  glowRing.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.02);

  particles.rotation.y = elapsed * 0.02;
  particles.position.y = Math.sin(elapsed * 0.5) * 0.12;

  camera.position.x += (pointer.x * 0.35 - camera.position.x) * 0.05;
  camera.position.y += (0.25 - pointer.y * 0.22 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  // Throttle to ~30fps on weak hardware by skipping alternate frames.
  if (lowEnd && frame % 2 !== 0) return;

  renderer.render(scene, camera);
  void delta;
}

function animate() {
  if (!running) return;
  const delta = Math.min(clock.getDelta(), 0.05);
  renderFrame(delta, clock.elapsedTime);
  requestAnimationFrame(animate);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false;
  } else if (!reducedMotion) {
    running = true;
    clock.getDelta();
    requestAnimationFrame(animate);
  }
});

/* ---------------------------- boot -------------------------------- */

resize();

if (reducedMotion) {
  // Respect the OS setting: one composed frame, no motion.
  renderer.render(scene, camera);
} else {
  animate();
}

/* ------------------------ page metadata --------------------------- */

const VERSION = '2.1.0';
const SIZE = '14 MB';

const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = VERSION;
const sizeEl = document.getElementById('size');
if (sizeEl) sizeEl.textContent = SIZE;
document.querySelectorAll('.size-inline').forEach((el) => {
  el.textContent = SIZE;
});

const downloadBtn = document.getElementById('download-btn');
if (downloadBtn) {
  downloadBtn.addEventListener('click', () => {
    // Small confirmation so the tap feels acknowledged before the file starts.
    downloadBtn.classList.add('downloading');
    window.setTimeout(() => downloadBtn.classList.remove('downloading'), 1600);
  });
}
