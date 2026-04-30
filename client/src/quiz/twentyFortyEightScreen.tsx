import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { decidingOptions } from '../../../shared/constants.ts';
import { Button } from '../components/Button.tsx';
import { emptyOptionPoints, type OptionPoints, type QuizScreenProps } from './quizScreen.tsx';

type TwentyFortyEightScreenConfig = {
	title: string;
};

type Direction = 'up' | 'down' | 'left' | 'right';

type Tile = {
	id: number;
	value: number;
};
type EndReason = 'full' | 'moves' | null;

type GameState = {
	board: Board;
	colorOptionNames: string[];
	done: boolean;
	endReason: EndReason;
	moves: number;
	newTileIds: number[];
	nextTileId: number;
};

type Board = Array<Tile | null>;
type PositionedTile = {
	tile: Tile;
	row: number;
	col: number;
};
type RenderedTile = PositionedTile & {
	animates?: boolean;
};
type MovePlan = {
	board: Board;
	changed: boolean;
	mergeSourceIds: number[];
	mergeTiles: PositionedTile[];
	slideTiles: RenderedTile[];
};

const boardSize = 4;
const cellCount = boardSize * boardSize;
const maxMoves = 20;
const initialValues = [2, 2, 2, 4, 4] as const;
const spawnValues = [2, 4, 8] as const;
const mergeCollapseMs = 120;
const mergePopMs = 180;
const slideAnimationMs = 240;
const swipeThreshold = 36;
const tileLayoutTransition = {
	type: 'spring',
	stiffness: 520,
	damping: 42,
	mass: 0.72,
} as const;
const tilePopTransition = {
	type: 'spring',
	stiffness: 680,
	damping: 24,
	mass: 0.58,
} as const;
const mergeScaleTransition = {
	duration: 0.18,
	ease: 'easeOut' as const,
	times: [0, 0.58, 1],
};

function randomItem<T>(items: readonly T[]) {
	return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function shuffled<T>(items: readonly T[]) {
	const next = items.slice();

	for (let index = next.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		const item = next[index];
		next[index] = next[swapIndex];
		next[swapIndex] = item;
	}

	return next;
}

function boardIndex(row: number, col: number) {
	return row * boardSize + col;
}

function boardPosition(index: number) {
	return {
		row: Math.floor(index / boardSize),
		col: index % boardSize,
	};
}

function emptyBoard(): Board {
	return Array.from({ length: cellCount }, () => null);
}

function optionForName(optionName: string) {
	return decidingOptions.find(option => option.name === optionName) ?? decidingOptions[0];
}

function valuePowerIndex(value: number) {
	return Math.max(0, Math.round(Math.log2(value)) - 1);
}

function optionNameForValue(value: number, colorOptionNames: readonly string[]) {
	const optionNames = colorOptionNames.length ? colorOptionNames : decidingOptions.map(option => option.name);
	return optionNames[valuePowerIndex(value) % optionNames.length] ?? decidingOptions[0].name;
}

function optionForValue(value: number, colorOptionNames: readonly string[]) {
	return optionForName(optionNameForValue(value, colorOptionNames));
}

function cloneBoard(board: Board) {
	return board.slice();
}

function emptyIndexes(board: Board) {
	return board.reduce<number[]>((indexes, tile, index) => {
		if (!tile) indexes.push(index);
		return indexes;
	}, []);
}

function placeValues(board: Board, nextTileId: number, values: readonly number[]) {
	const next = cloneBoard(board);
	let id = nextTileId;
	const newTileIds: number[] = [];

	for (const value of values) {
		const empties = emptyIndexes(next);
		const index = randomItem(empties);
		if (index === undefined) break;

		next[index] = { id, value };
		newTileIds.push(id);
		id += 1;
	}

	return { board: next, newTileIds, nextTileId: id };
}

function spawnTile(board: Board, nextTileId: number) {
	return placeValues(board, nextTileId, [randomItem(spawnValues) ?? 2]);
}

function createInitialGame(): GameState {
	const seeded = placeValues(emptyBoard(), 1, shuffled(initialValues));

	return {
		board: seeded.board,
		colorOptionNames: shuffled(decidingOptions.map(option => option.name)),
		done: false,
		endReason: null,
		moves: 0,
		newTileIds: seeded.newTileIds,
		nextTileId: seeded.nextTileId,
	};
}

function lineIndexes(direction: Direction, line: number) {
	return Array.from({ length: boardSize }, (_, offset) => {
		if (direction === 'left') return boardIndex(line, offset);
		if (direction === 'right') return boardIndex(line, boardSize - 1 - offset);
		if (direction === 'up') return boardIndex(offset, line);
		return boardIndex(boardSize - 1 - offset, line);
	});
}

function slideLine(line: Array<Tile | null>, sourceIndexes: number[], targetIndexes: number[]) {
	const tiles = line.reduce<Array<{ sourceIndex: number; tile: Tile }>>((items, tile, index) => {
		if (tile) items.push({ sourceIndex: sourceIndexes[index], tile });
		return items;
	}, []);
	const next: Array<Tile | null> = [];
	const mergeSourceIds: number[] = [];
	const mergeTiles: PositionedTile[] = [];
	const slideTiles: RenderedTile[] = [];

	for (let index = 0; index < tiles.length; index += 1) {
		const item = tiles[index];
		const nextItem = tiles[index + 1];
		const targetIndex = targetIndexes[next.length];
		const targetPosition = boardPosition(targetIndex);

		if (nextItem && item.tile.value === nextItem.tile.value) {
			slideTiles.push({ animates: true, tile: item.tile, ...targetPosition });
			slideTiles.push({ animates: true, tile: nextItem.tile, ...targetPosition });
			const mergedTile = { ...item.tile, value: item.tile.value * 2 };
			next.push(mergedTile);
			mergeTiles.push({ tile: mergedTile, ...targetPosition });
			mergeSourceIds.push(item.tile.id, nextItem.tile.id);
			index += 1;
			continue;
		}

		slideTiles.push({ animates: item.sourceIndex !== targetIndex, tile: item.tile, ...targetPosition });
		next.push(item.tile);
	}

	while (next.length < boardSize) next.push(null);

	return { line: next, mergeSourceIds, mergeTiles, slideTiles };
}

function sameTile(left: Tile | null, right: Tile | null) {
	if (!left || !right) return left === right;
	return left.id === right.id && left.value === right.value;
}

function sameBoard(left: Board, right: Board) {
	return left.every((tile, index) => sameTile(tile, right[index]));
}

function moveBoard(board: Board, direction: Direction): MovePlan {
	const next = emptyBoard();
	const mergeSourceIds: number[] = [];
	const mergeTiles: PositionedTile[] = [];
	const slideTiles: RenderedTile[] = [];

	for (let line = 0; line < boardSize; line += 1) {
		const indexes = lineIndexes(direction, line);
		const moved = slideLine(
			indexes.map(index => board[index]),
			indexes,
			indexes,
		);
		mergeSourceIds.push(...moved.mergeSourceIds);
		mergeTiles.push(...moved.mergeTiles);
		slideTiles.push(...moved.slideTiles);

		for (let index = 0; index < indexes.length; index += 1) next[indexes[index]] = moved.line[index];
	}

	return { board: next, changed: !sameBoard(board, next), mergeSourceIds, mergeTiles, slideTiles };
}

function hasAnyLegalMove(board: Board) {
	if (board.some(tile => tile === null)) return true;

	for (let row = 0; row < boardSize; row += 1) {
		for (let col = 0; col < boardSize; col += 1) {
			const tile = board[boardIndex(row, col)];
			const right = col < boardSize - 1 ? board[boardIndex(row, col + 1)] : null;
			const down = row < boardSize - 1 ? board[boardIndex(row + 1, col)] : null;

			if ((tile && right && tile.value === right.value) || (tile && down && tile.value === down.value)) return true;
		}
	}

	return false;
}

function boardScores(board: Board, colorOptionNames: readonly string[]) {
	const scores = emptyOptionPoints();

	for (const tile of board) {
		if (!tile) continue;

		const optionName = optionNameForValue(tile.value, colorOptionNames);
		scores[optionName] = (scores[optionName] ?? 0) + tile.value;
	}

	return scores;
}

function positionedTiles(board: Board) {
	return board.reduce<PositionedTile[]>((tiles, tile, index) => {
		if (!tile) return tiles;

		tiles.push({ tile, ...boardPosition(index) });
		return tiles;
	}, []);
}

function valueLabel(value: number) {
	return `${value}`;
}

function ScoreChips({ scores }: { scores: OptionPoints }) {
	return (
		<div className='grid grid-cols-2 gap-2'>
			{decidingOptions.map(option => (
				<div
					className='rounded-lg border-2 border-neutral-950 px-2 py-1.5 text-neutral-950 shadow-[2px_2px_0_#171717]'
					key={option.name}
					style={{ backgroundColor: option.color }}
				>
					<p className='truncate text-[0.65rem] font-black uppercase leading-none'>{option.name}</p>
					<p className='mt-1 text-xl font-black leading-none'>{valueLabel(scores[option.name] ?? 0)}</p>
				</div>
			))}
		</div>
	);
}

function tileGridStyle(row: number, col: number) {
	return {
		gridColumn: `${col + 1}`,
		gridRow: `${row + 1}`,
	} satisfies CSSProperties;
}

function TileView({
	col,
	colorOptionNames,
	isMerge,
	isMergingSource,
	isNew,
	row,
	shouldAnimatePosition,
	tile,
}: PositionedTile & {
	colorOptionNames: readonly string[];
	isMerge?: boolean;
	isMergingSource?: boolean;
	isNew?: boolean;
	shouldAnimatePosition?: boolean;
}) {
	const option = optionForValue(tile.value, colorOptionNames);
	const zIndex = isMerge ? 30 : isNew ? 25 : isMergingSource ? 20 : 10;
	const opacity = isMerge ? 1 : isMergingSource ? 0 : 1;
	const scale = isMerge ? [0.76, 1.12, 1] : isMergingSource ? 0.72 : 1;

	return (
		<motion.div
			aria-label={`${option.name} ${valueLabel(tile.value)}`}
			animate={{
				opacity,
				scale,
			}}
			className='flex h-full min-h-0 w-full min-w-0 select-none items-center justify-center rounded-md border-2 border-neutral-950 px-1 text-center text-2xl font-black leading-none text-neutral-950 shadow-[3px_3px_0_#171717] sm:text-3xl'
			exit={{ opacity: 0, scale: 0.68 }}
			initial={isNew ? { opacity: 0, scale: 0.42 } : false}
			layout={shouldAnimatePosition === false ? false : 'position'}
			style={{ ...tileGridStyle(row, col), backgroundColor: option.color, zIndex }}
			transition={{
				layout: tileLayoutTransition,
				opacity: { duration: isMergingSource ? 0.12 : 0.16, ease: 'easeOut' },
				scale: isMerge ? mergeScaleTransition : isNew ? tilePopTransition : { duration: 0.12, ease: 'easeOut' },
			}}
		>
			{valueLabel(tile.value)}
		</motion.div>
	);
}

function MoveButton({
	className,
	direction,
	disabled,
	Icon,
	onMove,
	style,
}: {
	className?: string;
	direction: Direction;
	disabled: boolean;
	Icon: typeof ArrowUp;
	onMove: (direction: Direction) => void;
	style: CSSProperties;
}) {
	return (
		<Button
			aria-label={`Move ${direction}`}
			className={`pointer-events-auto absolute z-20 rounded ${className ?? ''}`}
			disabled={disabled}
			onClick={event => {
				event.stopPropagation();
				onMove(direction);
			}}
			onPointerDown={event => event.stopPropagation()}
			size='miniIcon'
			style={style}
			theme='edgeIcon'
		>
			<Icon className='pointer-events-none' size={12} weight='bold' />
		</Button>
	);
}

export default function TwentyFortyEightScreen({ submit }: QuizScreenProps<TwentyFortyEightScreenConfig>) {
	const [game, setGame] = useState(createInitialGame);
	const [invalidMoveId, setInvalidMoveId] = useState(0);
	const [mergeSourceIds, setMergeSourceIds] = useState<Set<number>>(() => new Set());
	const [mergeTileIds, setMergeTileIds] = useState<Set<number>>(() => new Set());
	const [moving, setMoving] = useState(false);
	const [slideTiles, setSlideTiles] = useState<RenderedTile[] | null>(null);
	const gameRef = useRef(game);
	const movingRef = useRef(false);
	const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
	const mergeTimeoutRef = useRef<number | null>(null);
	const submittedRef = useRef(false);
	const spawnTimeoutRef = useRef<number | null>(null);
	const scores = useMemo(() => boardScores(game.board, game.colorOptionNames), [game.board, game.colorOptionNames]);
	const tiles = useMemo(() => positionedTiles(game.board), [game.board]);
	const visibleTiles: RenderedTile[] = slideTiles ?? tiles;
	const newTileIds = useMemo(() => new Set(game.newTileIds), [game.newTileIds]);

	const finishMove = useCallback((board: Board, nextTileId: number, moves: number, colorOptionNames: string[]) => {
		const spawned = spawnTile(board, nextTileId);
		const outOfMoves = moves >= maxMoves;
		const full = !hasAnyLegalMove(spawned.board);
		const endReason: EndReason = full && !outOfMoves ? 'full' : outOfMoves ? 'moves' : null;
		const next = {
			board: spawned.board,
			colorOptionNames,
			done: outOfMoves || full,
			endReason,
			moves,
			newTileIds: spawned.newTileIds,
			nextTileId: spawned.nextTileId,
		};

		movingRef.current = false;
		gameRef.current = next;
		setMergeTileIds(new Set());
		setMoving(false);
		setGame(next);
		spawnTimeoutRef.current = null;
	}, []);

	const applyMove = useCallback(
		(direction: Direction) => {
			const current = gameRef.current;
			if (current.done || movingRef.current) return;

			const moved = moveBoard(current.board, direction);
			if (!moved.changed) {
				setInvalidMoveId(currentId => currentId + 1);
				return;
			}

			const moves = current.moves + 1;
			const sliding = {
				...current,
				done: false,
				endReason: null,
				moves,
				newTileIds: [],
			};

			movingRef.current = true;
			gameRef.current = sliding;
			setMergeSourceIds(new Set());
			setMergeTileIds(new Set());
			setMoving(true);
			setSlideTiles(moved.slideTiles);
			setGame(sliding);

			if (spawnTimeoutRef.current) window.clearTimeout(spawnTimeoutRef.current);
			if (mergeTimeoutRef.current) window.clearTimeout(mergeTimeoutRef.current);
			mergeTimeoutRef.current = window.setTimeout(() => {
				const sourceIds = new Set(moved.mergeSourceIds);
				setMergeSourceIds(sourceIds);

				mergeTimeoutRef.current = window.setTimeout(
					() => {
						const merged = {
							...sliding,
							board: moved.board,
							newTileIds: [],
						};

						gameRef.current = merged;
						setGame(merged);
						setSlideTiles(null);
						setMergeSourceIds(new Set());
						setMergeTileIds(new Set(moved.mergeTiles.map(tile => tile.tile.id)));
						mergeTimeoutRef.current = null;

						spawnTimeoutRef.current = window.setTimeout(
							() => {
								finishMove(moved.board, current.nextTileId, moves, current.colorOptionNames);
							},
							moved.mergeTiles.length ? mergePopMs : 40,
						);
					},
					sourceIds.size ? mergeCollapseMs : 0,
				);
			}, slideAnimationMs);
		},
		[finishMove],
	);

	useEffect(() => {
		gameRef.current = game;
	}, [game]);

	useEffect(() => {
		if (!invalidMoveId) return;

		const timeout = window.setTimeout(() => setInvalidMoveId(0), 190);
		return () => window.clearTimeout(timeout);
	}, [invalidMoveId]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const keyDirections: Partial<Record<string, Direction>> = {
				ArrowDown: 'down',
				ArrowLeft: 'left',
				ArrowRight: 'right',
				ArrowUp: 'up',
				a: 'left',
				d: 'right',
				s: 'down',
				w: 'up',
			};
			const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
			const direction = keyDirections[key];
			if (!direction) return;

			event.preventDefault();
			applyMove(direction);
		}

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [applyMove]);

	useEffect(() => {
		return () => {
			if (mergeTimeoutRef.current) window.clearTimeout(mergeTimeoutRef.current);
			if (spawnTimeoutRef.current) window.clearTimeout(spawnTimeoutRef.current);
		};
	}, []);

	function finishSwipe(clientX: number, clientY: number) {
		const start = swipeStartRef.current;
		swipeStartRef.current = null;
		if (!start) return;

		const dx = clientX - start.x;
		const dy = clientY - start.y;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeThreshold) return;

		if (Math.abs(dx) > Math.abs(dy)) {
			applyMove(dx > 0 ? 'right' : 'left');
			return;
		}

		applyMove(dy > 0 ? 'down' : 'up');
	}

	function submitFinalScore() {
		if (submittedRef.current) return;

		submittedRef.current = true;
		submit(boardScores(game.board, game.colorOptionNames));
	}

	return (
		<div className='flex h-full min-h-0 w-full items-center justify-center px-1 py-3'>
			<section className='relative flex max-h-full w-full flex-col gap-3 rounded-lg border-2 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#171717]'>
				<div className='flex justify-end'>
					<ScoreChips scores={scores} />
				</div>

				<div className='mx-auto w-full max-w-[360px]'>
					<motion.div
						animate={
							invalidMoveId
								? { borderColor: '#ef4444', boxShadow: '2px 2px 0 #ef4444' }
								: { borderColor: '#171717', boxShadow: '4px 4px 0 #171717' }
						}
						aria-label='2048 board'
						className='relative aspect-square touch-none rounded-lg border-2 border-neutral-950 bg-neutral-950 p-2 shadow-[4px_4px_0_#171717] outline-none'
						onPointerCancel={() => {
							swipeStartRef.current = null;
						}}
						onPointerDown={event => {
							event.currentTarget.setPointerCapture(event.pointerId);
							swipeStartRef.current = { x: event.clientX, y: event.clientY };
						}}
						onPointerUp={event => finishSwipe(event.clientX, event.clientY)}
						role='application'
						tabIndex={0}
						transition={{ duration: 0.12, ease: 'easeOut' }}
					>
						<div className='pointer-events-none grid h-full grid-cols-4 grid-rows-4 gap-2'>
							{Array.from({ length: cellCount }, (_, index) => (
								<div
									className='min-h-0 min-w-0 rounded-lg border-2 border-neutral-950 bg-neutral-100 shadow-[inset_2px_2px_0_rgba(23,23,23,0.08)]'
									key={index}
								/>
							))}
						</div>
						<div className='pointer-events-none absolute inset-2 grid grid-cols-4 grid-rows-4 gap-2'>
							<AnimatePresence initial={false}>
								{visibleTiles.map(tile => (
									<TileView
										colorOptionNames={game.colorOptionNames}
										isMerge={mergeTileIds.has(tile.tile.id)}
										isMergingSource={mergeSourceIds.has(tile.tile.id)}
										isNew={newTileIds.has(tile.tile.id)}
										key={tile.tile.id}
										shouldAnimatePosition={tile.animates}
										{...tile}
									/>
								))}
							</AnimatePresence>
						</div>
						<MoveButton
							Icon={ArrowUp}
							direction='up'
							disabled={game.done || moving}
							onMove={applyMove}
							style={{ left: 'calc(50% - 11px)', top: '-11px' }}
						/>
						<MoveButton
							Icon={ArrowLeft}
							direction='left'
							disabled={game.done || moving}
							onMove={applyMove}
							style={{ left: '-11px', top: 'calc(50% - 11px)' }}
						/>
						<MoveButton
							Icon={ArrowRight}
							direction='right'
							disabled={game.done || moving}
							onMove={applyMove}
							style={{ right: '-11px', top: 'calc(50% - 11px)' }}
						/>
						<MoveButton
							Icon={ArrowDown}
							direction='down'
							disabled={game.done || moving}
							onMove={applyMove}
							style={{ bottom: '-11px', left: 'calc(50% - 11px)' }}
						/>
					</motion.div>
					<p className='mt-2 text-center text-xs font-black uppercase text-neutral-500'>
						{game.moves}/{maxMoves} moves
					</p>
				</div>
				{game.done ? (
					<div className='absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-white/94 p-5 text-neutral-950'>
						<div className='w-full max-w-xs space-y-4 text-center'>
							<p className='text-xs font-black uppercase text-emerald-700'>
								{game.endReason === 'full' ? 'you had more juice but you were full' : 'final board'}
							</p>
							<ScoreChips scores={scores} />
							<Button onClick={submitFinalScore} theme='endAction'>
								it all maths out
							</Button>
						</div>
					</div>
				) : null}
			</section>
		</div>
	);
}
