import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

const tireMaterial = new THREE.MeshStandardMaterial({ color: '#18282c', roughness: 0.78 });
const rimMaterial = new THREE.MeshStandardMaterial({ color: '#d9d2bf', roughness: 0.35, metalness: 0.55 });
const darkMetal = new THREE.MeshStandardMaterial({ color: '#263c40', roughness: 0.45, metalness: 0.45 });
const featherMaterial = new THREE.MeshStandardMaterial({ color: '#fff4e2', roughness: 0.9 });
const featherShadeMaterial = new THREE.MeshStandardMaterial({ color: '#dfd0ba', roughness: 0.95 });
const beakMaterial = new THREE.MeshStandardMaterial({ color: '#f4a14c', roughness: 0.62 });
const pouchMaterial = new THREE.MeshStandardMaterial({ color: '#eb8f55', roughness: 0.72 });
const legMaterial = new THREE.MeshStandardMaterial({ color: '#e48d47', roughness: 0.7 });
const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#08272c' });
const eyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: '#fffdf5' });
const helmetStrapMaterial = new THREE.MeshStandardMaterial({ color: '#29393a', roughness: 0.7 });

function cylinderBetween(start, end, radius, material, radialSegments = 7) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, radialSegments), material);
  setCylinderBetween(mesh, start, end);
  return mesh;
}

const tmpDirection = new THREE.Vector3();
const tmpMid = new THREE.Vector3();

function setCylinderBetween(mesh, start, end) {
  tmpDirection.subVectors(end, start);
  const length = tmpDirection.length();
  tmpMid.addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(tmpMid);
  mesh.quaternion.setFromUnitVectors(UP, tmpDirection.normalize());
  mesh.scale.set(1, length, 1);
}

function makeBibTexture(number, name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  // The bib plane faces the chase camera, which mirrors its local X axis.
  ctx.translate(256, 0);
  ctx.scale(-1, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 246, 230, 0.7)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 98, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#062f36';
  ctx.textAlign = 'center';
  ctx.font = '900 92px Arial Black, Arial, sans-serif';
  ctx.fillText(number, 128, 142);
  ctx.font = '800 20px Arial, sans-serif';
  ctx.fillText(name, 128, 188);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makePlateTexture(number, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff6e6';
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = color;
  ctx.fillRect(9, 9, 238, 174);
  ctx.fillStyle = '#fff6e6';
  ctx.textAlign = 'center';
  ctx.font = '900 110px Arial Black, Arial, sans-serif';
  ctx.fillText(number, 128, 135);
  ctx.font = '800 20px Arial, sans-serif';
  ctx.fillText('PELICAN GP', 128, 168);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function addWheel(parent, z, x = 0) {
  const wheel = new THREE.Group();
  wheel.position.set(x, 0.46, z);
  parent.add(wheel);

  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.055, 7, 22), tireMaterial);
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.018, 5, 20), rimMaterial);
  rim.rotation.y = Math.PI / 2;
  wheel.add(rim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 8), darkMetal);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);

  const spokeGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.68, 4);
  for (let i = 0; i < 7; i += 1) {
    const spoke = new THREE.Mesh(spokeGeometry, rimMaterial);
    spoke.rotation.x = (i / 7) * Math.PI;
    wheel.add(spoke);
  }

  return wheel;
}

export class PelicanRacer {
  constructor({ id, name, number, jersey, accent, lane, isPlayer = false }) {
    this.id = id;
    this.name = name;
    this.number = number;
    this.jersey = jersey;
    this.accent = accent;
    this.lane = lane;
    this.baseLane = lane;
    this.isPlayer = isPlayer;
    this.progress = 0;
    this.speed = 0;
    this.energy = 100;
    this.boost = 0;
    this.finished = false;
    this.finishTime = 0;
    this.place = 0;
    this.celebrate = false;
    this.steerVelocity = 0;
    this.wheelSpin = 0;
    this.lean = 0;
    this._laneNoise = Math.random() * 10;

    this.group = new THREE.Group();
    this.chassis = new THREE.Group();
    this.group.add(this.chassis);

    this.frameMaterial = new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.42, metalness: 0.28 });
    this.accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.15 });
    this.jerseyMaterial = new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.82 });
    this.helmetMaterial = new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.36, metalness: 0.16 });

    this._buildBike();
    this._buildRider();
    this._buildBib();

    this.group.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = false;
    });
  }

  _buildBike() {
    const bike = new THREE.Group();
    this.bike = bike;
    this.chassis.add(bike);

    const rear = new THREE.Vector3(0, 0.46, -0.77);
    const front = new THREE.Vector3(0, 0.46, 0.79);
    const crank = new THREE.Vector3(0, 0.53, -0.03);
    const seat = new THREE.Vector3(0, 1.06, -0.36);
    const head = new THREE.Vector3(0, 1.03, 0.54);
    const handle = new THREE.Vector3(0, 1.2, 0.6);

    this.rearWheel = addWheel(bike, rear.z);
    this.frontWheel = addWheel(bike, front.z);

    const tubeRadius = 0.052;
    bike.add(cylinderBetween(rear, seat, tubeRadius, this.frameMaterial));
    bike.add(cylinderBetween(rear, crank, tubeRadius * 0.9, this.frameMaterial));
    bike.add(cylinderBetween(seat, crank, tubeRadius, this.frameMaterial));
    bike.add(cylinderBetween(seat, head, tubeRadius, this.frameMaterial));
    bike.add(cylinderBetween(crank, head, tubeRadius, this.frameMaterial));
    bike.add(cylinderBetween(head, front, 0.042, this.frameMaterial));
    bike.add(cylinderBetween(handle, head, 0.038, this.accentMaterial));

    // Fork and dropouts.
    for (const side of [-1, 1]) {
      bike.add(cylinderBetween(
        new THREE.Vector3(side * 0.07, 0.52, 0.74),
        new THREE.Vector3(side * 0.07, 0.91, 0.57),
        0.02,
        rimMaterial,
        5,
      ));
    }

    // Saddle.
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.085, 0.46), darkMetal);
    saddle.position.set(0, 1.11, -0.37);
    saddle.rotation.x = -0.08;
    bike.add(saddle);

    // Handlebar and grips.
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 7), rimMaterial);
    bar.rotation.z = Math.PI / 2;
    bar.position.copy(handle);
    bike.add(bar);
    for (const side of [-1, 1]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.19, 8), this.accentMaterial);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(side * 0.27, handle.y, handle.z);
      bike.add(grip);
    }

    // Crank, chainring and pedals.
    this.crankGroup = new THREE.Group();
    this.crankGroup.position.copy(crank);
    bike.add(this.crankGroup);

    const chainring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 5, 16), rimMaterial);
    chainring.rotation.y = Math.PI / 2;
    this.crankGroup.add(chainring);

    this.crankArms = [];
    for (let i = 0; i < 2; i += 1) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.035), darkMetal);
      arm.position.y = i === 0 ? 0.15 : -0.15;
      this.crankGroup.add(arm);
      const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.09), darkMetal);
      pedal.position.set(0, i === 0 ? 0.33 : -0.33, 0.02);
      this.crankGroup.add(pedal);
      this.crankArms.push(pedal);
    }

    // Chain suggestion.
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.008, 4, 16), darkMetal);
    chain.rotation.y = Math.PI / 2;
    chain.position.set(-0.06, crank.y, crank.z);
    bike.add(chain);

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.225),
      new THREE.MeshBasicMaterial({
        map: makePlateTexture(this.number, this.jersey),
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    plate.position.set(0, 0.92, 0.67);
    plate.rotation.y = Math.PI;
    bike.add(plate);
  }

  _buildRider() {
    const rider = new THREE.Group();
    rider.position.y = 0;
    this.rider = rider;
    this.chassis.add(rider);

    // Main body.
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 15), featherMaterial);
    body.scale.set(0.82, 1.08, 0.93);
    body.position.set(0, 1.72, -0.11);
    body.rotation.x = -0.08;
    rider.add(body);

    // Team jersey / vest.
    const jersey = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 15), this.jerseyMaterial);
    jersey.scale.set(0.83, 0.64, 0.94);
    jersey.position.set(0, 1.66, -0.09);
    rider.add(jersey);

    const jerseyStripe = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.026, 5, 24), this.accentMaterial);
    jerseyStripe.rotation.x = Math.PI / 2;
    jerseyStripe.position.set(0, 1.67, -0.09);
    jerseyStripe.scale.z = 1.02;
    rider.add(jerseyStripe);

    // Chest feathers peeking above the jersey.
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10), featherMaterial);
    chest.scale.set(0.8, 0.9, 0.6);
    chest.position.set(0, 1.96, 0.17);
    rider.add(chest);

    // Neck.
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.91, 0.19),
      new THREE.Vector3(0.01, 2.24, 0.27),
      new THREE.Vector3(0.01, 2.47, 0.36),
      new THREE.Vector3(0.02, 2.58, 0.47),
    ]);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 12, 0.185, 8, false), featherMaterial);
    rider.add(neck);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.67, 0.46);
    rider.add(this.headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.285, 18, 13), featherMaterial);
    head.scale.set(0.94, 1, 1.06);
    this.headGroup.add(head);

    // Beak and signature pouch.
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.135, 0.86, 10), beakMaterial);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.01, 0.41);
    beak.scale.y = 0.92;
    this.headGroup.add(beak);

    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 9), pouchMaterial);
    pouch.scale.set(0.85, 0.55, 2.2);
    pouch.position.set(0, -0.13, 0.48);
    pouch.rotation.x = -0.08;
    this.headGroup.add(pouch);

    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), eyeWhiteMaterial);
      eyeWhite.position.set(side * 0.21, 0.075, 0.15);
      this.headGroup.add(eyeWhite);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.029, 8, 6), eyeMaterial);
      pupil.position.set(side * 0.235, 0.082, 0.19);
      this.headGroup.add(pupil);
    }

    // Helmet.
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.305, 18, 11, 0, TAU, 0, Math.PI * 0.56),
      this.helmetMaterial,
    );
    helmet.position.set(0, 0.08, -0.01);
    helmet.scale.set(1.02, 0.95, 1.1);
    this.headGroup.add(helmet);

    const helmetStripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.238, 0.022, 4, 18, Math.PI),
      this.accentMaterial,
    );
    helmetStripe.rotation.set(Math.PI / 2, 0, 0);
    helmetStripe.position.set(0, 0.23, 0);
    this.headGroup.add(helmetStripe);

    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.16), this.accentMaterial);
    brim.position.set(0, 0.14, 0.27);
    brim.rotation.x = -0.14;
    this.headGroup.add(brim);

    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.27, 4), helmetStrapMaterial);
      strap.position.set(side * 0.245, -0.05, 0.09);
      strap.rotation.z = side * 0.2;
      this.headGroup.add(strap);
    }

    // Wings reaching to the handlebar.
    this.wings = [];
    for (const side of [-1, 1]) {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(side * 0.4, 1.92, 0.04);
      rider.add(wingGroup);

      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9), featherMaterial);
      wing.scale.set(0.7, 0.62, 2.5);
      wing.position.set(side * 0.08, -0.2, 0.4);
      wing.rotation.x = -0.3;
      wing.rotation.z = side * 0.18;
      wingGroup.add(wing);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 7), featherShadeMaterial);
      tip.scale.set(0.5, 0.38, 1.15);
      tip.position.set(side * 0.11, -0.32, 0.7);
      tip.rotation.x = -0.18;
      tip.rotation.z = side * 0.2;
      wingGroup.add(tip);

      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.52, 5), featherShadeMaterial);
      feather.rotation.x = -Math.PI / 2;
      feather.position.set(side * 0.09, -0.27, -0.09);
      wingGroup.add(feather);

      this.wings.push(wingGroup);
    }

    // Tail feathers.
    for (let i = 0; i < 3; i += 1) {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12 - i * 0.015, 0.56, 5), featherShadeMaterial);
      tail.rotation.x = -Math.PI / 2;
      tail.rotation.z = (i - 1) * 0.25;
      tail.position.set((i - 1) * 0.13, 1.66 - Math.abs(i - 1) * 0.04, -0.55);
      rider.add(tail);
    }

    // Orange legs connected to the pedals.
    this.legs = [];
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1, 6), legMaterial);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 1, 6), legMaterial);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), legMaterial);
      foot.scale.set(1, 0.45, 1.45);
      this.chassis.add(upper, lower, foot);
      this.legs.push({ side, upper, lower, foot });
    }

    this.riderBaseY = 0;
    this.headBaseY = 2.67;
  }

  _buildBib() {
    const bib = new THREE.Mesh(
      new THREE.PlaneGeometry(0.43, 0.43),
      new THREE.MeshBasicMaterial({
        map: makeBibTexture(this.number, this.name, this.accent),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    bib.position.set(0, 1.69, -0.568);
    bib.rotation.y = Math.PI;
    bib.rotation.x = 0.03;
    this.rider.add(bib);
    this.bib = bib;
  }

  setKit(jersey, accent) {
    this.jersey = jersey;
    this.accent = accent;
    this.jerseyMaterial.color.set(jersey);
    this.frameMaterial.color.set(jersey);
    this.helmetMaterial.color.set(jersey);
    this.accentMaterial.color.set(accent);
    this.bib.material.map.dispose();
    this.bib.material.map = makeBibTexture(this.number, this.name, accent);
    this.bib.material.needsUpdate = true;
  }

  reset() {
    this.progress = 0;
    this.speed = 0;
    this.energy = 100;
    this.boost = 0;
    this.finished = false;
    this.finishTime = 0;
    this.place = 0;
    this.celebrate = false;
    this.lean = 0;
    this.lane = this.baseLane;
  }

  update(dt, time, track, isRacing) {
    const frame = track.frameForProgress(this.progress);
    const position = frame.point.clone().addScaledVector(frame.right, this.lane);
    this.group.position.copy(position);
    this.group.rotation.y = Math.atan2(frame.tangent.x, frame.tangent.z);

    const targetLean = -this.steerVelocity * 0.032;
    this.lean += (THREE.MathUtils.clamp(targetLean, -0.16, 0.16) - this.lean) * Math.min(1, dt * 7);
    this.chassis.rotation.z = this.lean;

    const spin = this.speed * dt;
    this.wheelSpin += spin / 0.4;
    this.rearWheel.rotation.x = this.wheelSpin;
    this.frontWheel.rotation.x = this.wheelSpin;
    this.crankGroup.rotation.x += spin * 2.3;

    const angle = this.crankGroup.rotation.x;
    const pedalLift = 0.2;
    this.legs.forEach((leg) => {
      const pedalAngle = angle + (leg.side < 0 ? 0 : Math.PI);
      const pedalY = 0.53 + Math.cos(pedalAngle) * pedalLift;
      const pedalZ = -0.03 + Math.sin(pedalAngle) * pedalLift;
      const hip = new THREE.Vector3(leg.side * 0.235, 1.37, -0.05);
      const foot = new THREE.Vector3(leg.side * 0.3, pedalY, pedalZ + 0.02);
      const knee = new THREE.Vector3(
        leg.side * 0.28,
        (hip.y + foot.y) * 0.5 + 0.13,
        (hip.z + foot.z) * 0.5 + 0.2,
      );
      setCylinderBetween(leg.upper, hip, knee);
      setCylinderBetween(leg.lower, knee, foot);
      leg.foot.position.copy(foot);
    });

    const speedFactor = THREE.MathUtils.clamp(this.speed / 20, 0, 1.2);
    const bob = Math.sin(angle * 2) * 0.018 * speedFactor;
    const breathe = Math.sin(time * 2.1 + this._laneNoise) * 0.008;
    this.rider.position.y = bob + breathe + (this.celebrate ? Math.abs(Math.sin(time * 7)) * 0.13 : 0);

    const wingFlap = Math.sin(time * 14 + this._laneNoise) * (0.035 + speedFactor * 0.05);
    const boostFlap = this.boost > 0 || this.celebrate ? Math.sin(time * 22) * 0.2 : 0;
    this.wings[0].rotation.z = -0.04 + wingFlap - boostFlap;
    this.wings[1].rotation.z = 0.04 - wingFlap + boostFlap;
    this.wings[0].rotation.x = 0.05 + Math.sin(angle) * 0.025 * speedFactor;
    this.wings[1].rotation.x = 0.05 - Math.sin(angle) * 0.025 * speedFactor;

    this.headGroup.rotation.x = Math.sin(time * 2.7 + this._laneNoise) * 0.04 + (this.celebrate ? -0.18 : 0);
    this.headGroup.rotation.y = Math.sin(time * 1.4 + this._laneNoise) * 0.035;

    if (!isRacing && !this.finished) {
      this.wheelSpin *= 0.96;
    }
  }
}
