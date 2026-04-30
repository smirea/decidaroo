import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../components/Button.tsx';
import { decidingOptions } from '../../../shared/constants.ts';
import { emptyOptionPoints, type OptionPoints, type QuizScreenProps } from './quizScreen.tsx';
import { OptionScoreDisplays, ScoreChips, scoreDeltasBetween, useAnimatedScores } from './scoreHud.tsx';

type CockpitScreenConfig = {
	title: string;
};

type ControlType = 'button' | 'crank' | 'knob' | 'slider' | 'switch';
type SliderRole = 'base-color' | 'base-value' | 'symbol-high' | 'symbol-low';
type SymbolGlyph = (typeof symbolGlyphs)[number];

type SliderControl = {
	id: string;
	initial: number;
	accent: string;
};

type KnobControl = {
	id: string;
	label: string;
	min: number;
	max: number;
	initial: number;
	accent: string;
};

type SwitchControl = {
	id: string;
	ariaLabel: string;
	bit: number;
};

type ButtonControl = {
	id: string;
	label: string;
};

type CrankControl = {
	id: string;
	label: string;
	initial: number;
};

type Award = {
	optionName: string;
	value: number;
};

type PuzzleRules = {
	baseAwards: Record<number, Award>;
	binaryOptions: string[];
	d1OptionSequence: string[];
	d1ValueShifts: number[];
	invertedBinarySwitchIds: string[];
	sliderRoles: Record<string, SliderRole>;
	symbolAwards: Record<SymbolGlyph, Award>;
};

type CockpitState = {
	buttons: Record<string, number>;
	cranks: Record<string, number>;
	knobs: Record<string, number>;
	rules: PuzzleRules;
	sliders: Record<string, number>;
	switches: Record<string, boolean>;
};

type CrankPopup = {
	id: number;
	label: string;
	left: number;
	top: number;
	rotate: number;
};

const popupLabels = ['heck!', 'dang!', 'blast!', 'crud!', 'nuts!'] as const;
const symbolGlyphs = ['🐷', '🐮', '🥔', '🦄'] as const;
const sliderRoles = ['base-color', 'base-value', 'symbol-low', 'symbol-high'] as const satisfies readonly SliderRole[];
const sliderRoleLabels = {
	'base-color': 'COLOR',
	'base-value': 'BASE',
	'symbol-high': 'SYM HI',
	'symbol-low': 'SYM LO',
} as const satisfies Record<SliderRole, string>;

const d1Control: KnobControl = {
	id: 'd1',
	label: 'D1',
	min: 0,
	max: 10,
	initial: 5,
	accent: '#a855f7',
};

const d2Control: KnobControl = {
	id: 'd2',
	label: 'D2',
	min: 0,
	max: 10,
	initial: 5,
	accent: '#eab308',
};

const binarySwitches: readonly SwitchControl[] = [
	{ id: 'bit-8', ariaLabel: 'binary switch 8', bit: 8 },
	{ id: 'bit-4', ariaLabel: 'binary switch 4', bit: 4 },
	{ id: 'bit-2', ariaLabel: 'binary switch 2', bit: 2 },
	{ id: 'bit-1', ariaLabel: 'binary switch 1', bit: 1 },
];

const sliderControls: readonly SliderControl[] = [
	{ id: 'slider-a', initial: 3, accent: '#22c55e' },
	{ id: 'slider-b', initial: 17, accent: '#38bdf8' },
	{ id: 'slider-c', initial: 8, accent: '#f97316' },
	{ id: 'slider-d', initial: 24, accent: '#facc15' },
];

const panicButton: ButtonControl = { id: 'panic-button', label: 'PANIC' };
const handCrank: CrankControl = { id: 'hand-crank', label: 'CRANK', initial: 0 };

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function modulo(value: number, size: number) {
	return ((value % size) + size) % size;
}

function randomItem<T>(items: readonly T[]) {
	return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function shuffle<T>(items: readonly T[]) {
	const next = [...items];
	for (let index = next.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		const item = next[index];
		next[index] = next[swapIndex] as T;
		next[swapIndex] = item as T;
	}
	return next;
}

function repeatToLength<T>(items: readonly T[], length: number) {
	return Array.from({ length }, (_, index) => items[index % items.length] as T);
}

function repeatingShuffledOptions(length: number) {
	return repeatToLength(shuffle(optionNames()), length);
}

function optionNames() {
	return decidingOptions.map(option => option.name);
}

function colorBaseMax() {
	return Math.max(1, decidingOptions.length * 2);
}

function createBaseAwards() {
	const max = colorBaseMax();
	const sums = Array.from({ length: max * 2 - 1 }, (_, index) => index + 2);
	const pool = shuffle(
		decidingOptions.flatMap(option =>
			Array.from({ length: 4 }, (_, index) => ({
				optionName: option.name,
				value: index + 1,
			})),
		),
	);

	return Object.fromEntries(sums.map((sum, index) => [sum, pool[index % pool.length] as Award]));
}

function createPuzzleRules(): PuzzleRules {
	const names = optionNames();
	const sliderOrder = shuffle(sliderRoles);
	const sliderRolesById = Object.fromEntries(
		sliderControls.map((control, index) => [control.id, sliderOrder[index] as SliderRole]),
	) as Record<string, SliderRole>;
	const symbolOptions = shuffle(repeatToLength(names, symbolGlyphs.length));
	const symbolValues = shuffle([3, 5, 7, 9]);

	return {
		baseAwards: createBaseAwards(),
		binaryOptions: repeatingShuffledOptions(16),
		d1OptionSequence: shuffle(repeatToLength(names, 11)),
		d1ValueShifts: shuffle(Array.from({ length: 12 }, (_, index) => index)).slice(0, 11),
		invertedBinarySwitchIds: shuffle(binarySwitches.map(control => control.id)).slice(0, 2),
		sliderRoles: sliderRolesById,
		symbolAwards: Object.fromEntries(
			symbolGlyphs.map((symbol, index) => [
				symbol,
				{ optionName: symbolOptions[index] as string, value: symbolValues[index] as number },
			]),
		) as Record<SymbolGlyph, Award>,
	};
}

function createInitialCockpitState(): CockpitState {
	return {
		buttons: { [panicButton.id]: 0 },
		cranks: { [handCrank.id]: handCrank.initial },
		knobs: { [d1Control.id]: d1Control.initial, [d2Control.id]: d2Control.initial },
		rules: createPuzzleRules(),
		sliders: Object.fromEntries(sliderControls.map(control => [control.id, control.initial])),
		switches: Object.fromEntries(binarySwitches.map(control => [control.id, Math.random() < 0.5])),
	};
}

function knobValue(state: CockpitState, control: KnobControl) {
	return clamp(Math.round(state.knobs[control.id] ?? control.initial), control.min, control.max);
}

function sliderRawValue(state: CockpitState, id: string) {
	return clamp(Math.round(state.sliders[id] ?? 0), 0, 29);
}

function switchValue(state: CockpitState, id: string) {
	return Boolean(state.switches[id]);
}

function effectiveSwitchValue(state: CockpitState, control: SwitchControl) {
	const inverted = state.rules.invertedBinarySwitchIds.includes(control.id);
	return inverted ? !switchValue(state, control.id) : switchValue(state, control.id);
}

function binaryValue(state: CockpitState) {
	return binarySwitches.reduce((total, control) => total + (effectiveSwitchValue(state, control) ? control.bit : 0), 0);
}

function sliderIdForRole(state: CockpitState, role: SliderRole) {
	return sliderControls.find(control => state.rules.sliderRoles[control.id] === role)?.id ?? sliderControls[0].id;
}

function baseSliderValue(state: CockpitState, role: 'base-color' | 'base-value') {
	return 1 + modulo(sliderRawValue(state, sliderIdForRole(state, role)), colorBaseMax());
}

function symbolLowValue(state: CockpitState) {
	return clamp(sliderRawValue(state, sliderIdForRole(state, 'symbol-low')), 0, 10);
}

function symbolHighValue(state: CockpitState) {
	return clamp(sliderRawValue(state, sliderIdForRole(state, 'symbol-high')) - 10, 0, 19);
}

function selectedSymbolValue(state: CockpitState) {
	return clamp(symbolLowValue(state) + symbolHighValue(state), 0, 29);
}

function selectedSymbol(state: CockpitState): SymbolGlyph {
	const value = selectedSymbolValue(state);
	if (value <= 1) return '🐷';
	if (value <= 5) return '🐮';
	if (value <= 13) return '🥔';
	return '🦄';
}

function d1OptionShift(state: CockpitState) {
	return Math.floor(knobValue(state, d2Control) / 3);
}

function d1OptionForPosition(state: CockpitState, position: number) {
	const optionName =
		state.rules.d1OptionSequence[modulo(position + d1OptionShift(state), state.rules.d1OptionSequence.length)];
	return optionName ?? decidingOptions[0].name;
}

function d1OptionPips(state: CockpitState) {
	return Array.from({ length: d1Control.max - d1Control.min + 1 }, (_, index) =>
		d1OptionForPosition(state, d1Control.min + index),
	);
}

function d1ValueShift(state: CockpitState) {
	return state.rules.d1ValueShifts[knobValue(state, d2Control)] ?? 0;
}

function d1Award(state: CockpitState): Award {
	const d1 = knobValue(state, d1Control);
	return { optionName: d1OptionForPosition(state, d1), value: modulo(d1 + d1ValueShift(state), 12) };
}

function baseAward(state: CockpitState): Award {
	const sum = baseSliderValue(state, 'base-color') + baseSliderValue(state, 'base-value');
	return state.rules.baseAwards[sum] ?? { optionName: decidingOptions[0].name, value: 0 };
}

function binaryAward(state: CockpitState): Award {
	const value = binaryValue(state);
	return { optionName: state.rules.binaryOptions[value] ?? decidingOptions[0].name, value };
}

function symbolAward(state: CockpitState): Award {
	return state.rules.symbolAwards[selectedSymbol(state)];
}

function addAward(scores: OptionPoints, award: Award) {
	scores[award.optionName] = (scores[award.optionName] ?? 0) + award.value;
}

function cockpitScores(state: CockpitState) {
	const scores = emptyOptionPoints();
	addAward(scores, binaryAward(state));
	addAward(scores, d1Award(state));
	addAward(scores, baseAward(state));
	addAward(scores, symbolAward(state));
	return scores;
}

function optionColor(optionName: string) {
	return decidingOptions.find(option => option.name === optionName)?.color ?? '#ffffff';
}

function useCockpitSounds() {
	const audioContextRef = useRef<AudioContext | null>(null);

	useEffect(
		() => () => {
			void audioContextRef.current?.close();
		},
		[],
	);

	function play(type: ControlType | 'finish') {
		const AudioContext = window.AudioContext;
		if (!AudioContext) return;

		const context = audioContextRef.current ?? new AudioContext();
		audioContextRef.current = context;
		void context.resume();

		const gain = context.createGain();
		const oscillator = context.createOscillator();
		const now = context.currentTime;
		const settings = {
			button: { frequency: 96, end: 0.14, type: 'triangle' },
			crank: { frequency: 210, end: 0.045, type: 'square' },
			finish: { frequency: 440, end: 0.26, type: 'sine' },
			knob: { frequency: 320, end: 0.07, type: 'sine' },
			slider: { frequency: 180, end: 0.055, type: 'sawtooth' },
			switch: { frequency: 520, end: 0.08, type: 'square' },
		}[type] as { end: number; frequency: number; type: OscillatorType };

		oscillator.type = settings.type;
		oscillator.frequency.setValueAtTime(settings.frequency, now);
		oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, settings.frequency * 0.54), now + settings.end);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(0.08, now + 0.008);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.end);
		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start(now);
		oscillator.stop(now + settings.end + 0.02);
	}

	return play;
}

function controlStyle(accent: string) {
	return { '--cockpit-accent': accent } as CSSProperties;
}

function bindDocumentPointerDrag(onMove: (event: PointerEvent) => void, onDone: () => void) {
	function cleanup() {
		document.removeEventListener('pointermove', onMove);
		document.removeEventListener('pointerup', done);
		document.removeEventListener('pointercancel', done);
		window.removeEventListener('blur', done);
	}

	function done() {
		cleanup();
		onDone();
	}

	document.addEventListener('pointermove', onMove);
	document.addEventListener('pointerup', done);
	document.addEventListener('pointercancel', done);
	window.addEventListener('blur', done);

	return cleanup;
}

function angleFromCenter(centerX: number, centerY: number, clientX: number, clientY: number) {
	return Math.atan2(clientY - centerY, clientX - centerX);
}

function normalizeAngleDelta(delta: number) {
	if (delta > Math.PI) return delta - Math.PI * 2;
	if (delta < -Math.PI) return delta + Math.PI * 2;
	return delta;
}

function DialTicks({
	count,
	endAngle,
	radius,
	startAngle,
}: {
	count: number;
	endAngle: number;
	radius: number;
	startAngle: number;
}) {
	return (
		<span aria-hidden='true' className='pointer-events-none absolute inset-0'>
			{Array.from({ length: count }, (_, index) => {
				const progress = count <= 1 ? 0 : index / (count - 1);
				const angle = startAngle + (endAngle - startAngle) * progress;
				const major = index === 0 || index === count - 1 || index % 5 === 0;

				return (
					<span
						className='absolute left-1/2 top-1/2 rounded-full bg-neutral-950'
						key={index}
						style={{
							height: major ? '0.5rem' : '0.32rem',
							opacity: major ? 0.82 : 0.48,
							transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`,
							width: major ? '0.14rem' : '0.1rem',
						}}
					/>
				);
			})}
		</span>
	);
}

function DialOptionPips({
	endAngle,
	optionNames,
	radius,
	startAngle,
	value,
}: {
	endAngle: number;
	optionNames: string[];
	radius: number;
	startAngle: number;
	value: number;
}) {
	return (
		<span aria-hidden='true' className='pointer-events-none absolute inset-0'>
			{optionNames.map((optionName, index) => {
				const progress = optionNames.length <= 1 ? 0 : index / (optionNames.length - 1);
				const angle = startAngle + (endAngle - startAngle) * progress;
				const selected = index === value;

				return (
					<span
						className='absolute left-1/2 top-1/2 rounded-full border-2 border-neutral-950 shadow-[1px_1px_0_#171717]'
						key={`${optionName}-${index}`}
						style={{
							backgroundColor: optionColor(optionName),
							height: selected ? '0.8rem' : '0.58rem',
							transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`,
							width: selected ? '0.8rem' : '0.58rem',
						}}
					/>
				);
			})}
		</span>
	);
}

function Knob({
	control,
	onChange,
	optionPips,
	value,
}: {
	control: KnobControl;
	onChange: (value: number) => void;
	optionPips?: string[];
	value: number;
}) {
	const [dragging, setDragging] = useState(false);
	const dragRef = useRef<{
		centerX: number;
		centerY: number;
		lastAngle: number;
		remainder: number;
		value: number;
	} | null>(null);
	const dragCleanupRef = useRef<(() => void) | null>(null);
	const onChangeRef = useRef(onChange);
	const valueRef = useRef(value);
	const percent = (value - control.min) / Math.max(1, control.max - control.min);
	const angle = -135 + percent * 270;

	useEffect(() => {
		onChangeRef.current = onChange;
		valueRef.current = value;
	}, [onChange, value]);

	useEffect(() => () => dragCleanupRef.current?.(), []);

	function updateFromPointer(event: PointerEvent) {
		const drag = dragRef.current;
		if (!drag) return;

		if (event.cancelable) event.preventDefault();

		const nextAngle = angleFromCenter(drag.centerX, drag.centerY, event.clientX, event.clientY);
		const nextRemainder = drag.remainder + normalizeAngleDelta(nextAngle - drag.lastAngle);
		const stepRadians = (Math.PI * 1.5) / Math.max(1, control.max - control.min);
		const ticks = nextRemainder > 0 ? Math.floor(nextRemainder / stepRadians) : Math.ceil(nextRemainder / stepRadians);
		drag.lastAngle = nextAngle;
		drag.remainder = nextRemainder - ticks * stepRadians;

		if (ticks === 0) return;

		const nextValue = clamp(drag.value + ticks, control.min, control.max);
		if (nextValue === drag.value) return;

		drag.value = nextValue;
		onChangeRef.current(nextValue);
	}

	function finishDrag() {
		dragRef.current = null;
		dragCleanupRef.current = null;
		setDragging(false);
	}

	function startDrag(event: ReactPointerEvent<HTMLButtonElement>) {
		event.preventDefault();
		dragCleanupRef.current?.();

		const rect = event.currentTarget.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		dragRef.current = {
			centerX,
			centerY,
			lastAngle: angleFromCenter(centerX, centerY, event.clientX, event.clientY),
			remainder: 0,
			value: valueRef.current,
		};
		setDragging(true);

		const cleanup = bindDocumentPointerDrag(updateFromPointer, finishDrag);
		dragCleanupRef.current = () => {
			cleanup();
			finishDrag();
		};
	}

	return (
		<div className='flex flex-col items-center gap-1'>
			<button
				aria-label={control.label}
				aria-valuemax={control.max}
				aria-valuemin={control.min}
				aria-valuenow={value}
				className={`relative flex h-[5.75rem] w-[5.75rem] touch-none select-none items-center justify-center rounded-full border-2 border-neutral-950 bg-neutral-100 text-neutral-950 shadow-[4px_4px_0_#171717,inset_2px_2px_0_rgba(255,255,255,0.85),inset_-3px_-3px_0_rgba(23,23,23,0.16)] transition-transform ${dragging ? 'scale-105' : ''}`}
				onKeyDown={event => {
					if (
						event.key !== 'ArrowUp' &&
						event.key !== 'ArrowRight' &&
						event.key !== 'ArrowDown' &&
						event.key !== 'ArrowLeft'
					)
						return;
					event.preventDefault();
					onChange(value + (event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1));
				}}
				onPointerDown={startDrag}
				role='slider'
				style={controlStyle(control.accent)}
				type='button'
			>
				<DialTicks count={control.max - control.min + 1} endAngle={135} radius={40} startAngle={-135} />
				{optionPips ? (
					<DialOptionPips endAngle={135} optionNames={optionPips} radius={40} startAngle={-135} value={value} />
				) : null}
				<span
					className='relative z-10 h-14 w-14 rounded-full border-2 border-neutral-950 bg-[radial-gradient(circle_at_35%_30%,#f8fafc_0%,#d4d4d8_45%,#9ca3af_100%)] shadow-[inset_2px_2px_0_rgba(255,255,255,0.8),inset_-3px_-3px_0_rgba(23,23,23,0.2),2px_2px_0_rgba(23,23,23,0.18)]'
					style={{ transform: `rotate(${angle}deg)` }}
				>
					<span className='absolute left-1/2 top-1 h-6 w-1 -translate-x-1/2 rounded-full bg-[var(--cockpit-accent)] shadow-[0_0_0_1px_rgba(23,23,23,0.28)]' />
					<span className='absolute inset-5 rounded-full border border-neutral-950/35 bg-neutral-300/70' />
				</span>
			</button>
		</div>
	);
}

function VerticalPuzzleSlider({
	control,
	onChange,
	role,
	value,
}: {
	control: SliderControl;
	onChange: (value: number) => void;
	role: SliderRole;
	value: number;
}) {
	return (
		<label
			className='flex h-40 min-h-0 w-[3.75rem] select-none flex-col items-center gap-1 rounded-lg border-2 border-neutral-950 bg-white p-2 text-neutral-950 shadow-[3px_3px_0_#171717]'
			style={controlStyle(control.accent)}
		>
			<span className='max-w-full truncate text-[0.5rem] font-black leading-none'>{sliderRoleLabels[role]}</span>
			<input
				aria-label={sliderRoleLabels[role]}
				className='cockpit-range cockpit-range-vertical min-h-0 flex-1'
				max={29}
				min={0}
				onChange={event => onChange(Number(event.currentTarget.value))}
				step={1}
				type='range'
				value={value}
			/>
			<span className='rounded bg-neutral-950 px-1.5 py-0.5 text-xs font-black leading-none text-white'>{value}</span>
		</label>
	);
}

function CircularCrank({
	control,
	onTurn,
	popups,
	turns,
}: {
	control: CrankControl;
	onTurn: (ticks: number) => void;
	popups: CrankPopup[];
	turns: number;
}) {
	const crankRef = useRef<HTMLButtonElement | null>(null);
	const dragRef = useRef<{ centerX: number; centerY: number; lastAngle: number; remainder: number } | null>(null);
	const dragCleanupRef = useRef<(() => void) | null>(null);
	const onTurnRef = useRef(onTurn);

	useEffect(() => {
		onTurnRef.current = onTurn;
	}, [onTurn]);

	useEffect(() => () => dragCleanupRef.current?.(), []);

	function updateFromPointer(event: PointerEvent) {
		const drag = dragRef.current;
		if (!drag) return;

		if (event.cancelable) event.preventDefault();

		const nextAngle = angleFromCenter(drag.centerX, drag.centerY, event.clientX, event.clientY);
		const nextRemainder = drag.remainder + normalizeAngleDelta(nextAngle - drag.lastAngle);
		const tickRadians = Math.PI / 6;
		const ticks = nextRemainder > 0 ? Math.floor(nextRemainder / tickRadians) : Math.ceil(nextRemainder / tickRadians);
		drag.lastAngle = nextAngle;
		drag.remainder = nextRemainder - ticks * tickRadians;
		if (ticks !== 0) onTurnRef.current(ticks);
	}

	function finishDrag() {
		dragRef.current = null;
		dragCleanupRef.current = null;
	}

	function startDrag(event: ReactPointerEvent<HTMLSpanElement>) {
		event.preventDefault();
		event.stopPropagation();
		dragCleanupRef.current?.();

		const rect = crankRef.current?.getBoundingClientRect();
		if (!rect) return;

		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		dragRef.current = {
			centerX,
			centerY,
			lastAngle: angleFromCenter(centerX, centerY, event.clientX, event.clientY),
			remainder: 0,
		};

		const cleanup = bindDocumentPointerDrag(updateFromPointer, finishDrag);
		dragCleanupRef.current = () => {
			cleanup();
			finishDrag();
		};
	}

	return (
		<div className='relative flex flex-col items-center gap-1'>
			<button
				aria-label={control.label}
				className='relative h-20 w-20 touch-none rounded-full border-2 border-neutral-950 bg-yellow-200 text-neutral-950 shadow-[4px_4px_0_#171717,inset_2px_2px_0_rgba(255,255,255,0.7),inset_-3px_-3px_0_rgba(23,23,23,0.16)]'
				ref={crankRef}
				type='button'
			>
				<DialTicks count={12} endAngle={330} radius={35} startAngle={0} />
				<span
					className='absolute inset-2 z-10 rounded-full border-2 border-neutral-950 bg-[radial-gradient(circle_at_36%_30%,#ffffff_0%,#f8fafc_34%,#d1d5db_100%)] shadow-[inset_2px_2px_0_rgba(255,255,255,0.75),inset_-3px_-3px_0_rgba(23,23,23,0.18)] transition-transform duration-75'
					style={{ transform: `rotate(${turns * 30}deg)` }}
				>
					<span
						className='absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 translate-x-1 cursor-grab rounded-full border-2 border-neutral-950 bg-red-500 shadow-[2px_2px_0_#171717,inset_1px_1px_0_rgba(255,255,255,0.42)] active:cursor-grabbing active:scale-110'
						onPointerDown={startDrag}
					/>
				</span>
				<span className='absolute inset-[1.85rem] z-20 rounded-full border-2 border-neutral-950 bg-neutral-300 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]' />
			</button>
			{popups.map(popup => (
				<span
					className='cockpit-popup pointer-events-none absolute z-30 rounded border-2 border-neutral-950 bg-white px-2 py-1 text-xs font-black text-neutral-950 shadow-[2px_2px_0_#171717]'
					key={popup.id}
					style={
						{
							'--popup-rotation': `${popup.rotate}deg`,
							left: `${popup.left}px`,
							top: `${popup.top}px`,
						} as CSSProperties
					}
				>
					{popup.label}
				</span>
			))}
		</div>
	);
}

function UiverseSwitch({
	control,
	onChange,
	value,
}: {
	control: SwitchControl;
	onChange: (value: boolean) => void;
	value: boolean;
}) {
	return (
		<label className='cockpit-uiverse-switch flex select-none flex-col items-center'>
			<span className='cockpit-uiverse-stage'>
				<span className='cockpit-uiverse-toggle'>
					<input
						aria-label={control.ariaLabel}
						checked={value}
						className='cockpit-uiverse-toggle-input'
						onChange={event => onChange(event.currentTarget.checked)}
						type='checkbox'
					/>
					<span className='cockpit-uiverse-toggle-handle-wrapper'>
						<span className='cockpit-uiverse-toggle-handle'>
							<span className='cockpit-uiverse-toggle-knob' />
							<span className='cockpit-uiverse-toggle-bar-wrapper'>
								<span className='cockpit-uiverse-toggle-bar' />
							</span>
						</span>
					</span>
					<span className='cockpit-uiverse-toggle-base'>
						<span className='cockpit-uiverse-toggle-base-inside' />
					</span>
				</span>
			</span>
		</label>
	);
}

function RoundRedButton({
	control,
	onPress,
	presses,
}: {
	control: ButtonControl;
	onPress: () => void;
	presses: number;
}) {
	return (
		<button
			aria-label={control.label}
			className='relative h-[7.5rem] w-[7.5rem] rounded-full border-2 border-neutral-950 bg-red-700 p-1.5 shadow-[5px_5px_0_#171717] transition-transform active:scale-90 active:shadow-[2px_2px_0_#171717]'
			onClick={onPress}
			type='button'
		>
			<span className='flex h-full w-full items-center justify-center rounded-full border-2 border-red-950 bg-red-500 text-base font-black leading-none text-white shadow-[inset_4px_4px_0_rgba(255,255,255,0.24),inset_-4px_-4px_0_rgba(23,23,23,0.24)]'>
				{control.label}
			</span>
			{presses > 0 ? (
				<span className='cockpit-button-flash absolute inset-0 rounded-full border-4 border-white/70' key={presses} />
			) : null}
		</button>
	);
}

function BinaryValueDisplay({ award, value }: { award: Award; value: number }) {
	return (
		<div
			aria-label={`binary value ${value} for ${award.optionName}`}
			className='flex h-12 w-12 items-center justify-center rounded-lg border-2 border-neutral-950 text-2xl font-black leading-none text-neutral-950 shadow-[3px_3px_0_#171717]'
			style={{ backgroundColor: optionColor(award.optionName) }}
		>
			{value}
		</div>
	);
}

function SymbolScreens({ selected }: { selected: SymbolGlyph }) {
	return (
		<div className='grid grid-cols-2 place-items-center gap-1'>
			{symbolGlyphs.map(symbol => {
				const active = symbol === selected;
				return (
					<div
						className={`flex h-9 w-9 items-center justify-center rounded-md border-2 border-neutral-950 text-xl shadow-[2px_2px_0_#171717] transition-all ${
							active ? 'bg-lime-200 saturate-150' : 'bg-neutral-900 opacity-45 grayscale'
						}`}
						key={symbol}
					>
						{symbol}
					</div>
				);
			})}
		</div>
	);
}

function BaseAwardDisplay({ award }: { award: Award }) {
	return (
		<div
			className='flex h-9 min-w-14 items-center justify-center rounded-md border-2 border-neutral-950 px-2 text-lg font-black leading-none text-neutral-950 shadow-[2px_2px_0_#171717]'
			style={{ backgroundColor: optionColor(award.optionName) }}
		>
			{award.value}
		</div>
	);
}

export default function CockpitScreen({ submit }: QuizScreenProps<CockpitScreenConfig>) {
	const [initialCockpit] = useState(createInitialCockpitState);
	const [cockpit, setCockpit] = useState(initialCockpit);
	const [finished, setFinished] = useState(false);
	const [popups, setPopups] = useState<CrankPopup[]>([]);
	const finishedRef = useRef(false);
	const previousScoresRef = useRef<OptionPoints>(cockpitScores(initialCockpit));
	const popupIdRef = useRef(0);
	const popupTimeoutsRef = useRef<number[]>([]);
	const playSound = useCockpitSounds();
	const { clearScoreAnimationTimeouts, displayScores, scoreBumps, scoreEffects, scores, setAnimatedScores } =
		useAnimatedScores(previousScoresRef.current);

	useEffect(() => {
		const nextScores = cockpitScores(cockpit);
		const deltas = scoreDeltasBetween(previousScoresRef.current, nextScores);
		previousScoresRef.current = nextScores;
		setAnimatedScores(nextScores, deltas);
	}, [cockpit]);

	useEffect(
		() => () => {
			for (const timeout of popupTimeoutsRef.current) window.clearTimeout(timeout);
			clearScoreAnimationTimeouts();
		},
		[],
	);

	function finish() {
		if (finishedRef.current) return;

		finishedRef.current = true;
		playSound('finish');
		setFinished(true);
	}

	function maybeSpawnCrankPopup() {
		if (Math.random() > 0.12) return;

		const id = popupIdRef.current + 1;
		popupIdRef.current = id;
		const popup = {
			id,
			label: randomItem(popupLabels) ?? 'heck!',
			left: 18 + Math.random() * 34,
			top: -18 - Math.random() * 28,
			rotate: -16 + Math.random() * 32,
		};

		setPopups(current => [...current, popup]);
		const timeout = window.setTimeout(() => {
			setPopups(current => current.filter(item => item.id !== id));
			popupTimeoutsRef.current = popupTimeoutsRef.current.filter(item => item !== timeout);
		}, 900);
		popupTimeoutsRef.current.push(timeout);
	}

	function updateKnob(control: KnobControl, value: number) {
		if (finished) return;

		playSound('knob');
		setCockpit(current => ({
			...current,
			knobs: { ...current.knobs, [control.id]: clamp(Math.round(value), control.min, control.max) },
		}));
	}

	function updateSlider(id: string, value: number) {
		if (finished) return;

		playSound('slider');
		setCockpit(current => ({
			...current,
			sliders: { ...current.sliders, [id]: clamp(Math.round(value), 0, 29) },
		}));
	}

	function updateSwitch(id: string, value: boolean) {
		if (finished) return;

		playSound('switch');
		setCockpit(current => ({
			...current,
			switches: { ...current.switches, [id]: value },
		}));
	}

	function pressPanic() {
		if (finished) return;

		playSound('button');
		setCockpit(current => ({
			...current,
			buttons: { ...current.buttons, [panicButton.id]: (current.buttons[panicButton.id] ?? 0) + 1 },
			rules: createPuzzleRules(),
		}));
	}

	function turnCrank(ticks: number) {
		if (finished) return;

		playSound('crank');
		maybeSpawnCrankPopup();
		setCockpit(current => ({
			...current,
			cranks: { ...current.cranks, [handCrank.id]: (current.cranks[handCrank.id] ?? 0) + ticks },
		}));
	}

	const binary = binaryValue(cockpit);
	const selectedBinaryAward = binaryAward(cockpit);
	const d1 = knobValue(cockpit, d1Control);
	const d2 = knobValue(cockpit, d2Control);
	const d1Pips = d1OptionPips(cockpit);
	const selectedBaseAward = baseAward(cockpit);
	const selectedSymbolGlyph = selectedSymbol(cockpit);

	return (
		<div className='flex h-full min-h-0 flex-col gap-3 px-2 py-3'>
			<section className='relative h-full max-h-[36rem] min-h-0 overflow-hidden rounded-lg border-2 border-neutral-950 bg-lime-100 p-3 shadow-[5px_5px_0_#171717]'>
				<div className='pointer-events-none absolute left-3 right-3 top-3 z-20 flex justify-end'>
					<OptionScoreDisplays bumps={scoreBumps} effects={scoreEffects} scores={displayScores} />
				</div>

				<div className='absolute left-3 top-[4.1rem]'>
					<Knob control={d1Control} onChange={value => updateKnob(d1Control, value)} optionPips={d1Pips} value={d1} />
				</div>

				<div className='absolute right-2 top-[4.1rem] flex items-start gap-2'>
					<BinaryValueDisplay award={selectedBinaryAward} value={binary} />
					{binarySwitches.map(control => (
						<UiverseSwitch
							control={control}
							key={control.id}
							onChange={value => updateSwitch(control.id, value)}
							value={switchValue(cockpit, control.id)}
						/>
					))}
				</div>

				<div className='absolute left-1/2 top-[12.45rem] -translate-x-[10rem]'>
					<CircularCrank
						control={handCrank}
						onTurn={turnCrank}
						popups={popups}
						turns={cockpit.cranks[handCrank.id] ?? 0}
					/>
				</div>

				<div className='absolute left-1/2 top-[11.2rem] -translate-x-1/2'>
					<RoundRedButton control={panicButton} onPress={pressPanic} presses={cockpit.buttons[panicButton.id] ?? 0} />
				</div>

				<div className='absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1'>
					<SymbolScreens selected={selectedSymbolGlyph} />
					<BaseAwardDisplay award={selectedBaseAward} />
				</div>

				<div className='absolute right-3 top-[18.3rem] z-10'>
					<Knob control={d2Control} onChange={value => updateKnob(d2Control, value)} value={d2} />
				</div>

				<div className='absolute bottom-3 left-2 flex gap-2'>
					{sliderControls.slice(0, 2).map(control => (
						<VerticalPuzzleSlider
							control={control}
							key={control.id}
							onChange={value => updateSlider(control.id, value)}
							role={cockpit.rules.sliderRoles[control.id] ?? 'base-color'}
							value={sliderRawValue(cockpit, control.id)}
						/>
					))}
				</div>

				<div className='absolute bottom-3 right-2 flex gap-2'>
					{sliderControls.slice(2).map(control => (
						<VerticalPuzzleSlider
							control={control}
							key={control.id}
							onChange={value => updateSlider(control.id, value)}
							role={cockpit.rules.sliderRoles[control.id] ?? 'base-color'}
							value={sliderRawValue(cockpit, control.id)}
						/>
					))}
				</div>

				{finished ? (
					<div className='absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/45 p-4'>
						<div className='w-full max-w-xs rounded-lg border-2 border-neutral-950 bg-white p-4 text-center text-neutral-950 shadow-[5px_5px_0_#171717]'>
							<p className='text-xs font-black uppercase text-orange-700'>final dashboard nonsense</p>
							<div className='mt-3'>
								<ScoreChips scores={scores} />
							</div>
							<Button className='mt-3' onClick={() => submit(scores)} theme='endAction'>
								file the flight report
							</Button>
						</div>
					</div>
				) : null}
			</section>

			<Button disabled={finished} onClick={finish} theme='endAction'>
				lock in
			</Button>
		</div>
	);
}
