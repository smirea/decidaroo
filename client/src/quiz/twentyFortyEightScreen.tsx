import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from '@phosphor-icons/react';
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
	optionName: string;
	value: number;
};

type GameState = {
	board: Board;
	done: boolean;
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
type AnimatedTile = PositionedTile & {
	animationId: number;
};
type MovePlan = {
	board: Board;
	changed: boolean;
	mergeTiles: PositionedTile[];
	slideTiles: PositionedTile[];
	zeroTiles: PositionedTile[];
};

const boardSize = 4;
const cellCount = boardSize * boardSize;
const maxMoves = 20;
const startValues = [-1, 1, 2] as const;
const mergeAnimationMs = 170;
const slideAnimationMs = 240;
const swipeThreshold = 36;

function randomItem<T>(items: readonly T[]) {
	return items[Math.floor(Math.random() * items.length)] ?? items[0];
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

function cloneBoard(board: Board) {
	return board.slice();
}

function emptyIndexes(board: Board) {
	return board.reduce<number[]>((indexes, tile, index) => {
		if (!tile || tile.value === 0) indexes.push(index);
		return indexes;
	}, []);
}

function spawnTiles(board: Board, nextTileId: number) {
	const next = cloneBoard(board);
	let id = nextTileId;
	const newTileIds: number[] = [];

	for (const option of decidingOptions) {
		const empties = emptyIndexes(next);
		const index = randomItem(empties);
		if (index === undefined) break;

		next[index] = {
			id,
			optionName: option.name,
			value: randomItem(startValues) ?? 1,
		};
		newTileIds.push(id);
		id += 1;
	}

	return { board: next, newTileIds, nextTileId: id };
}

function createInitialGame(): GameState {
	const seeded = spawnTiles(emptyBoard(), 1);

	return {
		board: seeded.board,
		done: false,
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
		if (tile && tile.value !== 0) items.push({ sourceIndex: sourceIndexes[index], tile });
		return items;
	}, []);
	const next: Array<Tile | null> = [];
	const mergeTiles: PositionedTile[] = [];
	const slideTiles: PositionedTile[] = [];
	const zeroTiles: PositionedTile[] = [];

	for (let index = 0; index < tiles.length; index += 1) {
		const item = tiles[index];
		const nextItem = tiles[index + 1];
		const targetIndex = targetIndexes[next.length];
		const targetPosition = boardPosition(targetIndex);

		slideTiles.push({ tile: item.tile, ...targetPosition });

		if (nextItem && item.tile.optionName === nextItem.tile.optionName) {
			slideTiles.push({ tile: nextItem.tile, ...targetPosition });
			const value = item.tile.value + nextItem.tile.value;
			if (value !== 0) {
				const mergedTile = { ...item.tile, value };
				next.push(mergedTile);
				mergeTiles.push({ tile: mergedTile, ...targetPosition });
			} else {
				zeroTiles.push({ tile: { ...item.tile, value }, ...targetPosition });
			}
			index += 1;
			continue;
		}

		next.push(item.tile);
	}

	while (next.length < boardSize) next.push(null);

	return { line: next, mergeTiles, slideTiles, zeroTiles };
}

function sameTile(left: Tile | null, right: Tile | null) {
	if (!left || !right) return left === right;
	return left.id === right.id && left.optionName === right.optionName && left.value === right.value;
}

function sameBoard(left: Board, right: Board) {
	return left.every((tile, index) => sameTile(tile, right[index]));
}

function moveBoard(board: Board, direction: Direction): MovePlan {
	const next = emptyBoard();
	const mergeTiles: PositionedTile[] = [];
	const slideTiles: PositionedTile[] = [];
	const zeroTiles: PositionedTile[] = [];

	for (let line = 0; line < boardSize; line += 1) {
		const indexes = lineIndexes(direction, line);
		const moved = slideLine(
			indexes.map(index => board[index]),
			indexes,
			indexes,
		);
		mergeTiles.push(...moved.mergeTiles);
		slideTiles.push(...moved.slideTiles);
		zeroTiles.push(...moved.zeroTiles);

		for (let index = 0; index < indexes.length; index += 1) next[indexes[index]] = moved.line[index];
	}

	return { board: next, changed: !sameBoard(board, next), mergeTiles, slideTiles, zeroTiles };
}

function hasAnyLegalMove(board: Board) {
	if (board.some(tile => tile === null || tile.value === 0)) return true;

	for (let row = 0; row < boardSize; row += 1) {
		for (let col = 0; col < boardSize; col += 1) {
			const tile = board[boardIndex(row, col)];
			const right = col < boardSize - 1 ? board[boardIndex(row, col + 1)] : null;
			const down = row < boardSize - 1 ? board[boardIndex(row + 1, col)] : null;

			if ((right && tile?.optionName === right.optionName) || (down && tile?.optionName === down.optionName))
				return true;
		}
	}

	return false;
}

function boardScores(board: Board) {
	const scores = emptyOptionPoints();

	for (const tile of board) {
		if (!tile || tile.value === 0) continue;
		scores[tile.optionName] = (scores[tile.optionName] ?? 0) + tile.value;
	}

	return scores;
}

function positionedTiles(board: Board) {
	return board.reduce<PositionedTile[]>((tiles, tile, index) => {
		if (!tile || tile.value === 0) return tiles;

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

function tileBackgroundColor(color: string, value: number) {
	if (Math.abs(value) > 2) return color;

	const { r, g, b } = hexToRgb(color);
	return `rgba(${r}, ${g}, ${b}, 0.68)`;
}

function tilePositionStyle(row: number, col: number) {
	const tileSize = 'calc((100% - 1.5rem) / 4)';

	return {
		height: tileSize,
		transform: `translate(${col * 100}%, ${row * 100}%) translate(${col * 0.5}rem, ${row * 0.5}rem)`,
		width: tileSize,
	} satisfies CSSProperties;
}

function TileView({
	col,
	isMerge,
	isNew,
	isZero,
	row,
	tile,
}: PositionedTile & { isMerge?: boolean; isNew?: boolean; isZero?: boolean }) {
	const option = optionForName(tile.optionName);
	const strongTile = Math.abs(tile.value) > 2;

	return (
		<div
			aria-label={`${option.name} ${valueLabel(tile.value)}`}
			className={`twenty-forty-eight-tile absolute left-0 top-0 flex min-w-0 select-none items-center justify-center rounded-md border-2 border-neutral-950 px-1 text-center text-2xl font-black leading-none text-neutral-950 sm:text-3xl ${strongTile ? 'shadow-[3px_3px_0_#171717]' : 'shadow-[1px_1px_0_rgba(23,23,23,0.72)]'} ${isMerge ? 'twenty-forty-eight-tile-merge' : ''} ${isNew ? 'twenty-forty-eight-tile-new' : ''} ${isZero ? 'twenty-forty-eight-tile-zero' : ''}`}
			style={{ ...tilePositionStyle(row, col), backgroundColor: tileBackgroundColor(option.color, tile.value) }}
		>
			{valueLabel(tile.value)}
		</div>
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
	const [mergeTileIds, setMergeTileIds] = useState<Set<number>>(() => new Set());
	const [moving, setMoving] = useState(false);
	const [slideTiles, setSlideTiles] = useState<PositionedTile[] | null>(null);
	const [zeroTiles, setZeroTiles] = useState<AnimatedTile[]>([]);
	const gameRef = useRef(game);
	const movingRef = useRef(false);
	const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
	const mergeTimeoutRef = useRef<number | null>(null);
	const submittedRef = useRef(false);
	const spawnTimeoutRef = useRef<number | null>(null);
	const zeroAnimationIdRef = useRef(1);
	const zeroAnimationTimeoutRef = useRef<number | null>(null);
	const scores = useMemo(() => boardScores(game.board), [game.board]);
	const tiles = useMemo(() => positionedTiles(game.board), [game.board]);
	const visibleTiles = slideTiles ?? tiles;
	const newTileIds = useMemo(() => new Set(game.newTileIds), [game.newTileIds]);

	const applyMove = useCallback((direction: Direction) => {
		const current = gameRef.current;
		if (current.done || movingRef.current) return;

		const moved = moveBoard(current.board, direction);
		if (!moved.changed) {
			setInvalidMoveId(currentId => currentId + 1);
			return;
		}

		const moves = current.moves + 1;
		const sliding = {
			board: current.board,
			done: false,
			moves,
			newTileIds: [],
			nextTileId: current.nextTileId,
		};

		movingRef.current = true;
		gameRef.current = sliding;
		setMergeTileIds(new Set());
		setMoving(true);
		setSlideTiles(moved.slideTiles);
		if (zeroAnimationTimeoutRef.current) window.clearTimeout(zeroAnimationTimeoutRef.current);
		setZeroTiles([]);
		setGame(sliding);

		if (spawnTimeoutRef.current) window.clearTimeout(spawnTimeoutRef.current);
		if (mergeTimeoutRef.current) window.clearTimeout(mergeTimeoutRef.current);
		mergeTimeoutRef.current = window.setTimeout(() => {
			const merged = {
				board: moved.board,
				done: false,
				moves,
				newTileIds: [],
				nextTileId: current.nextTileId,
			};
			const zeroAnimations = moved.zeroTiles.map(tile => ({ ...tile, animationId: zeroAnimationIdRef.current++ }));

			gameRef.current = merged;
			setGame(merged);
			setSlideTiles(null);
			setMergeTileIds(new Set(moved.mergeTiles.map(tile => tile.tile.id)));
			setZeroTiles(zeroAnimations);
			if (zeroAnimations.length) zeroAnimationTimeoutRef.current = window.setTimeout(() => setZeroTiles([]), 280);
			mergeTimeoutRef.current = null;

			spawnTimeoutRef.current = window.setTimeout(() => {
				const spawned = spawnTiles(moved.board, current.nextTileId);
				const next = {
					board: spawned.board,
					done: moves >= maxMoves || !hasAnyLegalMove(spawned.board),
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
			}, mergeAnimationMs);
		}, slideAnimationMs);
	}, []);

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
			};
			const direction = keyDirections[event.key];
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
			if (zeroAnimationTimeoutRef.current) window.clearTimeout(zeroAnimationTimeoutRef.current);
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
		submit(boardScores(game.board));
	}

	return (
		<div className='flex h-full min-h-0 w-full items-center justify-center px-1 py-3'>
			<section className='relative flex max-h-full w-full flex-col gap-3 rounded-lg border-2 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#171717]'>
				<div className='flex justify-end'>
					<ScoreChips scores={scores} />
				</div>

				<div className='mx-auto w-full max-w-[360px]'>
					<div
						aria-label='2048 board'
						className={`relative aspect-square touch-none rounded-lg border-2 border-neutral-950 bg-neutral-950 p-2 shadow-[4px_4px_0_#171717] outline-none ${invalidMoveId ? 'twenty-forty-eight-board-invalid' : ''}`}
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
					>
						<div className='pointer-events-none grid h-full grid-cols-4 gap-2'>
							{Array.from({ length: cellCount }, (_, index) => (
								<div
									className='aspect-square min-w-0 rounded-lg border-2 border-neutral-950 bg-neutral-100 shadow-[inset_2px_2px_0_rgba(23,23,23,0.08)]'
									key={index}
								/>
							))}
						</div>
						<div className='pointer-events-none absolute inset-2'>
							{visibleTiles.map(tile => (
								<TileView
									isMerge={mergeTileIds.has(tile.tile.id)}
									isNew={newTileIds.has(tile.tile.id)}
									key={tile.tile.id}
									{...tile}
								/>
							))}
							{zeroTiles.map(tile => (
								<TileView isZero key={tile.animationId} {...tile} />
							))}
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
					</div>
					<p className='mt-2 text-center text-xs font-black uppercase text-neutral-500'>
						{game.moves}/{maxMoves} moves
					</p>
				</div>
				{game.done ? (
					<div className='absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-white/94 p-5 text-neutral-950'>
						<div className='w-full max-w-xs space-y-4 text-center'>
							<p className='text-xs font-black uppercase text-emerald-700'>final board</p>
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
