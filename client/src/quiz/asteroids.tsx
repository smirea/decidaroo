import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button.tsx';
import { decidingOptions } from '../../../shared/constants.ts';
import { emptyOptionPoints, quizScreen, type OptionPoints, type QuizScreenProps } from './quizScreen.tsx';
import { addOptionScore, CompactScoreHud, ScoreChips, type ScoreDelta, useAnimatedScores } from './scoreHud.tsx';

type AsteroidsScreenConfig = {
	title: string;
};

type DecidingOption = (typeof decidingOptions)[number];
type AsteroidSize = 'small' | 'big';

type Bounds = {
	width: number;
	height: number;
};

type ShipState = {
	position: THREE.Vector2;
	velocity: THREE.Vector2;
	facing: THREE.Vector2;
};

type PointerTarget = {
	active: boolean;
	arrived: boolean;
	point: THREE.Vector2;
};

type Bullet = {
	mesh: THREE.Mesh;
	position: THREE.Vector2;
	velocity: THREE.Vector2;
	radius: number;
	age: number;
};

type Asteroid = {
	group: THREE.Group;
	option: DecidingOption;
	size: AsteroidSize;
	position: THREE.Vector2;
	velocity: THREE.Vector2;
	radius: number;
	rotation: THREE.Vector3;
	rotationVelocity: THREE.Vector3;
};

type Debris = {
	mesh: THREE.Mesh;
	position: THREE.Vector2;
	velocity: THREE.Vector2;
	rotationVelocity: THREE.Vector3;
	age: number;
	lifetime: number;
	material: THREE.MeshBasicMaterial;
};

type ShipParts = {
	group: THREE.Group;
	body: THREE.Mesh;
	rearFlame: THREE.Mesh;
	brakeFlames: THREE.Mesh[];
};

const gameMs = 60_000;
const baseFireInterval = 850;
const coastingSpeed = 0.32;
const shipAcceleration = 7.4;
const shipInitialAcceleration = 12.2;
const shipInitialAccelerationMaxSpeed = 1.35;
const shipBrake = 5.6;
const shipMaxSpeed = 3;
const shipRadius = 0.14;
const shipArrivalRadius = 0.12;
const shipSteering = 13;
const bulletSpeed = 4.1;
const shootSoundUrl = '/sfx/asteroids-shoot.ogg';
const breakSoundUrl = '/sfx/asteroids-break.ogg';

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number) {
	return min + Math.random() * (max - min);
}

function randomOption() {
	return decidingOptions[Math.floor(Math.random() * decidingOptions.length)] ?? decidingOptions[0];
}

function rotateVector(vector: THREE.Vector2, radians: number) {
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return new THREE.Vector2(vector.x * cos - vector.y * sin, vector.x * sin + vector.y * cos);
}

function fireInterval(elapsed: number) {
	const rateMultiplier = 1 + Math.floor(elapsed / 10_000) * 0.2;
	return baseFireInterval / rateMultiplier;
}

function setMeshOpacity(mesh: THREE.Mesh, opacity: number) {
	const material = mesh.material;
	if (Array.isArray(material)) {
		for (const item of material) {
			item.transparent = opacity < 1;
			item.opacity = opacity;
		}
		return;
	}

	material.transparent = opacity < 1;
	material.opacity = opacity;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
	if (Array.isArray(material)) {
		for (const item of material) item.dispose();
		return;
	}

	material.dispose();
}

function disposeObject(object: THREE.Object3D) {
	object.traverse(child => {
		const mesh = child as THREE.Mesh;
		mesh.geometry?.dispose();

		const material = mesh.material;
		if (material) disposeMaterial(material);
	});
}

function createSoundPool(src: string, volume: number, size = 4) {
	const sounds = Array.from({ length: size }, () => {
		const audio = new Audio(src);
		audio.preload = 'auto';
		audio.volume = volume;
		return audio;
	});
	let index = 0;

	return {
		play() {
			const sound = sounds[index];
			index = (index + 1) % sounds.length;
			sound.currentTime = 0;
			void sound.play().catch(() => {});
		},
		dispose() {
			for (const sound of sounds) {
				sound.pause();
				sound.removeAttribute('src');
			}
		},
	};
}

function createShip(): ShipParts {
	const group = new THREE.Group();
	const bodyGeometry = new THREE.ConeGeometry(0.085, 0.42, 7, 1, false);
	const bodyMaterial = new THREE.MeshStandardMaterial({
		color: 0xf8fafc,
		emissive: 0x243b53,
		emissiveIntensity: 0.22,
		flatShading: true,
		metalness: 0.48,
		roughness: 0.32,
	});
	const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
	group.add(body);

	const edgeGeometry = new THREE.EdgesGeometry(bodyGeometry);
	const edges = new THREE.LineSegments(
		edgeGeometry,
		new THREE.LineBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.68 }),
	);
	group.add(edges);

	const flameGeometry = new THREE.ConeGeometry(0.04, 0.22, 9, 1, true);
	flameGeometry.rotateZ(Math.PI);
	const rearFlame = new THREE.Mesh(
		flameGeometry,
		new THREE.MeshBasicMaterial({
			color: 0xff8a00,
			transparent: true,
			opacity: 0.88,
			depthWrite: false,
		}),
	);
	rearFlame.position.y = -0.25;
	rearFlame.visible = false;
	group.add(rearFlame);

	const brakeFlames = [-0.045, 0.045].map(offset => {
		const brakeGeometry = new THREE.ConeGeometry(0.024, 0.13, 7, 1, true);
		const flame = new THREE.Mesh(
			brakeGeometry,
			new THREE.MeshBasicMaterial({
				color: 0xfde047,
				transparent: true,
				opacity: 0.72,
				depthWrite: false,
			}),
		);
		flame.position.set(offset, 0.23, 0);
		flame.visible = false;
		group.add(flame);
		return flame;
	});

	return { group, body, rearFlame, brakeFlames };
}

function createAsteroidGeometry(radius: number) {
	const geometries = [
		() => new THREE.DodecahedronGeometry(radius, 0),
		() => new THREE.IcosahedronGeometry(radius, 0),
		() => new THREE.OctahedronGeometry(radius, 0),
		() => new THREE.TetrahedronGeometry(radius, 0),
	];
	return (geometries[Math.floor(Math.random() * geometries.length)] ?? geometries[0])();
}

function createAsteroidMesh(size: AsteroidSize, option: DecidingOption, radius: number) {
	const group = new THREE.Group();
	const geometry = createAsteroidGeometry(radius);
	const material = new THREE.MeshStandardMaterial({
		color: option.color,
		emissive: option.color,
		emissiveIntensity: size === 'big' ? 0.16 : 0.2,
		flatShading: true,
		metalness: 0.08,
		roughness: 0.74,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.scale.set(randomBetween(0.78, 1.2), randomBetween(0.82, 1.24), randomBetween(0.72, 1.18));
	group.add(mesh);
	group.add(
		new THREE.LineSegments(
			new THREE.EdgesGeometry(geometry),
			new THREE.LineBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.45 }),
		),
	);
	return group;
}

function makeAsteroid(size: AsteroidSize, option: DecidingOption, position: THREE.Vector2, velocity: THREE.Vector2) {
	const radius = size === 'big' ? randomBetween(0.38, 0.52) : randomBetween(0.18, 0.28);
	const group = createAsteroidMesh(size, option, radius);
	group.position.set(position.x, position.y, 0);

	return {
		group,
		option,
		size,
		position,
		velocity,
		radius,
		rotation: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
		rotationVelocity: new THREE.Vector3(randomBetween(-1.6, 1.6), randomBetween(-2.4, 2.4), randomBetween(-2.1, 2.1)),
	} satisfies Asteroid;
}

function pointsForAsteroid(asteroid: Asteroid) {
	return asteroid.size === 'big' ? 2 : 1;
}

function readPointerWorldPoint(event: React.PointerEvent<HTMLDivElement>, camera: THREE.OrthographicCamera) {
	const rect = event.currentTarget.getBoundingClientRect();
	const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
	const y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
	const point = new THREE.Vector3(x, y, 0).unproject(camera);
	return new THREE.Vector2(point.x, point.y);
}

function AsteroidsField({
	finished,
	onFinished,
	onRemainingChange,
	onScoresChange,
	onShipHit,
}: {
	finished: boolean;
	onFinished: (scores: OptionPoints) => void;
	onRemainingChange: (seconds: number) => void;
	onScoresChange: (scores: OptionPoints, delta?: ScoreDelta) => void;
	onShipHit: () => void;
}) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
	const frameRef = useRef<number | null>(null);
	const pointerTargetRef = useRef<PointerTarget | null>(null);
	const onFinishedRef = useRef(onFinished);
	const onRemainingChangeRef = useRef(onRemainingChange);
	const onScoresChangeRef = useRef(onScoresChange);
	const onShipHitRef = useRef(onShipHit);
	const shipPartsRef = useRef<ShipParts | null>(null);
	const shipStateRef = useRef<ShipState | null>(null);
	const boundsRef = useRef<Bounds>({ width: 4, height: 5 });
	const finishedRef = useRef(finished);
	const scoresRef = useRef<OptionPoints>(emptyOptionPoints());

	useEffect(() => {
		finishedRef.current = finished;
	}, [finished]);

	useEffect(() => {
		onFinishedRef.current = onFinished;
		onRemainingChangeRef.current = onRemainingChange;
		onScoresChangeRef.current = onScoresChange;
		onShipHitRef.current = onShipHit;
	}, [onFinished, onRemainingChange, onScoresChange, onShipHit]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const hostElement = host;

		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.domElement.style.display = 'block';
		renderer.domElement.style.height = '100%';
		renderer.domElement.style.width = '100%';
		hostElement.append(renderer.domElement);

		const scene = new THREE.Scene();
		scene.fog = new THREE.Fog(0x020617, 7, 12);

		const camera = new THREE.OrthographicCamera(-2, 2, 2.5, -2.5, 0.1, 100);
		camera.position.set(0, 0, 10);
		camera.lookAt(0, 0, 0);
		cameraRef.current = camera;

		const ambient = new THREE.AmbientLight(0xffffff, 1.2);
		const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
		keyLight.position.set(2.6, 3.8, 5.4);
		const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.8);
		rimLight.position.set(-2.4, 2.2, 3.2);
		scene.add(ambient, keyLight, rimLight);

		const starsGeometry = new THREE.BufferGeometry();
		const starPositions: number[] = [];
		for (let index = 0; index < 180; index += 1) {
			starPositions.push(randomBetween(-4, 4), randomBetween(-5, 5), randomBetween(-2.5, -0.5));
		}
		starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
		const stars = new THREE.Points(
			starsGeometry,
			new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.018, transparent: true, opacity: 0.72 }),
		);
		scene.add(stars);

		const ship = createShip();
		ship.group.position.set(0, -1.45, 0);
		scene.add(ship.group);
		shipPartsRef.current = ship;

		const shipState: ShipState = {
			position: new THREE.Vector2(0, -1.45),
			velocity: new THREE.Vector2(0, coastingSpeed),
			facing: new THREE.Vector2(0, 1),
		};
		shipStateRef.current = shipState;
		const bullets: Bullet[] = [];
		const asteroids: Asteroid[] = [];
		const debris: Debris[] = [];
		const startedAt = performance.now();
		const timers = {
			lastFrame: startedAt,
			lastUi: startedAt,
			nextShot: startedAt + 180,
			nextSmallAsteroid: startedAt + 300,
			nextBigAsteroid: startedAt + 15_500,
		};
		const shootSound = createSoundPool(shootSoundUrl, 0.18, 4);
		const breakSound = createSoundPool(breakSoundUrl, 0.28, 5);

		function resize() {
			const width = Math.max(1, hostElement.clientWidth);
			const height = Math.max(1, hostElement.clientHeight);
			const aspect = width / height;
			const viewH = 5.4;
			const viewW = viewH * aspect;

			boundsRef.current = { width: viewW, height: viewH };
			renderer.setSize(width, height);
			camera.left = -viewW / 2;
			camera.right = viewW / 2;
			camera.top = viewH / 2;
			camera.bottom = -viewH / 2;
			camera.updateProjectionMatrix();
		}

		function removeBullet(index: number) {
			const [bullet] = bullets.splice(index, 1);
			if (!bullet) return;

			scene.remove(bullet.mesh);
			disposeObject(bullet.mesh);
		}

		function removeAsteroid(index: number) {
			const [asteroid] = asteroids.splice(index, 1);
			if (!asteroid) return;

			scene.remove(asteroid.group);
			disposeObject(asteroid.group);
		}

		function removeDebris(index: number) {
			const [piece] = debris.splice(index, 1);
			if (!piece) return;

			scene.remove(piece.mesh);
			disposeObject(piece.mesh);
		}

		function createDebris(position: THREE.Vector2, color: string, radius: number, count: number) {
			for (let index = 0; index < count; index += 1) {
				const material = new THREE.MeshBasicMaterial({
					color,
					transparent: true,
					opacity: 0.92,
					depthWrite: false,
				});
				const mesh = new THREE.Mesh(
					new THREE.TetrahedronGeometry(randomBetween(0.035, 0.08) * radius * 4, 0),
					material,
				);
				mesh.position.set(position.x, position.y, randomBetween(0.05, 0.35));
				scene.add(mesh);

				const angle = Math.random() * Math.PI * 2;
				const speed = randomBetween(0.5, 1.6) * (radius > 0.32 ? 1.2 : 1);
				debris.push({
					mesh,
					position: position.clone(),
					velocity: new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(speed),
					rotationVelocity: new THREE.Vector3(randomBetween(-5, 5), randomBetween(-5, 5), randomBetween(-5, 5)),
					age: 0,
					lifetime: randomBetween(0.42, 0.72),
					material,
				});
			}
		}

		function addAsteroid(asteroid: Asteroid) {
			asteroids.push(asteroid);
			scene.add(asteroid.group);
		}

		function spawnAsteroid(size: AsteroidSize) {
			const bounds = boundsRef.current;
			const side = Math.random() < 0.5 ? -1 : 1;
			const y = bounds.height / 2 + randomBetween(0.18, 0.62);
			const x = side * randomBetween(bounds.width * 0.34, bounds.width * 0.56);
			const speed = size === 'big' ? randomBetween(0.34, 0.58) : randomBetween(0.7, 1.18);
			const velocity = new THREE.Vector2(side * -randomBetween(0.16, 0.72), -speed);

			addAsteroid(makeAsteroid(size, randomOption(), new THREE.Vector2(x, y), velocity));
		}

		function spawnFragments(asteroid: Asteroid) {
			const inherited = asteroid.velocity.clone().normalize();
			const inheritedSpeed = Math.max(1.12, asteroid.velocity.length() * 2.1);

			for (let index = 0; index < 3; index += 1) {
				const direction = rotateVector(inherited, randomBetween(-0.28, 0.28));
				const velocity = direction.multiplyScalar(inheritedSpeed * randomBetween(0.88, 1.18));
				const offset = rotateVector(new THREE.Vector2(0, asteroid.radius * 0.5), (index / 3) * Math.PI * 2);
				addAsteroid(makeAsteroid('small', randomOption(), asteroid.position.clone().add(offset), velocity));
			}
		}

		function addScore(asteroid: Asteroid) {
			const delta = pointsForAsteroid(asteroid);
			const scored = addOptionScore(scoresRef.current, asteroid.option.name, delta);
			scoresRef.current = scored.scores;
			onScoresChangeRef.current(scored.scores, scored.delta);
		}

		function removePointFromLeader() {
			const leader = decidingOptions.reduce((winner, option) => {
				const optionScore = scoresRef.current[option.name] ?? 0;
				const winnerScore = scoresRef.current[winner.name] ?? 0;
				return optionScore > winnerScore ? option : winner;
			}, decidingOptions[0]);
			const leaderScore = scoresRef.current[leader.name] ?? 0;

			if (leaderScore <= 0) return;

			const nextScores = { ...scoresRef.current, [leader.name]: Math.max(0, leaderScore - 1) };
			scoresRef.current = nextScores;
			onScoresChangeRef.current(nextScores, { optionName: leader.name, delta: -1, scores: nextScores });
		}

		function destroyAsteroid(asteroidIndex: number) {
			const asteroid = asteroids[asteroidIndex];
			if (!asteroid) return;

			addScore(asteroid);
			breakSound.play();
			createDebris(asteroid.position, asteroid.option.color, asteroid.radius, asteroid.size === 'big' ? 12 : 7);
			if (asteroid.size === 'big') spawnFragments(asteroid);
			removeAsteroid(asteroidIndex);
		}

		function crashIntoAsteroid(asteroidIndex: number) {
			const asteroid = asteroids[asteroidIndex];
			if (!asteroid) return;

			removePointFromLeader();
			onShipHitRef.current();
			breakSound.play();
			createDebris(asteroid.position, asteroid.option.color, asteroid.radius, asteroid.size === 'big' ? 12 : 7);
			removeAsteroid(asteroidIndex);
		}

		function fireBullet(now: number, elapsed: number) {
			if (now < timers.nextShot || finishedRef.current) return;

			timers.nextShot = now + fireInterval(elapsed);
			const direction = shipState.facing.clone().normalize();
			const bulletGeometry = new THREE.SphereGeometry(0.06, 12, 8);
			const bulletMaterial = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				emissive: 0xfef08a,
				emissiveIntensity: 1.8,
				metalness: 0.2,
				roughness: 0.28,
			});
			const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
			const position = shipState.position.clone().add(direction.clone().multiplyScalar(0.24));
			bullet.position.set(position.x, position.y, 0.12);
			scene.add(bullet);
			shootSound.play();
			bullets.push({
				mesh: bullet,
				position,
				velocity: direction.multiplyScalar(bulletSpeed).add(shipState.velocity.clone().multiplyScalar(0.35)),
				radius: 0.07,
				age: 0,
			});
		}

		function updateShip(delta: number) {
			const bounds = boundsRef.current;
			const target = pointerTargetRef.current;
			let rearFlamePower = 0;
			let brakeFlamePower = 0;

			function slowToCoast() {
				const speed = shipState.velocity.length();
				if (speed <= coastingSpeed) {
					if (speed < coastingSpeed * 0.92) shipState.velocity.setLength(coastingSpeed);
					return;
				}

				const nextSpeed = Math.max(coastingSpeed, speed - shipBrake * delta);
				shipState.velocity.setLength(nextSpeed);
				brakeFlamePower = clamp((speed - nextSpeed) * 1.2, 0.15, 0.9);
			}

			if (target?.active && !target.arrived) {
				const toTarget = target.point.clone().sub(shipState.position);
				const distance = toTarget.length();
				const direction = distance > 0 ? toTarget.multiplyScalar(1 / distance) : shipState.facing.clone();
				const projectedSpeed = shipState.velocity.dot(direction);
				const reachesTarget = distance <= shipArrivalRadius || projectedSpeed * delta >= distance - shipArrivalRadius;

				if (reachesTarget) {
					target.arrived = true;
					shipState.position.copy(target.point);
					slowToCoast();
				} else {
					const previousSpeed = shipState.velocity.length();
					const acceleration =
						previousSpeed < shipInitialAccelerationMaxSpeed ? shipInitialAcceleration : shipAcceleration;
					const nextSpeed = Math.min(shipMaxSpeed, Math.max(previousSpeed, coastingSpeed) + acceleration * delta);
					const desiredVelocity = direction.clone().multiplyScalar(nextSpeed);
					shipState.velocity.lerp(desiredVelocity, clamp(shipSteering * delta, 0, 1));
					if (shipState.velocity.length() > shipMaxSpeed) shipState.velocity.setLength(shipMaxSpeed);
					shipState.facing.copy(direction);
					rearFlamePower = clamp((shipState.velocity.length() - previousSpeed) * 2.5 + 0.18, 0.18, 1.15);
				}
			} else {
				slowToCoast();
			}

			shipState.position.addScaledVector(shipState.velocity, delta);

			const halfW = bounds.width / 2 - shipRadius;
			const halfH = bounds.height / 2 - shipRadius;
			if (shipState.position.x < -halfW) {
				shipState.position.x = -halfW;
				shipState.velocity.x = Math.abs(shipState.velocity.x) || coastingSpeed;
				if (target) target.arrived = true;
			} else if (shipState.position.x > halfW) {
				shipState.position.x = halfW;
				shipState.velocity.x = -Math.abs(shipState.velocity.x) || -coastingSpeed;
				if (target) target.arrived = true;
			}
			if (shipState.position.y < -halfH) {
				shipState.position.y = -halfH;
				shipState.velocity.y = Math.abs(shipState.velocity.y) || coastingSpeed;
				if (target) target.arrived = true;
			} else if (shipState.position.y > halfH) {
				shipState.position.y = halfH;
				shipState.velocity.y = -Math.abs(shipState.velocity.y) || -coastingSpeed;
				if (target) target.arrived = true;
			}

			const angle = Math.atan2(shipState.facing.y, shipState.facing.x) - Math.PI / 2;
			ship.group.position.set(shipState.position.x, shipState.position.y, 0);
			ship.group.rotation.z = angle;
			ship.body.rotation.y += delta * 6.2;

			ship.rearFlame.visible = rearFlamePower > 0.05 && !finishedRef.current;
			ship.rearFlame.scale.set(0.8 + rearFlamePower * 0.25, rearFlamePower, 0.8 + rearFlamePower * 0.2);
			ship.rearFlame.position.y = -0.27 - rearFlamePower * 0.04;
			setMeshOpacity(ship.rearFlame, clamp(rearFlamePower, 0.15, 0.92));

			for (const flame of ship.brakeFlames) {
				flame.visible = brakeFlamePower > 0.05 && !finishedRef.current;
				flame.scale.set(0.8 + brakeFlamePower * 0.2, brakeFlamePower, 0.8 + brakeFlamePower * 0.2);
				setMeshOpacity(flame, clamp(brakeFlamePower, 0.12, 0.72));
			}
		}

		function updateBullets(delta: number) {
			const bounds = boundsRef.current;
			for (let index = bullets.length - 1; index >= 0; index -= 1) {
				const bullet = bullets[index];
				bullet.age += delta;
				bullet.position.addScaledVector(bullet.velocity, delta);
				bullet.mesh.position.set(bullet.position.x, bullet.position.y, 0.12);

				const outside =
					Math.abs(bullet.position.x) > bounds.width / 2 + 0.5 || Math.abs(bullet.position.y) > bounds.height / 2 + 0.5;
				if (outside || bullet.age > 2.4) removeBullet(index);
			}
		}

		function updateAsteroids(delta: number) {
			const bounds = boundsRef.current;
			for (let index = asteroids.length - 1; index >= 0; index -= 1) {
				const asteroid = asteroids[index];
				asteroid.position.addScaledVector(asteroid.velocity, delta);
				asteroid.rotation.addScaledVector(asteroid.rotationVelocity, delta);
				asteroid.group.position.set(asteroid.position.x, asteroid.position.y, 0);
				asteroid.group.rotation.set(asteroid.rotation.x, asteroid.rotation.y, asteroid.rotation.z);

				const outside =
					Math.abs(asteroid.position.x) > bounds.width / 2 + 1 || Math.abs(asteroid.position.y) > bounds.height / 2 + 1;
				if (outside) removeAsteroid(index);
			}
		}

		function updateDebris(delta: number) {
			for (let index = debris.length - 1; index >= 0; index -= 1) {
				const piece = debris[index];
				piece.age += delta;
				piece.position.addScaledVector(piece.velocity, delta);
				piece.mesh.position.set(piece.position.x, piece.position.y, 0.2);
				piece.mesh.rotation.x += piece.rotationVelocity.x * delta;
				piece.mesh.rotation.y += piece.rotationVelocity.y * delta;
				piece.mesh.rotation.z += piece.rotationVelocity.z * delta;
				piece.material.opacity = clamp(1 - piece.age / piece.lifetime, 0, 1);

				if (piece.age >= piece.lifetime) removeDebris(index);
			}
		}

		function checkCollisions() {
			for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
				const bullet = bullets[bulletIndex];
				let hitIndex = -1;

				for (let asteroidIndex = asteroids.length - 1; asteroidIndex >= 0; asteroidIndex -= 1) {
					const asteroid = asteroids[asteroidIndex];
					if (bullet.position.distanceTo(asteroid.position) <= bullet.radius + asteroid.radius) {
						hitIndex = asteroidIndex;
						break;
					}
				}

				if (hitIndex === -1) continue;

				removeBullet(bulletIndex);
				destroyAsteroid(hitIndex);
			}

			for (let asteroidIndex = asteroids.length - 1; asteroidIndex >= 0; asteroidIndex -= 1) {
				const asteroid = asteroids[asteroidIndex];
				if (shipState.position.distanceTo(asteroid.position) <= shipRadius + asteroid.radius)
					crashIntoAsteroid(asteroidIndex);
			}
		}

		function updateSpawns(now: number, elapsed: number) {
			if (finishedRef.current) return;

			if (now >= timers.nextSmallAsteroid) {
				spawnAsteroid('small');
				timers.nextSmallAsteroid = now + randomBetween(720, 1150);
			}

			if (elapsed >= 15_000 && now >= timers.nextBigAsteroid) {
				spawnAsteroid('big');
				timers.nextBigAsteroid = now + randomBetween(4_400, 6_800);
			}
		}

		function updateUi(now: number, elapsed: number) {
			if (now - timers.lastUi < 180 && elapsed < gameMs) return;

			timers.lastUi = now;
			onRemainingChangeRef.current(Math.max(0, Math.ceil((gameMs - elapsed) / 1000)));
		}

		function finishGame() {
			if (finishedRef.current) return;

			finishedRef.current = true;
			onRemainingChangeRef.current(0);
			onFinishedRef.current({ ...scoresRef.current });
		}

		function animate() {
			const now = performance.now();
			const delta = Math.min((now - timers.lastFrame) / 1000, 0.034);
			const elapsed = now - startedAt;
			timers.lastFrame = now;

			if (elapsed >= gameMs) finishGame();

			stars.rotation.z += delta * 0.015;
			updateShip(delta);
			updateSpawns(now, elapsed);
			fireBullet(now, elapsed);
			updateBullets(delta);
			updateAsteroids(delta);
			updateDebris(delta);
			if (!finishedRef.current) checkCollisions();
			updateUi(now, elapsed);

			renderer.render(scene, camera);
			frameRef.current = window.requestAnimationFrame(animate);
		}

		const observer = new ResizeObserver(resize);
		observer.observe(hostElement);
		resize();
		animate();

		return () => {
			observer.disconnect();
			if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
			shootSound.dispose();
			breakSound.dispose();
			scene.traverse(child => {
				const mesh = child as THREE.Mesh;
				mesh.geometry?.dispose();

				const material = mesh.material;
				if (material) disposeMaterial(material);
			});
			renderer.dispose();
			if (renderer.domElement.parentElement === hostElement) hostElement.removeChild(renderer.domElement);
			cameraRef.current = null;
			shipPartsRef.current = null;
			shipStateRef.current = null;
		};
	}, []);

	function updatePointerTarget(event: React.PointerEvent<HTMLDivElement>, active: boolean) {
		const camera = cameraRef.current;
		if (!camera || finishedRef.current) return;

		event.preventDefault();
		const point = readPointerWorldPoint(event, camera);
		const target = pointerTargetRef.current;
		const ship = shipPartsRef.current;
		const shipState = shipStateRef.current;

		if (!target) {
			pointerTargetRef.current = { active, arrived: false, point };
		} else {
			if (target.point.distanceTo(point) > 0.04) target.arrived = false;
			target.active = active;
			target.point.copy(point);
		}

		if (!ship || !shipState) return;

		const direction = point.clone().sub(shipState.position);
		if (direction.lengthSq() <= 0.001) return;

		shipState.facing.copy(direction.normalize());
		ship.group.rotation.z = Math.atan2(shipState.facing.y, shipState.facing.x) - Math.PI / 2;
	}

	function startTargeting(event: React.PointerEvent<HTMLDivElement>) {
		event.currentTarget.setPointerCapture(event.pointerId);
		updatePointerTarget(event, true);
	}

	function moveTarget(event: React.PointerEvent<HTMLDivElement>) {
		if (!pointerTargetRef.current?.active) return;

		updatePointerTarget(event, true);
	}

	function stopTargeting(event: React.PointerEvent<HTMLDivElement>) {
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
		if (pointerTargetRef.current) pointerTargetRef.current.active = false;
	}

	return (
		<div
			aria-label='Asteroids game field'
			className='h-full min-h-[260px] w-full touch-none overflow-hidden rounded-lg border-2 border-white/20 bg-slate-950/70'
			onLostPointerCapture={stopTargeting}
			onPointerCancel={stopTargeting}
			onPointerDown={startTargeting}
			onPointerMove={moveTarget}
			onPointerUp={stopTargeting}
			ref={hostRef}
			role='application'
		/>
	);
}

export default function AsteroidsScreen({ submit }: QuizScreenProps<AsteroidsScreenConfig>) {
	const [finished, setFinished] = useState(false);
	const [hitFlash, setHitFlash] = useState(false);
	const [remaining, setRemaining] = useState(60);
	const { clearScoreAnimationTimeouts, displayScores, scoreBumps, scoreEffects, scores, setAnimatedScores } =
		useAnimatedScores();
	const flashTimeoutRef = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
			clearScoreAnimationTimeouts();
		},
		[],
	);

	function flashHit() {
		setHitFlash(true);
		if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
		flashTimeoutRef.current = window.setTimeout(() => setHitFlash(false), 150);
	}

	function handleScoresChange(nextScores: OptionPoints, delta?: ScoreDelta) {
		setAnimatedScores(nextScores, delta);
	}

	return (
		<div className='flex h-full min-h-0 flex-col gap-3 px-2 py-3'>
			<div className='relative min-h-0 flex-1'>
				<AsteroidsField
					finished={finished}
					onFinished={nextScores => {
						clearScoreAnimationTimeouts(true);
						setAnimatedScores(nextScores);
						setFinished(true);
					}}
					onRemainingChange={setRemaining}
					onScoresChange={handleScoresChange}
					onShipHit={flashHit}
				/>
				{hitFlash ? (
					<div className='pointer-events-none absolute inset-0 rounded-lg border-4 border-red-500 bg-red-600/30 shadow-[inset_0_0_42px_rgba(239,68,68,0.95)]' />
				) : null}
				<CompactScoreHud bumps={scoreBumps} effects={scoreEffects} remaining={remaining} scores={displayScores} />
				{finished ? (
					<div className='absolute inset-0 flex items-center justify-center bg-neutral-950/45 p-4'>
						<div className='rounded-lg border-2 border-neutral-950 bg-white p-4 text-center text-neutral-950 shadow-[5px_5px_0_#171717]'>
							<p className='text-xs font-black uppercase text-fuchsia-700'>final score</p>
							<div className='mt-3 min-w-56'>
								<ScoreChips scores={scores} />
							</div>
							<Button className='mt-3' onClick={() => submit(scores)} theme='endAction'>
								I did my part
							</Button>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

export const asteroidsQuiz = quizScreen<AsteroidsScreenConfig>({
	id: 'asteroids',
	title: 'Asteroids',
	tagline: 'Tiny space rocks with suspicious political consequences.',
	screens: [{ title: 'Asteroids' }],
	Screen: AsteroidsScreen,
});
