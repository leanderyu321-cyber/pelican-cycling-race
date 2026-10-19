import * as THREE from 'three';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/manrope';
import './style.css';
import { World } from './world.js';
import { PelicanRacer } from './racer.js';
import { RaceAudio } from './audio.js';

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

const container = document.querySelector('#scene-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 1400);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const world = new World(scene, renderer);
const track = world.track;
const audio = new RaceAudio();

const clock = new THREE.Clock();
const KITS = {
  coral: { jersey: '#ff6b4a', accent: '#ffe4c3', label: 'CORAL CRUISER' },
  teal: { jersey: '#20c4b5', accent: '#fff0b3', label: 'LAGOON DASH' },
  mango: { jersey: '#ffc247', accent: '#244b4e', label: 'MANGO WINGS' },
};

const RACER_CONFIG = [
  { name: 'MARLIN', number: '07', jersey: '#4a9edb', accent: '#ffe9bd', lane: -5.15 },
  { name: 'BREEZE', number: '12', jersey: '#8fca6d', accent: '#fff1d4', lane: -3.08 },
  { name: 'SUNNY', number: '03', jersey: '#ffc247', accent: '#173f43', lane: -1.03 },
  { name: 'YOU', number: '01', jersey: KITS.coral.jersey, accent: KITS.coral.accent, lane: 1.03, isPlayer: true },
  { name: 'TIDE', number: '18', jersey: '#66c6c0', accent: '#ffb47a', lane: 3.08 },
  { name: 'ROSE', number: '22', jersey: '#ff8eaa', accent: '#fff0da', lane: 5.15 },
];

const racers = RACER_CONFIG.map((config, index) => {
  const racer = new PelicanRacer({ id: index, ...config });
  scene.add(racer.group);
  return racer;
});
const player = racers.find((racer) => racer.isPlayer);
const aiRacers = racers.filter((racer) => !racer.isPlayer);
let aiProfiles = [];

function prepareAIProfiles() {
  aiProfiles = aiRacers.map((racer, index) => ({
    racer,
    base: 18.15 + index * 0.29 + Math.random() * 0.6,
    phase: Math.random() * 8,
    laneTimer: 2.5 + Math.random() * 3,
    targetLane: racer.baseLane,
    finishBias: Math.random() * 0.45,
  }));
}
prepareAIProfiles();

/* ------------------------------------------------------------------ */
/* Fish pickups                                                        */
/* ------------------------------------------------------------------ */

function createFishPickup(progress, lane) {
  const group = new THREE.Group();
  const fishMaterial = new THREE.MeshStandardMaterial({
    color: '#ffb72f',
    emissive: '#ff8b20',
    emissiveIntensity: 0.55,
    roughness: 0.42,
    metalness: 0.15,
  });
  const finMaterial = new THREE.MeshStandardMaterial({
    color: '#ffdf8a',
    emissive: '#ff9b25',
    emissiveIntensity: 0.28,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), fishMaterial);
  body.scale.set(0.62, 0.82, 1.5);
  group.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), finMaterial);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -0.92;
  group.add(tail);

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 4), finMaterial);
  dorsal.position.set(0, 0.47, -0.08);
  dorsal.rotation.z = Math.PI;
  group.add(dorsal);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 7, 6),
      new THREE.MeshBasicMaterial({ color: '#102f33' }),
    );
    eye.position.set(side * 0.22, 0.13, 0.48);
    group.add(eye);
  }

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.92, 0.045, 6, 28),
    new THREE.MeshBasicMaterial({ color: '#ffc247', transparent: true, opacity: 0.72 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -1.36;
  group.add(halo);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.82, 1.3, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#ffc247',
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = -0.7;
  group.add(beam);

  group.scale.setScalar(1.3);
  scene.add(group);
  return {
    group,
    halo,
    body,
    progress,
    lane,
    collected: false,
    phase: progress * 0.021,
    baseY: 0,
  };
}

const fishPickups = [
  createFishPickup(126, -4.45),
  createFishPickup(262, 4.45),
  createFishPickup(392, -0.4),
];

function resetFish() {
  for (const fish of fishPickups) {
    fish.collected = false;
    fish.group.visible = true;
  }
}

/* ------------------------------------------------------------------ */
/* Confetti                                                            */
/* ------------------------------------------------------------------ */

const CONFETTI_COUNT = 420;
const confettiPositions = new Float32Array(CONFETTI_COUNT * 3);
const confettiColors = new Float32Array(CONFETTI_COUNT * 3);
const confettiVelocities = new Float32Array(CONFETTI_COUNT * 3);
const confettiPalette = ['#ff6b4a', '#ffc247', '#fff6e6', '#20c4b5', '#ff8eaa', '#74b6ef'];
for (let i = 0; i < CONFETTI_COUNT; i += 1) {
  const color = new THREE.Color(confettiPalette[i % confettiPalette.length]);
  confettiColors[i * 3] = color.r;
  confettiColors[i * 3 + 1] = color.g;
  confettiColors[i * 3 + 2] = color.b;
}
const confettiGeometry = new THREE.BufferGeometry();
confettiGeometry.setAttribute('position', new THREE.BufferAttribute(confettiPositions, 3));
confettiGeometry.setAttribute('color', new THREE.BufferAttribute(confettiColors, 3));
const confettiMaterial = new THREE.PointsMaterial({
  size: 0.22,
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  sizeAttenuation: true,
});
const confetti = new THREE.Points(confettiGeometry, confettiMaterial);
confetti.visible = false;
confetti.frustumCulled = false;
scene.add(confetti);

function burstConfetti(position) {
  for (let i = 0; i < CONFETTI_COUNT; i += 1) {
    confettiPositions[i * 3] = position.x + (Math.random() - 0.5) * 17;
    confettiPositions[i * 3 + 1] = position.y + 3 + Math.random() * 10;
    confettiPositions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 7;
    confettiVelocities[i * 3] = (Math.random() - 0.5) * 5.5;
    confettiVelocities[i * 3 + 1] = 1 + Math.random() * 5;
    confettiVelocities[i * 3 + 2] = (Math.random() - 0.5) * 3.5;
  }
  confettiGeometry.attributes.position.needsUpdate = true;
  confetti.visible = true;
}

function updateConfetti(dt) {
  if (!confetti.visible) return;
  for (let i = 0; i < CONFETTI_COUNT; i += 1) {
    confettiVelocities[i * 3 + 1] -= 7.2 * dt;
    confettiPositions[i * 3] += confettiVelocities[i * 3] * dt;
    confettiPositions[i * 3 + 1] += confettiVelocities[i * 3 + 1] * dt;
    confettiPositions[i * 3 + 2] += confettiVelocities[i * 3 + 2] * dt;
    if (confettiPositions[i * 3 + 1] < 0.1) {
      confettiPositions[i * 3 + 1] = 9 + Math.random() * 4;
      confettiVelocities[i * 3 + 1] = 0.8 + Math.random() * 3.4;
    }
  }
  confettiGeometry.attributes.position.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */

let state = 'title';
let raceStartedAt = 0;
let raceElapsed = 0;
let countdownStartedAt = 0;
let countdownStep = -1;
let countdownHideAt = 0;
let finishShownAt = 0;
let resultsShown = false;
let cameraMode = 0;
let playerExhausted = false;
let fishCollected = 0;
let finalOrder = [];
let toastTimer = 0;
let cameraSnapped = false;

const keys = {
  left: false,
  right: false,
  sprint: false,
};

let bestTime = null;
try {
  const stored = window.localStorage.getItem('pelican-grand-prix-best');
  if (stored) bestTime = Number.parseFloat(stored);
} catch {
  bestTime = null;
}

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

const dom = {
  intro: document.querySelector('#intro'),
  hud: document.querySelector('#hud'),
  countdown: document.querySelector('#countdown'),
  countdownNumber: document.querySelector('#countdown-number'),
  countdownCaption: document.querySelector('#countdown-caption'),
  toast: document.querySelector('#toast'),
  toastText: document.querySelector('#toast-text'),
  toastIcon: document.querySelector('#toast-icon'),
  results: document.querySelector('#results'),
  resultsTitle: document.querySelector('#results-title'),
  resultsCopy: document.querySelector('#results-copy'),
  resultPlace: document.querySelector('#result-place'),
  resultTime: document.querySelector('#result-time'),
  resultFish: document.querySelector('#result-fish'),
  medal: document.querySelector('#medal'),
  podium: document.querySelector('#podium'),
  positionText: document.querySelector('#position-text'),
  positionTeam: document.querySelector('#position-team'),
  distanceText: document.querySelector('#distance-text'),
  timerText: document.querySelector('#timer-text'),
  bestTime: document.querySelector('#best-time'),
  speedText: document.querySelector('#speed-text'),
  energyFill: document.querySelector('#energy-fill'),
  fishText: document.querySelector('#fish-text'),
  progressFill: document.querySelector('#progress-fill'),
  progressMarkers: document.querySelector('#progress-markers'),
  nextMark: document.querySelector('#next-mark'),
  nextMarkSub: document.querySelector('#next-mark-sub'),
  tipText: document.querySelector('#tip-text'),
  sprintHint: document.querySelector('#sprint-hint'),
  touchControls: document.querySelector('#touch-controls'),
  kitName: document.querySelector('#kit-name'),
  loading: document.querySelector('#loading'),
  helpPanel: document.querySelector('#help-panel'),
  soundToggle: document.querySelector('#sound-toggle'),
  cameraToggle: document.querySelector('#camera-toggle'),
};

const markerElements = new Map();
for (const racer of racers) {
  const marker = document.createElement('span');
  marker.className = `progress-marker${racer.isPlayer ? ' is-player' : ''}`;
  marker.style.setProperty('--marker-color', racer.accent);
  if (racer.isPlayer) marker.style.setProperty('--marker-color', racer.jersey);
  dom.progressMarkers.appendChild(marker);
  markerElements.set(racer.id, marker);
}

dom.bestTime.textContent = bestTime ? formatTime(bestTime, false) : '--:--';

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function formatTime(seconds, tenths = true) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  if (!tenths) {
    return `${String(minutes).padStart(2, '0')}:${String(Math.floor(rest)).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}

function ordinalPlace(place) {
  return String(place).padStart(2, '0');
}

const PLACE_TITLES = {
  1: '漂亮的一冲！',
  2: '银羽冲线！',
  3: '登上领奖台！',
  4: '差一点就追上了',
  5: '海风有点大',
  6: '长嘴也有大梦想',
};

const PLACE_COPY = {
  1: '海风、鱼和第一名，今天都归你。',
  2: '只差半个翅膀的距离，下一圈就是你的。',
  3: '稳稳站上领奖台，羽毛还保持得很蓬松。',
  4: '前面的鸟群不好追，但你已经跑出自己的节奏。',
  5: '这场比赛很挤，回程再练一圈吧。',
  6: '最后一名也有最长的嘴，再来一次怎么样？',
};

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */

function showToast(text, icon = '✦') {
  window.clearTimeout(toastTimer);
  dom.toastText.textContent = text;
  dom.toastIcon.textContent = icon;
  dom.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), 1400);
}

function setCountdownDisplay(text, caption, isGo = false) {
  dom.countdown.classList.remove('is-hidden');
  dom.countdownNumber.textContent = text;
  dom.countdownNumber.classList.toggle('is-go', isGo);
  dom.countdownCaption.textContent = caption;
  dom.countdownNumber.classList.remove('count-pop');
  // Force a reflow so the pop animation restarts for each number.
  void dom.countdownNumber.offsetWidth;
  dom.countdownNumber.classList.add('count-pop');
}

function hideCountdown() {
  dom.countdown.classList.add('is-hidden');
  dom.countdownNumber.classList.remove('count-pop');
}

function updateKit(kitName) {
  const kit = KITS[kitName];
  if (!kit) return;
  player.setKit(kit.jersey, kit.accent);
  dom.kitName.textContent = kit.label;
  document.querySelectorAll('.swatch').forEach((button) => {
    const active = button.dataset.kit === kitName;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

function isTouchLayout() {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
}

/* ------------------------------------------------------------------ */
/* Race lifecycle                                                      */
/* ------------------------------------------------------------------ */

function resetRacers() {
  racers.forEach((racer, index) => {
    racer.reset();
    racer.lane = RACER_CONFIG[index].lane;
    racer.baseLane = RACER_CONFIG[index].lane;
    racer.speed = 0;
    racer.progress = 0;
    racer.steerVelocity = 0;
    racer.finished = false;
    racer.finishTime = 0;
    racer.place = 0;
    racer.celebrate = false;
    racer.group.rotation.z = 0;
    racer.chassis.rotation.z = 0;
  });
  prepareAIProfiles();
}

function getTitleCameraSetup() {
  const portrait = window.innerWidth / window.innerHeight < 0.86;
  return portrait
    ? { right: 20, back: -36, height: 9, lookRight: 0, lookAhead: 4, lookHeight: 1.0, fov: 50 }
    : { right: 20, back: -18, height: 8, lookRight: 6, lookAhead: 8, lookHeight: 1.2, fov: 53 };
}

function resetCameraForTitle() {
  const focus = track.roadPosition(3, 0, 1.3);
  const frame = track.frameForProgress(3);
  const setup = getTitleCameraSetup();
  camera.position
    .copy(focus)
    .addScaledVector(frame.right, setup.right)
    .addScaledVector(frame.tangent, setup.back)
    .add(new THREE.Vector3(0, setup.height, 0));
  camera.lookAt(
    focus
      .clone()
      .addScaledVector(frame.right, setup.lookRight)
      .addScaledVector(frame.tangent, setup.lookAhead)
      .add(new THREE.Vector3(0, setup.lookHeight, 0)),
  );
  camera.fov = setup.fov;
  camera.updateProjectionMatrix();
  cameraSnapped = true;
}

function startRace() {
  audio.ensure();
  audio.ui();
  resetRacers();
  resetFish();
  fishCollected = 0;
  playerExhausted = false;
  raceElapsed = 0;
  countdownStep = -1;
  countdownHideAt = 0;
  finishShownAt = 0;
  resultsShown = false;
  finalOrder = [];
  confetti.visible = false;
  cameraMode = 0;
  state = 'countdown';
  countdownStartedAt = performance.now();

  dom.intro.classList.add('is-hidden');
  dom.results.classList.add('is-hidden');
  dom.helpPanel.classList.add('is-hidden');
  dom.hud.classList.remove('is-hidden');
  dom.touchControls.classList.toggle('is-hidden', !isTouchLayout());
  dom.speedText.textContent = '0';
  dom.energyFill.style.width = '100%';
  dom.fishText.textContent = '0';
  dom.sprintHint.classList.remove('is-boosted');
  dom.medal.className = 'medal';
  dom.positionTeam.textContent = dom.kitName.textContent;
  setCountdownDisplay('3', '把翅膀放在车把上');
  audio.countdown(false);
}

function goTitle() {
  state = 'title';
  resetRacers();
  resetFish();
  fishCollected = 0;
  finalOrder = [];
  confetti.visible = false;
  dom.intro.classList.remove('is-hidden');
  dom.hud.classList.add('is-hidden');
  dom.results.classList.add('is-hidden');
  dom.touchControls.classList.add('is-hidden');
  dom.helpPanel.classList.add('is-hidden');
  hideCountdown();
  dom.positionTeam.textContent = dom.kitName.textContent;
  dom.fishText.textContent = '0';
  resetCameraForTitle();
}

function finishRacer(racer, time) {
  if (racer.finished) return;
  racer.finished = true;
  racer.progress = track.raceDistance;
  racer.finishTime = time;
  racer.place = racers.filter((item) => item.finished).length;
  racer.speed = Math.min(racer.speed, 4);
  if (racer.isPlayer) {
    racer.celebrate = true;
  }
}

function playerFinish() {
  raceElapsed = (performance.now() - raceStartedAt) / 1000;
  finishRacer(player, raceElapsed);
  player.progress = track.raceDistance;
  state = 'finished';
  finishShownAt = performance.now();
  resultsShown = false;
  dom.touchControls.classList.add('is-hidden');
  const podiums = player.place <= 3;
  audio.finish(podiums);
  burstConfetti(track.roadPosition(track.raceDistance, 0, 0.5));

  // Assign remaining places based on track position at the moment the player crosses.
  const unfinished = racers
    .filter((racer) => !racer.finished)
    .sort((a, b) => b.progress - a.progress);
  unfinished.forEach((racer, index) => {
    racer.place = racers.filter((item) => item.finished).length + index + 1;
    racer.finishTime = raceElapsed + Math.max(0, (track.raceDistance - racer.progress) / Math.max(9, racer.speed));
    racer.speed *= 0.4;
  });

  finalOrder = [...racers].sort((a, b) => a.place - b.place);
  if (!bestTime || raceElapsed < bestTime) {
    bestTime = raceElapsed;
    try {
      window.localStorage.setItem('pelican-grand-prix-best', String(bestTime));
    } catch {
      // Storage is optional; the race still works without it.
    }
    dom.bestTime.textContent = formatTime(bestTime, false);
  }
}

function showResults() {
  resultsShown = true;
  state = 'results';
  const place = player.place;
  dom.resultsTitle.textContent = PLACE_TITLES[place] || '比赛结束';
  dom.resultsCopy.textContent = PLACE_COPY[place] || '这一圈属于你。';
  dom.resultPlace.textContent = `${place} / ${racers.length}`;
  dom.resultTime.textContent = formatTime(player.finishTime);
  dom.resultFish.textContent = `${fishCollected} / ${fishPickups.length}`;
  dom.medal.textContent = ordinalPlace(place);
  dom.medal.className = `medal place-${Math.min(place, 4)}`;

  dom.podium.replaceChildren();
  for (const racer of finalOrder) {
    const row = document.createElement('div');
    row.className = `podium-row${racer.isPlayer ? ' is-player' : ''}`;
    const rank = document.createElement('span');
    rank.className = 'podium-rank';
    rank.textContent = String(racer.place).padStart(2, '0');
    const dot = document.createElement('span');
    dot.className = 'podium-dot';
    dot.style.setProperty('--dot-color', racer.accent);
    const name = document.createElement('span');
    name.className = 'podium-name';
    name.textContent = racer.isPlayer ? `你 · ${dom.kitName.textContent}` : racer.name;
    const time = document.createElement('span');
    time.className = 'podium-time';
    time.textContent = formatTime(racer.finishTime);
    row.append(rank, dot, name, time);
    dom.podium.appendChild(row);
  }

  dom.results.classList.remove('is-hidden');
}

/* ------------------------------------------------------------------ */
/* Gameplay update                                                     */
/* ------------------------------------------------------------------ */

function updateCountdown(now) {
  const elapsed = (now - countdownStartedAt) / 1000;
  const step = elapsed < 0.9 ? 0 : elapsed < 1.8 ? 1 : elapsed < 2.7 ? 2 : 3;
  if (step !== countdownStep) {
    countdownStep = step;
    if (step === 0) {
      setCountdownDisplay('3', '把翅膀放在车把上');
      audio.countdown(false);
    } else if (step === 1) {
      setCountdownDisplay('2', '眼睛盯住第一个鱼跃点');
      audio.countdown(false);
    } else if (step === 2) {
      setCountdownDisplay('1', '海风已经准备好了');
      audio.countdown(false);
    } else if (step === 3) {
      setCountdownDisplay('GO!', '冲出海风线', true);
      audio.countdown(true);
      state = 'racing';
      raceStartedAt = performance.now();
      raceElapsed = 0;
      countdownHideAt = now + 700;
    }
  }
}

function collectFish(fish) {
  fish.collected = true;
  fish.group.visible = false;
  fishCollected += 1;
  player.energy = Math.min(100, player.energy + 25);
  player.boost = Math.max(player.boost, 2.15);
  playerExhausted = false;
  dom.fishText.textContent = String(fishCollected);
  showToast('鲭鱼加速！体力 +25', '✦');
  audio.fish();
  audio.boost();
}

function updatePlayer(dt) {
  if (state !== 'racing') return;

  const wantsSprint = keys.sprint && !playerExhausted;
  const sprinting = wantsSprint && player.energy > 0.5;

  if (player.boost > 0) {
    player.boost = Math.max(0, player.boost - dt);
  }

  if (sprinting) {
    player.energy = Math.max(0, player.energy - 23.5 * dt);
    if (player.energy <= 0.2) playerExhausted = true;
  } else {
    player.energy = Math.min(100, player.energy + (playerExhausted ? 19 : 14.5) * dt);
    if (playerExhausted && player.energy >= 34) playerExhausted = false;
  }

  let targetSpeed = 16.35;
  if (sprinting) targetSpeed = 24.5;
  if (player.boost > 0) targetSpeed = 29;
  const response = player.boost > 0 ? 2.9 : sprinting ? 1.9 : 1.15;
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * response);
  if (sprinting) player.speed += 0.9 * dt;
  player.speed = Math.max(0, player.speed);

  const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const previousLane = player.lane;
  player.lane = THREE.MathUtils.clamp(player.lane + steer * 4.8 * dt, -5.75, 5.75);
  player.steerVelocity = (player.lane - previousLane) / Math.max(dt, 0.001);

  const previousProgress = player.progress;
  player.progress += player.speed * dt;

  // Collect fish by passing through their little pocket of light.
  for (const fish of fishPickups) {
    if (fish.collected) continue;
    if (Math.abs(fish.progress - player.progress) < 2.5 && Math.abs(fish.lane - player.lane) < 1.45) {
      collectFish(fish);
    }
  }

  if (previousProgress < track.raceDistance && player.progress >= track.raceDistance) {
    player.progress = track.raceDistance;
    playerFinish();
    return;
  }

  player.progress = Math.min(player.progress, track.raceDistance);
}

function updateAI(dt, time) {
  for (const profile of aiProfiles) {
    const racer = profile.racer;
    if (racer.finished) {
      racer.speed = Math.max(2.4, racer.speed - dt * 3.5);
      continue;
    }
    if (state !== 'racing') continue;

    if (time > profile.laneTimer) {
      profile.laneTimer = time + 2.8 + Math.random() * 3.7;
      const swing = (Math.random() - 0.5) * 4.2;
      profile.targetLane = THREE.MathUtils.clamp(racer.baseLane + swing, -5.55, 5.55);
    }

    const rubberBand = THREE.MathUtils.clamp((player.progress - racer.progress) * 0.075, -1.0, 2.8);
    const rhythm = Math.sin(time * 0.72 + profile.phase) * 0.55;
    const finishKick = racer.progress > 360 ? THREE.MathUtils.clamp((racer.progress - 360) / 100, 0, 1) * 1.25 : 0;
    const targetSpeed = profile.base + rhythm + rubberBand + finishKick + profile.finishBias;
    racer.speed += (targetSpeed - racer.speed) * Math.min(1, dt * 1.25);

    const previousLane = racer.lane;
    const laneDelta = THREE.MathUtils.clamp(profile.targetLane - racer.lane, -1.6, 1.6);
    racer.lane += laneDelta * dt * 1.55;
    racer.steerVelocity = (racer.lane - previousLane) / Math.max(dt, 0.001);

    racer.progress += racer.speed * dt;
    if (racer.progress >= track.raceDistance) {
      racer.progress = track.raceDistance;
      finishRacer(racer, (performance.now() - raceStartedAt) / 1000);
      racer.celebrate = true;
    }
  }
}

function updateFish(time) {
  for (const fish of fishPickups) {
    if (fish.collected) continue;
    const frame = track.frameForProgress(fish.progress);
    const base = frame.point.clone().addScaledVector(frame.right, fish.lane);
    fish.group.position.set(
      base.x,
      base.y + 2.25 + Math.sin(time * 2.1 + fish.phase) * 0.18,
      base.z,
    );
    fish.group.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z) + time * 0.7;
    fish.halo.rotation.z = time * 0.9;
    fish.halo.scale.setScalar(1 + Math.sin(time * 2.4 + fish.phase) * 0.08);
  }
}

function updateRacers(dt, time) {
  const racingVisual = state === 'racing' || state === 'finished' || state === 'results';
  for (const racer of racers) {
    if (racer.finished && state !== 'racing') {
      racer.speed += (0 - racer.speed) * Math.min(1, dt * 1.4);
    }
    racer.update(dt, time, track, racingVisual);
  }
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

let hudTick = 0;

function updateHUD(dt) {
  hudTick += 1;
  const visibleElapsed = state === 'racing' ? (performance.now() - raceStartedAt) / 1000 : raceElapsed;
  if (state === 'racing') raceElapsed = visibleElapsed;

  const playerPct = (player.progress / track.raceDistance) * 100;
  dom.progressFill.style.width = `${Math.min(100, playerPct)}%`;
  dom.distanceText.textContent = String(Math.round(Math.min(player.progress, track.raceDistance)));
  dom.timerText.textContent = formatTime(state === 'finished' || state === 'results' ? player.finishTime : visibleElapsed);
  dom.speedText.textContent = String(Math.round(player.speed * 3.6));
  dom.energyFill.style.width = `${player.energy.toFixed(1)}%`;
  dom.fishText.textContent = String(fishCollected);

  let place = 1;
  for (const racer of racers) {
    if (racer === player) continue;
    if (racer.finished || racer.progress > player.progress + 0.001) place += 1;
  }
  dom.positionText.textContent = String(place);
  if (player.boost > 0 || (keys.sprint && !playerExhausted)) {
    dom.sprintHint.classList.add('is-boosted');
    dom.sprintHint.querySelector('span').textContent = player.boost > 0 ? '鲭鱼加速中' : '冲刺中';
  } else {
    dom.sprintHint.classList.remove('is-boosted');
    dom.sprintHint.querySelector('span').textContent = playerExhausted ? '体力恢复中' : '按住';
  }

  for (const racer of racers) {
    const marker = markerElements.get(racer.id);
    if (!marker) continue;
    marker.style.left = `${Math.min(100, (racer.progress / track.raceDistance) * 100)}%`;
    marker.style.opacity = racer.finished ? '1' : '0.9';
  }

  if (hudTick % 5 === 0) {
    const nextFish = fishPickups
      .filter((fish) => !fish.collected && fish.progress > player.progress - 2)
      .sort((a, b) => a.progress - b.progress)[0];
    if (nextFish) {
      dom.nextMark.textContent = `FISH · ${Math.round(nextFish.progress)}M`;
      dom.nextMarkSub.textContent = '变向抢鱼，补充体力';
    } else {
      dom.nextMark.textContent = 'FINISH · 480M';
      dom.nextMarkSub.textContent = player.progress > 400 ? '最后冲刺' : '保持节奏';
    }

    let tip = '按住空格冲刺，松开恢复体力';
    if (player.boost > 0) tip = '鲭鱼能量已上线，全速前进！';
    else if (nextFish && nextFish.progress - player.progress < 32) tip = '前方有鱼跃点，提前调整车道';
    else if (place > 3 && player.progress > 90) tip = '从外道绕过去，别吃别人的尾流';
    else if (player.progress > track.raceDistance - 75) tip = '最后一段了，把翅膀交给风';
    else if (hudTick > 120) tip = '观察对手，寻找下一个超越点';
    dom.tipText.textContent = tip;
  }
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

const cameraDesired = new THREE.Vector3();
const cameraLook = new THREE.Vector3();
const cameraLookDesired = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();

function dampVector(current, target, lambda, dt) {
  current.lerp(target, 1 - Math.exp(-lambda * dt));
}

function updateCamera(dt, time) {
  const frame = track.frameForProgress(player.progress);
  const playerPosition = frame.point.clone().addScaledVector(frame.right, player.lane);

  if (state === 'title') {
    const focus = track.roadPosition(3, 0, 1.4);
    const titleFrame = track.frameForProgress(3);
    const setup = getTitleCameraSetup();
    const orbit = Math.sin(time * 0.12) * (camera.aspect < 0.86 ? 0.9 : 1.5);
    cameraDesired
      .copy(focus)
      .addScaledVector(titleFrame.right, setup.right + orbit)
      .addScaledVector(titleFrame.tangent, setup.back - Math.cos(time * 0.09) * 1.2)
      .add(new THREE.Vector3(0, setup.height + Math.sin(time * 0.2) * 0.22, 0));
    cameraLookDesired
      .copy(focus)
      .addScaledVector(titleFrame.right, setup.lookRight)
      .addScaledVector(titleFrame.tangent, setup.lookAhead)
      .add(new THREE.Vector3(0, setup.lookHeight + 0.15, 0));
    if (!cameraSnapped) {
      camera.position.copy(cameraDesired);
      cameraLook.copy(cameraLookDesired);
      cameraSnapped = true;
    } else {
      dampVector(camera.position, cameraDesired, 1.5, dt);
      dampVector(cameraLook, cameraLookDesired, 2.0, dt);
    }
    camera.fov += (getTitleCameraSetup().fov - camera.fov) * Math.min(1, dt * 2);
    camera.lookAt(cameraLook);
    camera.updateProjectionMatrix();
    return;
  }

  if (state === 'finished' || state === 'results') {
    const finishFrame = track.frameForProgress(track.raceDistance);
    const center = finishFrame.point.clone().add(new THREE.Vector3(0, 1.65, 0));
    const drift = Math.sin(time * 0.24) * 2.2;
    cameraDesired
      .copy(center)
      .addScaledVector(finishFrame.tangent, 17.5 + Math.cos(time * 0.2) * 1.8)
      .addScaledVector(finishFrame.right, 7.2 + drift)
      .add(new THREE.Vector3(0, 6.2, 0));
    cameraLookDesired.copy(center).addScaledVector(finishFrame.tangent, -0.5).addScaledVector(finishFrame.right, 0.6);
    dampVector(camera.position, cameraDesired, 1.55, dt);
    dampVector(cameraLook, cameraLookDesired, 2.1, dt);
    camera.fov += (52 - camera.fov) * Math.min(1, dt * 2);
    camera.lookAt(cameraLook);
    camera.updateProjectionMatrix();
    return;
  }

  // Chase camera.
  if (cameraMode === 0) {
    const lean = player.steerVelocity * 0.24;
    cameraDesired
      .copy(playerPosition)
      .addScaledVector(frame.tangent, -8.8)
      .addScaledVector(frame.right, lean + Math.sin(time * 1.6) * 0.04)
      .add(new THREE.Vector3(0, 4.35 + Math.sin(time * 8.5) * 0.025, 0));
    cameraLookDesired
      .copy(playerPosition)
      .addScaledVector(frame.tangent, 9.8)
      .addScaledVector(frame.right, player.steerVelocity * 0.38)
      .add(new THREE.Vector3(0, 1.65, 0));
  } else {
    cameraDesired
      .copy(playerPosition)
      .addScaledVector(frame.right, 8.6)
      .addScaledVector(frame.tangent, -2.2)
      .add(new THREE.Vector3(0, 4.2, 0));
    cameraLookDesired
      .copy(playerPosition)
      .addScaledVector(frame.tangent, 4.0)
      .add(new THREE.Vector3(0, 1.7, 0));
  }

  const speedRatio = THREE.MathUtils.clamp(player.speed / 28, 0, 1);
  const lambda = state === 'countdown' ? 2.2 : 4.8;
  dampVector(camera.position, cameraDesired, lambda, dt);
  dampVector(cameraLook, cameraLookDesired, state === 'countdown' ? 3.2 : 5.5, dt);
  const shake = speedRatio * 0.035;
  tempVector.copy(cameraDesired);
  tempVector2.copy(cameraLook);
  camera.position.x += Math.sin(time * 38) * shake;
  camera.position.y += Math.cos(time * 31) * shake * 0.45;

  const targetFov = 54 + speedRatio * 8 + (cameraMode === 1 ? 3 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 2.5);
  camera.lookAt(cameraLook);
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

function bindHold(element, key) {
  if (!element) return;
  const press = (event) => {
    event.preventDefault();
    keys[key] = true;
    if (element.setPointerCapture && event.pointerId !== undefined) {
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is a nice-to-have only.
      }
    }
  };
  const release = (event) => {
    if (event) event.preventDefault();
    keys[key] = false;
  };
  element.addEventListener('pointerdown', press);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('pointerleave', release);
  element.addEventListener('contextmenu', (event) => event.preventDefault());
}

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyW'].includes(code)) {
    event.preventDefault();
  }
  if (event.repeat) return;

  if (code === 'KeyA' || code === 'ArrowLeft') keys.left = true;
  if (code === 'KeyD' || code === 'ArrowRight') keys.right = true;
  if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') keys.sprint = true;

  if (code === 'KeyC') {
    cameraMode = (cameraMode + 1) % 2;
    showToast(cameraMode === 0 ? '追尾视角' : '电影视角', '◎');
    audio.ui();
  }
  if (code === 'KeyM') {
    toggleSound();
  }
  if (code === 'Escape') {
    dom.helpPanel.classList.add('is-hidden');
  }
  if (code === 'Enter') {
    if (state === 'title') startRace();
    else if (state === 'results') startRace();
  }
});

window.addEventListener('keyup', (event) => {
  const code = event.code;
  if (code === 'KeyA' || code === 'ArrowLeft') keys.left = false;
  if (code === 'KeyD' || code === 'ArrowRight') keys.right = false;
  if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') keys.sprint = false;
});

window.addEventListener('blur', () => {
  keys.left = false;
  keys.right = false;
  keys.sprint = false;
});

bindHold(document.querySelector('#touch-left'), 'left');
bindHold(document.querySelector('#touch-right'), 'right');
bindHold(document.querySelector('#touch-sprint'), 'sprint');

document.querySelector('#start-button').addEventListener('click', startRace);
document.querySelector('#replay-button').addEventListener('click', startRace);
document.querySelector('#home-button').addEventListener('click', goTitle);

document.querySelectorAll('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    updateKit(button.dataset.kit);
    audio.ui();
  });
});

function toggleSound() {
  audio.ensure();
  audio.setMuted(!audio.muted);
  document.body.classList.toggle('is-muted', audio.muted);
  dom.soundToggle.setAttribute('aria-label', audio.muted ? '打开声音' : '关闭声音');
  if (!audio.muted) audio.ui();
}

dom.soundToggle.addEventListener('click', toggleSound);

dom.cameraToggle.addEventListener('click', () => {
  if (state === 'title' || state === 'countdown') return;
  cameraMode = (cameraMode + 1) % 2;
  showToast(cameraMode === 0 ? '追尾视角' : '电影视角', '◎');
  audio.ui();
});

document.querySelector('#help-toggle').addEventListener('click', () => {
  dom.helpPanel.classList.toggle('is-hidden');
  audio.ui();
});
document.querySelector('#help-close').addEventListener('click', () => {
  dom.helpPanel.classList.add('is-hidden');
});

/* ------------------------------------------------------------------ */
/* Main loop                                                           */
/* ------------------------------------------------------------------ */

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const now = performance.now();

  if (state === 'countdown') {
    updateCountdown(now);
    updateHUD(dt);
  }

  if (countdownHideAt && now >= countdownHideAt) {
    hideCountdown();
    countdownHideAt = 0;
  }

  if (state === 'racing') {
    updatePlayer(dt);
    updateAI(dt, time);
    updateHUD(dt);
  } else if (state === 'finished') {
    if (!resultsShown && now - finishShownAt > 1250) {
      showResults();
    }
    updateHUD(dt);
  }

  updateFish(time);
  updateRacers(dt, time);
  world.update(dt, time, state === 'racing' || state === 'finished');
  updateConfetti(dt);

  const shadowPos = state === 'title' ? track.roadPosition(0, 0, 0) : player.group.position;
  world.setShadowFocus(tempVector.copy(shadowPos));

  updateCamera(dt, time);
  audio.update(time, state);
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ */
/* Resize and boot                                                     */
/* ------------------------------------------------------------------ */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  dom.touchControls.classList.toggle('is-hidden', !isTouchLayout() || state === 'title' || state === 'results' || state === 'finished');
});

if (import.meta.env.DEV) {
  window.__APP = { scene, camera, renderer, track, racers, player, fishPickups, world, getState: () => state };
}
resetCameraForTitle();
updateFish(0);
updateRacers(0.016, 0);
world.update(0.016, 0, false);
world.setShadowFocus(track.roadPosition(0, 0, 0));
renderer.render(scene, camera);
animate();

window.setTimeout(() => {
  dom.loading.classList.add('is-done');
}, 650);
