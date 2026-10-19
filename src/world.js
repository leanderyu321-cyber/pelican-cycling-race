import * as THREE from 'three';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function seededRandom(seed = 1) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function noiseTexture(size, base, dots, seed = 2) {
  return canvasTexture(size, size, (ctx, w, h) => {
    const random = seededRandom(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i += 1) {
      const alpha = random() * 0.14;
      ctx.fillStyle = `rgba(${dots[0]}, ${dots[1]}, ${dots[2]}, ${alpha})`;
      const radius = random() * 2.1 + 0.3;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, radius, 0, TAU);
      ctx.fill();
    }
  });
}

function setShadows(object, cast = true, receive = false) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = cast;
    child.receiveShadow = receive;
  });
}

/* ------------------------------------------------------------------ */
/* Track                                                               */
/* ------------------------------------------------------------------ */

export class RaceTrack {
  constructor() {
    this.curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0.42, -44),
        new THREE.Vector3(1, 0.42, 8),
        new THREE.Vector3(2, 0.42, 70),
        new THREE.Vector3(-2, 0.42, 136),
        new THREE.Vector3(-5, 0.42, 204),
        new THREE.Vector3(-2, 0.42, 270),
        new THREE.Vector3(3, 0.42, 330),
        new THREE.Vector3(4, 0.42, 396),
        new THREE.Vector3(1, 0.42, 458),
        new THREE.Vector3(-1, 0.42, 520),
        new THREE.Vector3(0, 0.42, 586),
        new THREE.Vector3(-1, 0.42, 648),
      ],
      false,
      'catmullrom',
      0.45,
    );
    this.curve.arcLengthDivisions = 1600;
    this.length = this.curve.getLength();
    this.raceStart = 34;
    this.raceDistance = 480;
    this.raceEnd = this.raceStart + this.raceDistance;

    this._point = new THREE.Vector3();
    this._tangent = new THREE.Vector3();
    this._right = new THREE.Vector3();
  }

  frameAt(distance) {
    const u = THREE.MathUtils.clamp(distance / this.length, 0, 1);
    const point = this.curve.getPointAt(u, this._point.clone());
    const tangent = this.curve.getTangentAt(u, this._tangent.clone());
    tangent.y = 0;
    tangent.normalize();
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    return { point, tangent, right, u };
  }

  roadPosition(progress, lane = 0, height = 0) {
    const frame = this.frameAt(this.raceStart + progress);
    return frame.point.clone().addScaledVector(frame.right, lane).add(new THREE.Vector3(0, height, 0));
  }

  headingAt(progress) {
    const frame = this.frameAt(this.raceStart + progress);
    return Math.atan2(frame.tangent.x, frame.tangent.z);
  }

  frameForProgress(progress) {
    return this.frameAt(this.raceStart + progress);
  }
}

function buildRibbon(track, left, right, segments, material, options = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const { height = 0, uvScale = 8, uvOffset = 0 } = options;

  for (let i = 0; i <= segments; i += 1) {
    const distance = (i / segments) * track.length;
    const frame = track.frameAt(distance);
    for (let side = 0; side < 2; side += 1) {
      const offset = side === 0 ? left : right;
      const p = frame.point.clone().addScaledVector(frame.right, offset);
      p.y += height;
      positions.push(p.x, p.y, p.z);
      uvs.push(side, (distance + uvOffset) / uvScale);
    }
    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function makeRoadTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const random = seededRandom(9);
    ctx.fillStyle = '#aa7a50';
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x < w; x += 64) {
      ctx.fillStyle = 'rgba(68, 42, 27, 0.55)';
      ctx.fillRect(x, 0, 3, h);
      ctx.fillStyle = 'rgba(255, 226, 178, 0.13)';
      ctx.fillRect(x + 3, 0, 2, h);
      const shade = 0.03 + random() * 0.06;
      ctx.fillStyle = `rgba(60, 35, 22, ${shade})`;
      ctx.fillRect(x + 5, 0, 59, h);
    }

    for (let i = 0; i < 1400; i += 1) {
      const x = random() * w;
      const y = random() * h;
      const length = 8 + random() * 90;
      ctx.strokeStyle = `rgba(61, 38, 24, ${0.025 + random() * 0.09})`;
      ctx.lineWidth = 0.5 + random() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 3, y + length * 0.3, x - 2, y + length * 0.7, x + 1, y + length);
      ctx.stroke();
    }

    for (let y = 0; y < h; y += 171) {
      ctx.fillStyle = 'rgba(55, 32, 21, 0.4)';
      ctx.fillRect(0, y, w, 3);
      ctx.fillStyle = 'rgba(255, 232, 188, 0.1)';
      ctx.fillRect(0, y + 3, w, 2);
    }

    ctx.fillStyle = 'rgba(255, 214, 161, 0.05)';
    ctx.fillRect(0, 0, w, 4);
  });
}

function makeCheckerTexture() {
  return canvasTexture(512, 96, (ctx, w, h) => {
    const cell = 32;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        ctx.fillStyle = (x / cell + y / cell) % 2 === 0 ? '#fff6e6' : '#102d32';
        ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.fillStyle = 'rgba(255, 107, 74, 0.85)';
    ctx.fillRect(0, h / 2 - 3, w, 6);
  });
}

function makeBannerTexture(label, dark = false) {
  return canvasTexture(1024, 192, (ctx, w, h) => {
    const bg = dark ? '#062f36' : '#0a3d45';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const size = 24;
    for (let x = 0; x < 170; x += size) {
      for (let y = 0; y < h; y += size) {
        ctx.fillStyle = (x / size + y / size) % 2 === 0 ? '#fff6e6' : '#ff6b4a';
        ctx.fillRect(x, y, size, size);
      }
    }
    for (let x = w - 170; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        ctx.fillStyle = ((x - (w - 170)) / size + y / size) % 2 === 0 ? '#fff6e6' : '#ff6b4a';
        ctx.fillRect(x, y, size, size);
      }
    }

    ctx.fillStyle = '#fff6e6';
    ctx.textAlign = 'center';
    ctx.font = '800 24px Arial, sans-serif';
    ctx.fillText('GULLWING BAY  ·  SEASIDE CUP', w / 2, 48);
    ctx.font = '900 98px Arial Black, Arial, sans-serif';
    ctx.letterSpacing = '10px';
    ctx.fillStyle = '#ffc247';
    ctx.fillText(label, w / 2, 145);
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 246, 230, 0.55)';
    ctx.fillText('PELICAN GRAND PRIX', w / 2, 174);
  });
}

function createGate(track, distance, label, colors) {
  const frame = track.frameAt(distance);
  const group = new THREE.Group();
  group.position.copy(frame.point);
  group.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z);

  const postMaterial = new THREE.MeshStandardMaterial({ color: colors.post, roughness: 0.55, metalness: 0.08 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#fff6e6', roughness: 0.8 });

  const postGeometry = new THREE.CylinderGeometry(0.2, 0.26, 7.4, 10);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(side * 8.25, 3.7, 0);
    post.castShadow = true;
    group.add(post);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.35, 12), trimMaterial);
    foot.position.set(side * 8.25, 0.15, 0);
    group.add(foot);
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(16.9, 0.24, 0.24), trimMaterial);
  beam.position.set(0, 7.45, 0);
  group.add(beam);

  const bannerMap = makeBannerTexture(label, colors.dark);
  const bannerMaterial = new THREE.MeshStandardMaterial({
    map: bannerMap,
    roughness: 0.85,
    side: THREE.FrontSide,
    emissive: colors.emissive || '#000000',
    emissiveIntensity: 0.08,
  });
  for (const facing of [0, Math.PI]) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(15.2, 2.65), bannerMaterial);
    banner.position.set(0, 5.9, facing === 0 ? 0.015 : -0.015);
    banner.rotation.y = facing;
    banner.castShadow = true;
    group.add(banner);
  }

  const fringeMaterial = new THREE.MeshStandardMaterial({ color: colors.post, roughness: 0.85, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i += 1) {
    const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 3), fringeMaterial);
    pennant.rotation.z = Math.PI;
    pennant.position.set(-7 + i * 1.08, 4.38, 0.02);
    group.add(pennant);
  }

  return group;
}

function createFlag(color, phase) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 3.6, 6),
    new THREE.MeshStandardMaterial({ color: '#f3e5cc', roughness: 0.6 }),
  );
  pole.position.y = 1.8;
  group.add(pole);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0.95, -0.35, 0, 0, -0.7, 0, 0, 0, 0, 0.95, -0.35, 0, 0, -0.7, 0], 3),
  );
  geometry.computeVertexNormals();
  const cloth = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }),
  );
  cloth.position.set(0, 3.55, 0);
  group.add(cloth);
  group.userData = { cloth, phase };
  return group;
}

/* ------------------------------------------------------------------ */
/* Palm tree                                                           */
/* ------------------------------------------------------------------ */

function createFrondGeometry() {
  const segments = 8;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const x = t * 3.3;
    const y = 0.48 * Math.sin(t * Math.PI) - 1.65 * t * t;
    const width = (1 - t) * 0.42 + 0.04;
    positions.push(x, y, -width, x, y + 0.09, width);
    if (i < segments) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const frondGeometry = createFrondGeometry();
const frondMaterial = new THREE.MeshStandardMaterial({
  color: '#3c7e55',
  roughness: 0.9,
  side: THREE.DoubleSide,
});
const frondTipMaterial = new THREE.MeshStandardMaterial({
  color: '#72a968',
  roughness: 0.9,
  side: THREE.DoubleSide,
});

function createPalm(scale = 1, lean = 0) {
  const group = new THREE.Group();
  const height = 6.2 * scale;
  const trunkPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.25, height * 0.34, 0.08),
    new THREE.Vector3(lean * 0.65, height * 0.68, -0.06),
    new THREE.Vector3(lean, height, 0.04),
  ];
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPoints);
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(trunkCurve, 12, 0.17 * scale, 7, false),
    new THREE.MeshStandardMaterial({ color: '#8d6848', roughness: 0.95 }),
  );
  trunk.castShadow = false;
  group.add(trunk);

  const crown = new THREE.Group();
  crown.position.copy(trunkPoints[trunkPoints.length - 1]);
  group.add(crown);

  const count = 8;
  for (let i = 0; i < count; i += 1) {
    const frond = new THREE.Mesh(frondGeometry, i % 2 === 0 ? frondMaterial : frondTipMaterial);
    frond.scale.setScalar(scale * (0.88 + (i % 3) * 0.08));
    frond.rotation.y = (i / count) * TAU + 0.25;
    frond.rotation.z = 0.1 + (i % 2) * 0.14;
    crown.add(frond);
  }

  const coconutMaterial = new THREE.MeshStandardMaterial({ color: '#5c4630', roughness: 0.8 });
  for (let i = 0; i < 3; i += 1) {
    const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.17 * scale, 8, 6), coconutMaterial);
    coconut.position.set(Math.cos(i * 2.1) * 0.24, -0.12, Math.sin(i * 2.1) * 0.24);
    crown.add(coconut);
  }

  group.userData.crown = crown;
  return group;
}

/* ------------------------------------------------------------------ */
/* Ocean                                                               */
/* ------------------------------------------------------------------ */

function createOcean() {
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#0b5b70') },
    uShallow: { value: new THREE.Color('#2db8ad') },
    uSky: { value: new THREE.Color('#ffcfaa') },
    uFog: { value: new THREE.Color('#f1c39c') },
    uSun: { value: new THREE.Vector3(-0.5, 0.19, 0.84).normalize() },
    uSunColor: { value: new THREE.Color('#ffe8b5') },
  };

  const geometry = new THREE.PlaneGeometry(980, 1280, 110, 120);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPosition;
      varying float vWave;

      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.052 + uTime * 0.78) * 0.26;
        float w2 = sin(p.y * 0.085 - uTime * 1.06) * 0.11;
        float w3 = sin((p.x + p.y) * 0.022 + uTime * 0.42) * 0.24;
        p.z += w1 + w2 + w3;
        vWave = w1 + w2 + w3;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uFog;
      uniform vec3 uSun;
      uniform vec3 uSunColor;
      varying vec3 vWorldPosition;
      varying float vWave;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float dx = cos(vWorldPosition.x * 0.052 + uTime * 0.78) * 0.052 * 0.26
                 + cos((vWorldPosition.x + vWorldPosition.z) * 0.022 + uTime * 0.42) * 0.022 * 0.24;
        float dz = sin(vWorldPosition.z * 0.085 + uTime * 1.06) * 0.085 * 0.11
                 + cos((vWorldPosition.x + vWorldPosition.z) * 0.022 + uTime * 0.42) * 0.022 * 0.24;
        vec3 normal = normalize(vec3(-dx, 1.0, dz));

        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.4);
        float horizon = smoothstep(160.0, 470.0, distance(cameraPosition.xz, vWorldPosition.xz));

        vec3 color = mix(uDeep, uShallow, smoothstep(-100.0, 100.0, vWorldPosition.x * 0.5 + 40.0));
        color = mix(color, uSky, fresnel * 0.72);
        color = mix(color, uFog, horizon * 0.78);

        vec3 reflected = reflect(-uSun, normal);
        float spec = pow(max(dot(reflected, viewDir), 0.0), 120.0);
        float glitter = pow(max(dot(reflected, viewDir), 0.0), 12.0);
        color += uSunColor * spec * 2.1;
        color += uSunColor * glitter * 0.12;

        float streak = sin(vWorldPosition.x * 0.34 + vWorldPosition.z * 0.18 + uTime * 0.6);
        color += uShallow * smoothstep(0.93, 1.0, streak) * 0.08;
        color += vec3(0.04, 0.08, 0.07) * smoothstep(0.5, 1.0, vWave);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(-520, -0.78, 280);
  mesh.receiveShadow = false;
  return { mesh, uniforms };
}

/* ------------------------------------------------------------------ */
/* Spectators                                                          */
/* ------------------------------------------------------------------ */

function createSpectator(color) {
  const group = new THREE.Group();
  const feather = new THREE.MeshStandardMaterial({ color: '#fff3df', roughness: 0.85 });
  const vest = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const orange = new THREE.MeshStandardMaterial({ color: '#f4a14c', roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), feather);
  body.scale.set(0.9, 1.35, 0.8);
  body.position.y = 0.58;
  group.add(body);

  const shirt = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 8), vest);
  shirt.scale.set(0.95, 0.75, 0.85);
  shirt.position.y = 0.46;
  group.add(shirt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), feather);
  head.position.set(0, 1.12, 0.03);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.38, 8), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.08, 0.32);
  group.add(beak);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshBasicMaterial({ color: '#062f36' }));
  eye.position.set(0.09, 1.17, 0.2);
  group.add(eye);

  group.scale.setScalar(1.05);
  return group;
}

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.track = new RaceTrack();
    this.flags = [];
    this.spectators = [];
    this.palms = [];
    this.gulls = [];
    this.buoys = [];
    this.clouds = [];
    this.time = 0;
    this.racing = false;

    this._setupAtmosphere();
    this._buildGround();
    this._buildTrack();
    this._buildGates();
    this._buildScenery();
    this._buildOcean();
    this._buildSkyDetails();
    this._setupShadowFocus();
  }

  _setupAtmosphere() {
    this.scene.fog = new THREE.FogExp2('#f2c49d', 0.00145);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(880, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color('#2d7188') },
          uMid: { value: new THREE.Color('#83b9b7') },
          uHorizon: { value: new THREE.Color('#ffd5aa') },
          uLow: { value: new THREE.Color('#ef9f78') },
          uSunDir: { value: new THREE.Vector3(-0.5, 0.19, 0.84).normalize() },
          uSunColor: { value: new THREE.Color('#ffdda0') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorldPosition;
          void main() {
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uMid;
          uniform vec3 uHorizon;
          uniform vec3 uLow;
          uniform vec3 uSunDir;
          uniform vec3 uSunColor;
          varying vec3 vWorldPosition;
          void main() {
            vec3 dir = normalize(vWorldPosition - cameraPosition);
            float height = dir.y;
            vec3 color = mix(uHorizon, uMid, smoothstep(-0.02, 0.22, height));
            color = mix(color, uTop, smoothstep(0.2, 0.8, height));
            color = mix(color, uLow, smoothstep(0.0, -0.16, height));
            float sun = max(dot(dir, uSunDir), 0.0);
            color += uSunColor * pow(sun, 5000.0) * 1.15;
            color += uSunColor * pow(sun, 120.0) * 0.23;
            color += uSunColor * pow(sun, 20.0) * 0.08;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    );
    sky.position.set(0, 0, 270);
    sky.renderOrder = -3;
    this.scene.add(sky);
    this.sky = sky;

    this.hemisphere = new THREE.HemisphereLight('#d5f3f1', '#c89464', 1.55);
    this.scene.add(this.hemisphere);

    this.sun = new THREE.DirectionalLight('#ffd3a3', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.camera.left = -26;
    this.sun.shadow.camera.right = 26;
    this.sun.shadow.camera.top = 32;
    this.sun.shadow.camera.bottom = -12;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const fill = new THREE.DirectionalLight('#76d8df', 0.55);
    fill.position.set(40, 28, -30);
    this.scene.add(fill);

    this.scene.add(new THREE.AmbientLight('#ffe8cf', 0.22));
  }

  _buildGround() {
    const sandTexture = noiseTexture(512, '#d9b482', [120, 86, 54], 17);
    sandTexture.wrapS = THREE.RepeatWrapping;
    sandTexture.wrapT = THREE.RepeatWrapping;
    sandTexture.repeat.set(26, 34);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(530, 1400, 1, 1),
      new THREE.MeshStandardMaterial({ map: sandTexture, color: '#f0d2a2', roughness: 1 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(235, -0.26, 280);
    // The western edge of the sand plane sits at x = -30, where the surf begins.
    sand.receiveShadow = true;
    this.scene.add(sand);

    const grassTexture = noiseTexture(256, '#6f8e59', [45, 64, 36], 5);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(18, 30);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 1300),
      new THREE.MeshStandardMaterial({ map: grassTexture, color: '#91a66a', roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(260, -0.18, 270);
    grass.receiveShadow = true;
    this.scene.add(grass);

    const random = seededRandom(4);
    const duneMaterial = new THREE.MeshStandardMaterial({ color: '#d4b480', roughness: 1, flatShading: true });
    const grassMaterial = new THREE.MeshStandardMaterial({ color: '#738f51', roughness: 1, flatShading: true });

    for (let i = 0; i < 22; i += 1) {
      const progress = -30 + random() * 690;
      const frame = this.track.frameAt(this.track.raceStart + progress);
      const side = random() > 0.15 ? 1 : -1;
      const offset = side > 0 ? 38 + random() * 42 : -(10 + random() * 4);
      const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 6), random() > 0.8 ? grassMaterial : duneMaterial);
      dune.position.copy(frame.point).addScaledVector(frame.right, offset);
      dune.position.y = -0.75 + random() * 0.2;
      dune.scale.set(7 + random() * 14, 1.3 + random() * 1.8, 4 + random() * 8);
      dune.rotation.y = random() * TAU;
      dune.receiveShadow = true;
      this.scene.add(dune);
    }

    const rockMaterial = new THREE.MeshStandardMaterial({ color: '#9b846b', roughness: 0.95, flatShading: true });
    for (let i = 0; i < 26; i += 1) {
      const progress = random() * 600;
      const frame = this.track.frameForProgress(progress);
      const side = random() > 0.45 ? 1 : -1;
      const offset = side > 0 ? 17 + random() * 46 : -(12 + random() * 4);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + random() * 1.4, 0), rockMaterial);
      rock.position.copy(frame.point).addScaledVector(frame.right, offset);
      rock.position.y = -0.2 + random() * 0.35;
      rock.scale.y = 0.5 + random() * 0.7;
      rock.rotation.set(random() * TAU, random() * TAU, random() * TAU);
      this.scene.add(rock);
    }
  }

  _buildTrack() {
    const roadTexture = makeRoadTexture();
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(2.2, 1);

    const road = buildRibbon(
      this.track,
      -7.7,
      7.7,
      680,
      new THREE.MeshStandardMaterial({
        map: roadTexture,
        color: '#e2b987',
        roughness: 0.91,
        metalness: 0,
      }),
      { height: 0, uvScale: 8.5 },
    );
    road.receiveShadow = true;
    this.scene.add(road);

    const darkWood = new THREE.MeshStandardMaterial({ color: '#79583c', roughness: 0.92 });
    const cream = new THREE.MeshStandardMaterial({ color: '#f5e6c9', roughness: 0.75 });
    const coralPaint = new THREE.MeshStandardMaterial({ color: '#e76043', roughness: 0.75 });

    this.scene.add(buildRibbon(this.track, -8.25, -7.68, 600, darkWood, { height: 0.03 }));
    this.scene.add(buildRibbon(this.track, 7.68, 8.25, 600, darkWood, { height: 0.03 }));
    this.scene.add(buildRibbon(this.track, -7.35, -7.15, 600, cream, { height: 0.045 }));
    this.scene.add(buildRibbon(this.track, 7.15, 7.35, 600, cream, { height: 0.045 }));

    // Dashed centre line.
    const dashGeometry = new THREE.BoxGeometry(0.1, 0.015, 2.25);
    const dashCount = 48;
    const dashes = new THREE.InstancedMesh(dashGeometry, cream, dashCount);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < dashCount; i += 1) {
      const progress = 5 + i * 10;
      const frame = this.track.frameForProgress(progress);
      const yaw = Math.atan2(frame.tangent.x, frame.tangent.z);
      rotation.setFromEuler(new THREE.Euler(0, yaw, 0));
      matrix.compose(frame.point.clone().add(new THREE.Vector3(0, 0.045, 0)), rotation, scale);
      dashes.setMatrixAt(i, matrix);
    }
    dashes.instanceMatrix.needsUpdate = true;
    this.scene.add(dashes);

    // Boardwalk supports.
    const supportGeometry = new THREE.CylinderGeometry(0.13, 0.16, 0.72, 6);
    const supportCount = 86;
    const supports = new THREE.InstancedMesh(supportGeometry, darkWood, supportCount);
    let supportIndex = 0;
    for (let i = 0; i < 43; i += 1) {
      const frame = this.track.frameAt(this.track.raceStart + i * 15);
      for (const offset of [-7.7, 7.7]) {
        if (supportIndex >= supportCount) break;
        const p = frame.point.clone().addScaledVector(frame.right, offset);
        const m = new THREE.Matrix4().makeTranslation(p.x, 0.04, p.z);
        supports.setMatrixAt(supportIndex, m);
        supportIndex += 1;
      }
    }
    this.scene.add(supports);

    // Railing posts and rail.
    const postGeometry = new THREE.CylinderGeometry(0.06, 0.075, 1.1, 6);
    const postMaterial = new THREE.MeshStandardMaterial({ color: '#f3e4c8', roughness: 0.6 });
    const postCount = 180;
    const posts = new THREE.InstancedMesh(postGeometry, postMaterial, postCount);
    const railPointsLeft = [];
    const railPointsRight = [];
    let postIndex = 0;
    for (let i = 0; i < 90; i += 1) {
      const distance = this.track.raceStart - 20 + i * 7.3;
      const frame = this.track.frameAt(distance);
      for (const offset of [-9.0, 9.0]) {
        if (postIndex >= postCount) break;
        const p = frame.point.clone().addScaledVector(frame.right, offset);
        posts.setMatrixAt(postIndex, new THREE.Matrix4().makeTranslation(p.x, 0.97, p.z));
        postIndex += 1;
        if (offset < 0) railPointsLeft.push(p.clone().add(new THREE.Vector3(0, 1.23, 0)));
        else railPointsRight.push(p.clone().add(new THREE.Vector3(0, 1.23, 0)));
      }
    }
    this.scene.add(posts);

    for (const points of [railPointsLeft, railPointsRight]) {
      if (points.length < 2) continue;
      const railCurve = new THREE.CatmullRomCurve3(points);
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(railCurve, 300, 0.035, 4, false),
        new THREE.MeshStandardMaterial({ color: '#efdfc4', roughness: 0.5 }),
      );
      this.scene.add(rail);
    }

    // Checkered start and finish bands.
    const checker = makeCheckerTexture();
    checker.wrapS = THREE.RepeatWrapping;
    checker.wrapT = THREE.RepeatWrapping;
    checker.repeat.set(2, 1);
    for (const progress of [12, this.track.raceDistance]) {
      const frame = this.track.frameForProgress(progress);
      const band = new THREE.Mesh(
        new THREE.PlaneGeometry(15.3, 1.55),
        new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 }),
      );
      band.rotation.x = -Math.PI / 2;
      band.rotation.z = -Math.atan2(frame.tangent.x, frame.tangent.z);
      band.position.copy(frame.point).add(new THREE.Vector3(0, 0.052, 0));
      band.receiveShadow = true;
      this.scene.add(band);
    }

    // Painted route details.
    const chevronMaterial = new THREE.MeshBasicMaterial({ color: '#ff6b4a', transparent: true, opacity: 0.72 });
    for (const progress of [this.track.raceDistance * 0.5, this.track.raceDistance * 0.8]) {
      const frame = this.track.frameForProgress(progress);
      for (const offset of [-0.26, 0.26]) {
        const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1.6), chevronMaterial);
        mark.rotation.x = -Math.PI / 2;
        mark.rotation.z = -Math.atan2(frame.tangent.x, frame.tangent.z) + offset;
        mark.position.copy(frame.point).addScaledVector(frame.right, offset * 6);
        mark.position.y += 0.055;
        this.scene.add(mark);
      }
    }

    // Edge flags.
    for (let i = 0; i < 36; i += 1) {
      const progress = i * 15 - 8;
      const frame = this.track.frameForProgress(progress);
      for (const side of [-1, 1]) {
        if (i % 3 === 0 || side > 0) {
          const flag = createFlag(i % 2 === 0 ? '#ff6b4a' : '#ffc247', i * 0.6 + side);
          flag.position.copy(frame.point).addScaledVector(frame.right, side * 10.05);
          flag.userData.baseY = flag.position.y;
          this.scene.add(flag);
          this.flags.push(flag);
        }
      }
    }

    // Start-line camera tower.
    const tower = new THREE.Group();
    const frame = this.track.frameForProgress(20);
    tower.position.copy(frame.point).addScaledVector(frame.right, 11.5);
    tower.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z);
    const towerMat = new THREE.MeshStandardMaterial({ color: '#52615d', roughness: 0.8 });
    for (const x of [-0.8, 0.8]) {
      for (const z of [-0.55, 0.55]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.8, 0.1), towerMat);
        leg.position.set(x, 1.9, z);
        tower.add(leg);
      }
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 1.7), new THREE.MeshStandardMaterial({ color: '#c89a61', roughness: 0.8 }));
    deck.position.y = 3.7;
    tower.add(deck);
    const cameraBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: '#102d32', roughness: 0.5 }));
    cameraBox.position.set(0, 4.25, 0);
    tower.add(cameraBox);
    this.scene.add(tower);
  }

  _buildGates() {
    const start = createGate(this.track, this.track.raceStart + 12, 'START', {
      post: '#1a5960',
      dark: false,
      emissive: '#ff6b4a',
    });
    this.scene.add(start);

    const finish = createGate(this.track, this.track.raceEnd, 'FINISH', {
      post: '#ff6b4a',
      dark: true,
      emissive: '#ffc247',
    });
    this.scene.add(finish);
    this.finishGate = finish;
  }

  _buildScenery() {
    const random = seededRandom(22);

    for (let i = 0; i < 28; i += 1) {
      const progress = -30 + i * 23 + random() * 12;
      const side = i % 2 === 0 ? -1 : 1;
      const offset = side < 0 ? -(11.5 + random() * 3.2) : 17 + random() * 11;
      const frame = this.track.frameForProgress(progress);
      const palm = createPalm(0.78 + random() * 0.5, (random() - 0.5) * 2.2);
      palm.position.copy(frame.point).addScaledVector(frame.right, offset);
      palm.position.y = -0.22;
      palm.rotation.y = random() * TAU;
      palm.userData.phase = random() * TAU;
      this.scene.add(palm);
      this.palms.push(palm);
    }

    // Beach umbrellas.
    const umbrellaColors = ['#ff6b4a', '#ffc247', '#24b9ac', '#f28f6e'];
    for (let i = 0; i < 14; i += 1) {
      const progress = 15 + i * 39 + random() * 12;
      const frame = this.track.frameForProgress(progress);
      const group = new THREE.Group();
      group.position.copy(frame.point).addScaledVector(frame.right, -(18 + random() * 6));
      group.position.y = -0.25;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.045, 2.8, 6),
        new THREE.MeshStandardMaterial({ color: '#f4e3c9', roughness: 0.7 }),
      );
      pole.position.y = 1.4;
      group.add(pole);
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.55, 0.67, 10),
        new THREE.MeshStandardMaterial({ color: umbrellaColors[i % umbrellaColors.length], roughness: 0.82, side: THREE.DoubleSide }),
      );
      canopy.position.y = 2.75;
      canopy.castShadow = false;
      group.add(canopy);
      group.rotation.z = (random() - 0.5) * 0.12;

      const towel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.25, 2.1),
        new THREE.MeshStandardMaterial({ color: umbrellaColors[(i + 2) % umbrellaColors.length], roughness: 0.95, side: THREE.DoubleSide }),
      );
      towel.rotation.x = -Math.PI / 2;
      towel.rotation.z = random() * TAU;
      towel.position.set(1.4, 0.02, 0.4);
      group.add(towel);
      this.scene.add(group);
    }

    // Start and finish crowd.
    const crowdColors = ['#ff6b4a', '#ffc247', '#20c4b5', '#f6e5c8', '#ef8c67', '#6eb7ee'];
    for (let i = 0; i < 22; i += 1) {
      const progress = i < 12 ? 1 + i * 2.1 : 454 + (i - 12) * 2.1;
      const side = i % 2 === 0 ? 1 : -1;
      const frame = this.track.frameForProgress(progress);
      const spectator = createSpectator(crowdColors[i % crowdColors.length]);
      spectator.position.copy(frame.point).addScaledVector(frame.right, side * (10.3 + random() * 1.2));
      spectator.position.y = 0.38;
      spectator.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z) + (side > 0 ? -0.5 : 0.5);
      spectator.userData.phase = random() * TAU;
      spectator.userData.baseY = spectator.position.y;
      this.scene.add(spectator);
      this.spectators.push(spectator);
    }

    // Beach balls and buoys.
    const buoyColors = ['#ff6b4a', '#ffc247', '#f7ead4'];
    for (let i = 0; i < 9; i += 1) {
      const group = new THREE.Group();
      group.position.set(-95 - random() * 170, -0.6, 80 + random() * 400);
      const buoy = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 12, 8),
        new THREE.MeshStandardMaterial({ color: buoyColors[i % buoyColors.length], roughness: 0.55 }),
      );
      buoy.scale.y = 0.76;
      group.add(buoy);
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: '#f4e4cc', roughness: 0.7 }),
      );
      tip.position.y = 0.42;
      group.add(tip);
      group.userData.phase = random() * TAU;
      group.userData.baseY = group.position.y;
      this.scene.add(group);
      this.buoys.push(group);
    }

    // Low beach volleyball net for a little life.
    const netGroup = new THREE.Group();
    const netFrame = this.track.frameForProgress(120);
    netGroup.position.copy(netFrame.point).addScaledVector(netFrame.right, -24);
    netGroup.position.y = -0.2;
    const netMat = new THREE.MeshBasicMaterial({ color: '#f7edda', transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    for (const x of [-2, 2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#eee0c9' }));
      post.position.set(x, 1.2, 0);
      netGroup.add(post);
    }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.85), netMat);
    net.position.set(0, 1.8, 0);
    netGroup.add(net);
    this.scene.add(netGroup);

    // Sailboats.
    for (let i = 0; i < 3; i += 1) {
      const boat = new THREE.Group();
      boat.position.set(-160 - i * 58, -0.35, 270 + i * 80);
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 0.5, 1.3),
        new THREE.MeshStandardMaterial({ color: '#f4e6d0', roughness: 0.7 }),
      );
      hull.position.y = 0.2;
      boat.add(hull);
      const sailMaterial = new THREE.MeshStandardMaterial({ color: i === 1 ? '#ff6b4a' : '#fff1dc', roughness: 0.8, side: THREE.DoubleSide });
      const sailGeo = new THREE.BufferGeometry();
      sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.4, 0, 0, 5.3, 0, 1.9, 0.55, 0], 3));
      sailGeo.computeVertexNormals();
      const sail = new THREE.Mesh(sailGeo, sailMaterial);
      sail.position.x = -0.8;
      boat.add(sail);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 5, 5), new THREE.MeshStandardMaterial({ color: '#b28a5e' }));
      mast.position.set(-0.8, 2.7, 0);
      boat.add(mast);
      boat.rotation.y = -0.4 + i * 0.4;
      boat.userData.phase = i * 1.8;
      this.scene.add(boat);
      this.buoys.push(boat);
    }

    this._buildClouds();
    this._buildGulls();
  }

  _buildClouds() {
    const random = seededRandom(31);
    const material = new THREE.MeshBasicMaterial({
      color: '#ffe9d2',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    });

    for (let i = 0; i < 8; i += 1) {
      const cloud = new THREE.Group();
      cloud.position.set(-140 + random() * 430, 52 + random() * 48, 180 + random() * 430);
      const count = 3 + Math.floor(random() * 4);
      for (let j = 0; j < count; j += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
        puff.position.set((j - count / 2) * 8 + random() * 5, random() * 4, random() * 5);
        puff.scale.set(8 + random() * 8, 2.4 + random() * 2.2, 4 + random() * 4);
        cloud.add(puff);
      }
      cloud.userData.speed = 0.45 + random() * 0.5;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  _buildGulls() {
    const material = new THREE.MeshBasicMaterial({ color: '#fdf4e2', side: THREE.DoubleSide });
    const darkMaterial = new THREE.MeshBasicMaterial({ color: '#c6aa8d', side: THREE.DoubleSide });
    for (let i = 0; i < 8; i += 1) {
      const gull = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), material);
      body.scale.set(0.7, 0.6, 1.7);
      gull.add(body);
      const wings = [];
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.19, 1.15, 4), side < 0 ? material : darkMaterial);
        wing.rotation.z = side * Math.PI * 0.5;
        wing.rotation.x = Math.PI * 0.5;
        wing.position.x = side * 0.5;
        gull.add(wing);
        wings.push(wing);
      }
      gull.userData = {
        wings,
        radius: 15 + Math.random() * 35,
        height: 13 + Math.random() * 16,
        phase: Math.random() * TAU,
        speed: 0.1 + Math.random() * 0.09,
        center: new THREE.Vector3(-10 + Math.random() * 50, 0, 30 + Math.random() * 300),
      };
      gull.scale.setScalar(1.2);
      this.scene.add(gull);
      this.gulls.push(gull);
    }
  }

  _buildOcean() {
    const ocean = createOcean();
    this.scene.add(ocean.mesh);
    this.ocean = ocean;

    const foamMaterial = new THREE.MeshBasicMaterial({
      color: '#fff1dc',
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    this.foamStrips = [];
    for (let i = 0; i < 4; i += 1) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.55 + i * 0.28, 1050), foamMaterial);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(-34.5 - i * 3.2, -0.72 + i * 0.015, 280);
      strip.userData.baseX = strip.position.x;
      strip.userData.phase = i * 1.4;
      this.scene.add(strip);
      this.foamStrips.push(strip);
    }

    const shoreWetSand = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 1200),
      new THREE.MeshStandardMaterial({ color: '#cbaa7b', roughness: 0.55, metalness: 0.08 }),
    );
    shoreWetSand.rotation.x = -Math.PI / 2;
    shoreWetSand.position.set(-31.5, -0.58, 280);
    this.scene.add(shoreWetSand);
  }

  _buildSkyDetails() {
    // Distant islands give the horizon a stronger silhouette.
    const islandMat = new THREE.MeshBasicMaterial({ color: '#507c7e', fog: false });
    const islands = [
      { x: 170, z: 620, s: [95, 18, 42] },
      { x: -360, z: 760, s: [140, 22, 58] },
      { x: -230, z: 900, s: [80, 13, 35] },
    ];
    for (const island of islands) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 8, 0, TAU, 0, Math.PI / 2), islandMat);
      mesh.position.set(island.x, -1, island.z);
      mesh.scale.set(...island.s);
      this.scene.add(mesh);
    }
  }

  _setupShadowFocus() {
    this.shadowFocus = new THREE.Vector3(0, 0, 0);
  }

  setShadowFocus(position) {
    this.shadowFocus.copy(position);
    this.sun.position.set(position.x - 52, position.y + 78, position.z + 42);
    this.sun.target.position.copy(position);
    this.sun.target.updateMatrixWorld();
  }

  update(dt, elapsed, isRacing) {
    this.time = elapsed;
    this.racing = isRacing;
    if (this.ocean) this.ocean.uniforms.uTime.value = elapsed;

    for (const flag of this.flags) {
      const cloth = flag.userData.cloth;
      cloth.rotation.y = Math.sin(elapsed * 3.1 + flag.userData.phase) * 0.15;
      cloth.scale.x = 0.86 + Math.sin(elapsed * 4.6 + flag.userData.phase) * 0.14;
    }

    for (const spectator of this.spectators) {
      const bounce = isRacing ? Math.abs(Math.sin(elapsed * 5.2 + spectator.userData.phase)) * 0.11 : 0;
      spectator.position.y = spectator.userData.baseY + bounce;
      spectator.rotation.z = Math.sin(elapsed * 4 + spectator.userData.phase) * (isRacing ? 0.035 : 0.012);
    }

    for (const palm of this.palms) {
      palm.rotation.z = Math.sin(elapsed * 0.75 + palm.userData.phase) * 0.012;
      palm.userData.crown.rotation.y = Math.sin(elapsed * 0.4 + palm.userData.phase) * 0.02;
    }

    for (const buoy of this.buoys) {
      buoy.position.y = buoy.userData.baseY + Math.sin(elapsed * 1.25 + buoy.userData.phase) * 0.1;
      buoy.rotation.z = Math.sin(elapsed * 0.9 + buoy.userData.phase) * 0.05;
    }

    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 350) cloud.position.x = -210;
    }

    for (const gull of this.gulls) {
      const d = gull.userData;
      const angle = elapsed * d.speed + d.phase;
      gull.position.set(
        d.center.x + Math.cos(angle) * d.radius,
        d.height + Math.sin(elapsed * 0.8 + d.phase) * 1.3,
        d.center.z + Math.sin(angle) * d.radius,
      );
      gull.rotation.y = -angle + Math.PI / 2;
      const flap = Math.sin(elapsed * 6 + d.phase);
      for (let i = 0; i < d.wings.length; i += 1) {
        const side = i === 0 ? -1 : 1;
        d.wings[i].rotation.x = Math.PI * 0.5 + side * flap * 0.28;
      }
    }

    this.foamStrips.forEach((strip, index) => {
      strip.position.x = strip.userData.baseX + Math.sin(elapsed * 0.55 + strip.userData.phase) * (1.4 + index * 0.5);
      strip.material.opacity = 0.3 + Math.sin(elapsed * 0.75 + index) * 0.09;
    });
  }
}
