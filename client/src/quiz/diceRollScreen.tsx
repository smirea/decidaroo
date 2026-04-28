import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button.tsx';
import { decidingOptions } from '../../../shared/constants.ts';
import { pointsForOption, type QuizScreenProps } from './quizScreen.tsx';

type DiceScreenConfig = {
	title: string;
};

type DecidingOption = (typeof decidingOptions)[number];

type DiceResult = {
	option: DecidingOption;
	points: number;
};

type Face = {
	result: DiceResult;
	normal: THREE.Vector3;
};

const dieRadius = 0.62;
const floorY = -0.82;

function diceLabel(result: DiceResult) {
	return `${result.points}`;
}

function vectorLength(vector: CANNON.Vec3) {
	return Math.hypot(vector.x, vector.y, vector.z);
}

function hexToRgb(hex: string) {
	const cleanHex = hex.replace('#', '');
	const value = Number.parseInt(cleanHex.length === 3 ? cleanHex.replace(/./g, item => item + item) : cleanHex, 16);

	if (Number.isNaN(value)) return { r: 250, g: 204, b: 21 };

	return {
		r: (value >> 16) & 255,
		g: (value >> 8) & 255,
		b: value & 255,
	};
}

function mixHex(left: string, right: string, amount: number) {
	const first = hexToRgb(left);
	const second = hexToRgb(right);
	const mix = (start: number, end: number) => Math.round(start + (end - start) * amount);

	return `#${[mix(first.r, second.r), mix(first.g, second.g), mix(first.b, second.b)]
		.map(channel => channel.toString(16).padStart(2, '0'))
		.join('')}`;
}

function makeFaceTexture(result: DiceResult) {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 256;

	const context = canvas.getContext('2d');
	if (!context) return null;

	const gradient = context.createLinearGradient(0, 0, 256, 256);
	gradient.addColorStop(0, mixHex(result.option.color, '#ffffff', 0.5));
	gradient.addColorStop(0.62, result.option.color);
	gradient.addColorStop(1, mixHex(result.option.color, '#111827', 0.16));
	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	context.strokeStyle = 'rgba(23, 23, 23, 0.16)';
	context.lineWidth = 8;
	context.beginPath();
	context.moveTo(128, 24);
	context.lineTo(230, 226);
	context.lineTo(26, 226);
	context.closePath();
	context.stroke();

	context.shadowColor = 'rgba(255, 255, 255, 0.55)';
	context.shadowBlur = 6;
	context.shadowOffsetY = 2;
	context.fillStyle = '#171717';
	context.font = '900 64px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(diceLabel(result), 128, 143);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.flipY = false;
	texture.anisotropy = 4;
	return texture;
}

function createD24Geometry() {
	const rawVertices = [
		[1, 1, 1],
		[1, 1, -1],
		[1, -1, 1],
		[1, -1, -1],
		[-1, 1, 1],
		[-1, 1, -1],
		[-1, -1, 1],
		[-1, -1, -1],
		[1, 0, 0],
		[-1, 0, 0],
		[0, 1, 0],
		[0, -1, 0],
		[0, 0, 1],
		[0, 0, -1],
	] as const;
	const faceIndexes = [
		[8, 0, 1],
		[8, 1, 3],
		[8, 3, 2],
		[8, 2, 0],
		[9, 4, 6],
		[9, 6, 7],
		[9, 7, 5],
		[9, 5, 4],
		[10, 4, 5],
		[10, 5, 1],
		[10, 1, 0],
		[10, 0, 4],
		[11, 6, 2],
		[11, 2, 3],
		[11, 3, 7],
		[11, 7, 6],
		[12, 4, 0],
		[12, 0, 2],
		[12, 2, 6],
		[12, 6, 4],
		[13, 5, 7],
		[13, 7, 3],
		[13, 3, 1],
		[13, 1, 5],
	] as const;
	const vertices = rawVertices.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(dieRadius));
	const faceCenters = faceIndexes.map(([first, second, third]) =>
		new THREE.Vector3().add(vertices[first]).add(vertices[second]).add(vertices[third]).divideScalar(3),
	);
	const faceResults = faceCenters.map<DiceResult | null>(() => null);
	const faceAdjacency = faceIndexes.map((face, index) =>
		faceIndexes.reduce<number[]>((neighbors, candidate, candidateIndex) => {
			const candidateVertices = candidate as readonly number[];
			const sharedVertices = (face as readonly number[]).filter(vertex => candidateVertices.includes(vertex)).length;
			if (candidateIndex !== index && sharedVertices >= 2) neighbors.push(candidateIndex);
			return neighbors;
		}, []),
	);
	const optionIndexes = faceIndexes.map(() => -1);
	const sortedFaces = faceCenters
		.map((center, index) => ({ angle: Math.atan2(center.z, center.x), index }))
		.sort((left, right) => left.angle - right.angle);

	if (decidingOptions.length === 2) {
		for (const { index } of sortedFaces) {
			if (optionIndexes[index] !== -1) continue;

			optionIndexes[index] = 0;
			const queue = [index];

			for (const faceIndex of queue) {
				for (const neighborIndex of faceAdjacency[faceIndex]) {
					if (optionIndexes[neighborIndex] !== -1) continue;

					optionIndexes[neighborIndex] = 1 - optionIndexes[faceIndex];
					queue.push(neighborIndex);
				}
			}
		}
	} else {
		sortedFaces.forEach(({ index }, rank) => {
			optionIndexes[index] = rank % decidingOptions.length;
		});
	}

	const facePoints = faceIndexes.map(() => 0);

	if (decidingOptions.length === 2) {
		const facesByOption = decidingOptions.map(() => [] as number[]);
		sortedFaces.forEach(({ index }) => {
			const optionIndex = optionIndexes[index] === -1 ? 0 : optionIndexes[index];
			facesByOption[optionIndex]?.push(index);
		});

		facesByOption.forEach((faceIndexesForOption, optionIndex) => {
			const availablePoints = new Set(faceIndexesForOption.map((_, index) => index + 1));

			for (const faceIndex of faceIndexesForOption) {
				const neighborPoints = faceAdjacency[faceIndex]
					.filter(neighborIndex => optionIndexes[neighborIndex] !== optionIndex)
					.map(neighborIndex => facePoints[neighborIndex])
					.filter(point => point > 0);
				const point = [...availablePoints].sort((left, right) => {
					const leftConflicts = neighborPoints.filter(neighborPoint => neighborPoint === left).length;
					const rightConflicts = neighborPoints.filter(neighborPoint => neighborPoint === right).length;
					if (leftConflicts !== rightConflicts) return leftConflicts - rightConflicts;

					const leftDistance = neighborPoints.reduce(
						(total, neighborPoint) => total + Math.abs(neighborPoint - left),
						0,
					);
					const rightDistance = neighborPoints.reduce(
						(total, neighborPoint) => total + Math.abs(neighborPoint - right),
						0,
					);
					return rightDistance - leftDistance || left - right;
				})[0];

				if (!point) continue;

				facePoints[faceIndex] = point;
				availablePoints.delete(point);
			}
		});
	} else {
		const optionPointCounts = decidingOptions.map(() => 0);
		sortedFaces.forEach(({ index }, rank) => {
			const optionIndex = optionIndexes[index] === -1 ? rank % decidingOptions.length : optionIndexes[index];
			optionPointCounts[optionIndex] = (optionPointCounts[optionIndex] ?? 0) + 1;
			facePoints[index] = optionPointCounts[optionIndex];
		});
	}

	faceResults.forEach((_, index) => {
		const optionIndex = optionIndexes[index] === -1 ? index % decidingOptions.length : optionIndexes[index];
		faceResults[index] = {
			option: decidingOptions[optionIndex] ?? decidingOptions[0],
			points: facePoints[index],
		};
	});

	const geometry = new THREE.BufferGeometry();
	const positions: number[] = [];
	const uvs: number[] = [];
	const cannonVertices = vertices.map(vertex => new CANNON.Vec3(vertex.x, vertex.y, vertex.z));
	const cannonFaces: number[][] = [];
	const faces: Face[] = [];

	for (let index = 0; index < faceIndexes.length; index += 1) {
		uvs.push(0.5, 0.1, 0.92, 0.88, 0.08, 0.88);

		const [first, second, third] = faceIndexes[index];
		const a = vertices[first];
		const b = vertices[second];
		const c = vertices[third];
		const center = new THREE.Vector3().addVectors(a, b).add(c).divideScalar(3);
		const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
		let face = [first, second, third];
		let renderVertices = [a, b, c];

		if (normal.dot(center) < 0) {
			normal.negate();
			face = [face[0], face[2], face[1]];
			renderVertices = [a, c, b];
		}

		for (const vertex of renderVertices) positions.push(vertex.x, vertex.y, vertex.z);
		cannonFaces.push(face);
		faces.push({ result: faceResults[index] ?? { option: decidingOptions[0], points: 1 }, normal: normal.clone() });
	}

	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.computeVertexNormals();
	geometry.clearGroups();
	for (let index = 0; index < faceIndexes.length; index += 1) geometry.addGroup(index * 3, 3, index);

	return { geometry, cannonVertices, cannonFaces, faces };
}

function randomQuaternion() {
	const euler = new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
	const quaternion = new THREE.Quaternion().setFromEuler(euler);
	return new CANNON.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
}

function idleQuaternion() {
	const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0.35, 0.2));
	return new CANNON.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
}

function D24Die({ rollNonce, onSettled }: { rollNonce: number; onSettled: (result: DiceResult) => void }) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const bodyRef = useRef<CANNON.Body | null>(null);
	const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
	const diceRef = useRef<THREE.Group | null>(null);
	const frameRef = useRef<number | null>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const worldRef = useRef<CANNON.World | null>(null);
	const wallsRef = useRef<CANNON.Body[]>([]);
	const facesRef = useRef<Face[]>([]);
	const onSettledRef = useRef(onSettled);
	const rollNonceRef = useRef(rollNonce);
	const rollRef = useRef<{ active: boolean; startedAt: number; lastFrame: number }>({
		active: false,
		startedAt: 0,
		lastFrame: 0,
	});

	useEffect(() => {
		onSettledRef.current = onSettled;
	}, [onSettled]);

	useEffect(() => {
		rollNonceRef.current = rollNonce;
	}, [rollNonce]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.domElement.style.display = 'block';
		renderer.domElement.style.height = '100%';
		renderer.domElement.style.width = '100%';
		rendererRef.current = renderer;
		host.append(renderer.domElement);

		const scene = new THREE.Scene();
		const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
		camera.position.set(0, 7, 0);
		camera.up.set(0, 0, -1);
		camera.lookAt(0, 0, 0);
		cameraRef.current = camera;

		const ambient = new THREE.AmbientLight(0xffffff, 1.6);
		const keyLight = new THREE.DirectionalLight(0xffffff, 3.8);
		keyLight.position.set(2.8, 4.8, 3.4);
		const rimLight = new THREE.DirectionalLight(0x67e8f9, 2);
		rimLight.position.set(-3.4, 3, 2.8);
		scene.add(ambient, keyLight, rimLight);

		const world = new CANNON.World({
			gravity: new CANNON.Vec3(0, -9.82, 0),
		});
		world.allowSleep = true;
		worldRef.current = world;

		const diceMaterial = new CANNON.Material('dice');
		const wallMaterial = new CANNON.Material('walls');
		world.defaultContactMaterial.friction = 0.55;
		world.defaultContactMaterial.restitution = 0.62;
		world.addContactMaterial(
			new CANNON.ContactMaterial(diceMaterial, wallMaterial, {
				friction: 0.44,
				restitution: 0.76,
			}),
		);

		const dice = new THREE.Group();
		scene.add(dice);
		diceRef.current = dice;

		const { geometry, cannonVertices, cannonFaces, faces } = createD24Geometry();
		facesRef.current = faces;
		const faceMaterials = faces.map(face => {
			const texture = makeFaceTexture(face.result);

			return new THREE.MeshStandardMaterial({
				color: texture ? 0xffffff : 0xfef08a,
				emissive: 0x4a2500,
				emissiveIntensity: 0.08,
				flatShading: true,
				map: texture,
				metalness: 0.16,
				roughness: 0.42,
			});
		});
		const mesh = new THREE.Mesh(geometry, faceMaterials);
		dice.add(mesh);
		dice.add(
			new THREE.LineSegments(
				new THREE.EdgesGeometry(geometry),
				new THREE.LineBasicMaterial({ color: 0x171717, transparent: true, opacity: 0.55 }),
			),
		);

		const diceBody = new CANNON.Body({
			angularDamping: 0.07,
			linearDamping: 0.045,
			mass: 1,
			material: diceMaterial,
			shape: new CANNON.ConvexPolyhedron({ vertices: cannonVertices, faces: cannonFaces }),
			sleepSpeedLimit: 0.16,
			sleepTimeLimit: 0.55,
		});
		diceBody.position.set(0, 0.2, 0);
		diceBody.quaternion.copy(idleQuaternion());
		world.addBody(diceBody);
		bodyRef.current = diceBody;

		function clearWalls() {
			for (const wall of wallsRef.current) world.removeBody(wall);
			wallsRef.current = [];
		}

		function addWall(shape: CANNON.Shape, position: CANNON.Vec3) {
			const wall = new CANNON.Body({ mass: 0, material: wallMaterial, shape });
			wall.position.copy(position);
			world.addBody(wall);
			wallsRef.current.push(wall);
		}

		const resize = () => {
			const width = Math.max(1, host.clientWidth);
			const height = Math.max(1, host.clientHeight);
			const aspect = width / height;
			const viewH = 4.9;
			const viewW = viewH * aspect;
			const trayDepth = viewH - 0.36;
			const trayWidth = viewW - 0.36;
			const wallThickness = 0.16;
			const wallHeight = 5.2;
			const wallY = floorY + wallHeight / 2;

			renderer.setSize(width, height);
			camera.left = -viewW / 2;
			camera.right = viewW / 2;
			camera.top = viewH / 2;
			camera.bottom = -viewH / 2;
			camera.updateProjectionMatrix();

			clearWalls();
			addWall(
				new CANNON.Box(new CANNON.Vec3(trayWidth / 2, wallThickness / 2, trayDepth / 2)),
				new CANNON.Vec3(0, floorY - wallThickness / 2, 0),
			);
			addWall(
				new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, trayDepth / 2)),
				new CANNON.Vec3(-trayWidth / 2 - wallThickness / 2, wallY, 0),
			);
			addWall(
				new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, trayDepth / 2)),
				new CANNON.Vec3(trayWidth / 2 + wallThickness / 2, wallY, 0),
			);
			addWall(
				new CANNON.Box(new CANNON.Vec3(trayWidth / 2, wallHeight / 2, wallThickness / 2)),
				new CANNON.Vec3(0, wallY, -trayDepth / 2 - wallThickness / 2),
			);
			addWall(
				new CANNON.Box(new CANNON.Vec3(trayWidth / 2, wallHeight / 2, wallThickness / 2)),
				new CANNON.Vec3(0, wallY, trayDepth / 2 + wallThickness / 2),
			);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();

		function readTopValue() {
			const body = bodyRef.current;
			if (!body) return facesRef.current[0]?.result ?? { option: decidingOptions[0], points: 1 };

			const quaternion = new THREE.Quaternion(
				body.quaternion.x,
				body.quaternion.y,
				body.quaternion.z,
				body.quaternion.w,
			);
			const up = new THREE.Vector3(0, 1, 0);
			let best = facesRef.current[0];
			let bestDot = -Infinity;

			for (const face of facesRef.current) {
				const dot = face.normal.clone().applyQuaternion(quaternion).dot(up);
				if (dot > bestDot) {
					best = face;
					bestDot = dot;
				}
			}

			return best.result;
		}

		const animate = () => {
			const now = performance.now();
			const roll = rollRef.current;
			const body = bodyRef.current;

			if (body && roll.active) {
				const delta = Math.min((now - roll.lastFrame) / 1000, 0.034);
				roll.lastFrame = now;
				world.step(1 / 60, delta, 4);

				const elapsed = now - roll.startedAt;
				const slowEnough =
					elapsed > 2300 && vectorLength(body.velocity) < 0.16 && vectorLength(body.angularVelocity) < 0.2;

				if (slowEnough || elapsed > 5800) {
					roll.active = false;
					body.velocity.set(0, 0, 0);
					body.angularVelocity.set(0, 0, 0);
					onSettledRef.current(readTopValue());
				}
			} else if (body && rollNonceRef.current === 0) {
				body.position.set(0, 0.2, 0);
				body.quaternion.copy(idleQuaternion());
				body.velocity.set(0, 0, 0);
				body.angularVelocity.set(0, 0, 0);
				body.force.set(0, 0, 0);
				body.torque.set(0, 0, 0);
			}

			if (body && diceRef.current) {
				diceRef.current.position.set(body.position.x, body.position.y, body.position.z);
				diceRef.current.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
			}

			renderer.render(scene, camera);
			frameRef.current = window.requestAnimationFrame(animate);
		};
		animate();

		return () => {
			observer.disconnect();
			if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
			renderer.dispose();
			clearWalls();
			world.removeBody(diceBody);
			dice.traverse(child => {
				const meshChild = child as THREE.Mesh;
				meshChild.geometry?.dispose();

				const childMaterial = meshChild.material;
				if (Array.isArray(childMaterial)) {
					childMaterial.forEach(item => {
						(item as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
						item.dispose();
					});
				} else {
					(childMaterial as (THREE.Material & { map?: THREE.Texture | null }) | undefined)?.map?.dispose();
					childMaterial?.dispose();
				}
			});
			host.removeChild(renderer.domElement);
			bodyRef.current = null;
			cameraRef.current = null;
			diceRef.current = null;
			rendererRef.current = null;
			worldRef.current = null;
			wallsRef.current = [];
		};
	}, []);

	useEffect(() => {
		const body = bodyRef.current;
		if (!body || rollNonce === 0) return;

		body.position.set(0, 1.7, 0);
		body.quaternion.copy(randomQuaternion());
		body.velocity.set(
			(Math.random() > 0.5 ? 1 : -1) * (6.1 + Math.random() * 2.2),
			2.9 + Math.random() * 1.3,
			(Math.random() > 0.5 ? 1 : -1) * (3.5 + Math.random() * 2.8),
		);
		body.angularVelocity.set((Math.random() - 0.5) * 38, (Math.random() - 0.5) * 42, (Math.random() - 0.5) * 38);
		body.wakeUp();
		rollRef.current = { active: true, startedAt: performance.now(), lastFrame: performance.now() };
	}, [rollNonce]);

	return (
		<div
			data-dice-stage='true'
			className='h-full min-h-[260px] w-full overflow-hidden rounded-lg border-2 border-white/20 bg-neutral-950/25'
			ref={hostRef}
		/>
	);
}

export default function DiceRollScreen({ submit }: QuizScreenProps<DiceScreenConfig>) {
	const [result, setResult] = useState<DiceResult | null>(null);
	const [rollsUsed, setRollsUsed] = useState(0);
	const [rollNonce, setRollNonce] = useState(0);
	const [rolling, setRolling] = useState(false);

	const rerollsLeft = Math.max(0, 3 - rollsUsed);
	const hasRolled = result !== null;
	const rollDisabled = rolling || rollsUsed >= 3;

	function rollDice() {
		if (rollDisabled) return;

		setResult(null);
		setRollsUsed(current => current + 1);
		setRollNonce(current => current + 1);
		setRolling(true);
	}

	function buttonText() {
		if (rolling) return 'rolling...';
		if (!hasRolled) return 'roll';
		if (rerollsLeft === 1) return '1 re-roll left';
		return `${rerollsLeft} re-rolls left`;
	}

	function acceptButtonText() {
		if (!hasRolled) return 'take a chance';
		return rerollsLeft === 0 ? 'you get what you got' : "'tis good enough";
	}

	return (
		<div className='flex h-full min-h-0 flex-col items-center justify-between gap-3 overflow-hidden px-2 py-3'>
			<div className='relative min-h-0 w-full flex-1'>
				<D24Die
					onSettled={nextValue => {
						setResult(nextValue);
						setRolling(false);
					}}
					rollNonce={rollNonce}
				/>
				{hasRolled ? (
					<div
						className='pointer-events-none absolute left-4 right-4 top-4 rounded-lg border-2 border-neutral-950 px-4 py-2 text-center font-black leading-none text-neutral-950 shadow-[4px_4px_0_#171717]'
						style={{ backgroundColor: result.option.color }}
					>
						<div className='truncate text-xl'>{result.option.name}</div>
						<div className='mt-1 text-sm uppercase tracking-normal'>{result.points} points</div>
					</div>
				) : null}
			</div>

			<div className='grid w-full gap-3'>
				<Button
					disabled={!hasRolled || rolling}
					onClick={() => {
						if (result) submit(pointsForOption(result.option.name, result.points));
					}}
					theme='endAction'
				>
					{acceptButtonText()}
				</Button>

				<button
					className='min-h-12 rounded-lg border-2 border-neutral-950 bg-yellow-200 px-4 py-3 text-base font-black text-neutral-950 shadow-[4px_4px_0_#171717] disabled:translate-x-0 disabled:translate-y-0 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:shadow-[2px_2px_0_#171717] active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_#171717]'
					disabled={rollDisabled}
					onClick={rollDice}
					type='button'
				>
					{buttonText()}
				</button>
			</div>
		</div>
	);
}
