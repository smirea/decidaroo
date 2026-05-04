import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from 'node:process';
import { decidingOptions } from '../../shared/constants.ts';
import type {
	GameAction,
	GamePlayer,
	GameResponse,
	GameState,
	OptionPoints,
	PlayerProgress,
} from '../../shared/game.ts';

if (!env.API_PORT) throw new Error('API_PORT is not set');

const apiPort = Number(env.API_PORT);
if (Number.isNaN(apiPort)) throw new Error('API_PORT must be a valid number');

const encoder = new TextEncoder();
const gameClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const rootDirectory = join(import.meta.dir, '..', '..');
const gamesDirectory = env.GAMES_DIR ?? join(rootDirectory, '.games');

let gameState = await loadInitialGame();
let activeGameDay = gameDayFromIso(gameState.startedAt) ?? gameDay();

await saveGame();

function emptyScore(): OptionPoints {
	return Object.fromEntries(decidingOptions.map(option => [option.name, 0]));
}

function gameDay(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

function gameDayFromIso(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;

	return gameDay(date);
}

function newGameState(now = new Date()): GameState {
	const timestamp = now.toISOString();

	return {
		startedAt: timestamp,
		updatedAt: timestamp,
		kickVotes: {},
		players: [],
	};
}

function gameFilePath(game = gameState) {
	return join(gamesDirectory, `${gameDayFromIso(game.startedAt) ?? gameDay()}.json`);
}

async function readGame(filePath: string) {
	try {
		return normalizeGame(JSON.parse(await readFile(filePath, 'utf8')) as GameState);
	} catch {
		return null;
	}
}

function normalizeGame(game: GameState): GameState {
	return {
		...game,
		kickVotes: game.kickVotes ?? {},
	};
}

async function loadInitialGame() {
	await mkdir(gamesDirectory, { recursive: true });

	const today = gameDay();
	const gameFiles = (await readdir(gamesDirectory))
		.filter(file => file.endsWith('.json'))
		.sort()
		.reverse();

	for (const gameFile of gameFiles) {
		const game = await readGame(join(gamesDirectory, gameFile));
		if (!game) continue;
		if (gameDayFromIso(game.startedAt) === today) return game;

		break;
	}

	return newGameState();
}

async function saveGame() {
	await mkdir(gamesDirectory, { recursive: true });
	await writeFile(gameFilePath(), `${JSON.stringify(gameState, null, 2)}\n`);
}

async function ensureTodayGame() {
	const today = gameDay();
	if (activeGameDay === today) return false;

	gameState = newGameState();
	activeGameDay = today;
	await saveGame();

	return true;
}

function emptyProgress(): PlayerProgress {
	return {
		quizIndex: 0,
		screenIndex: 0,
		screenScores: [],
		results: [],
	};
}

function findPlayer(name: string) {
	return gameState.players.find(player => player.name === name) ?? null;
}

function addPlayer(name: string): GamePlayer {
	const now = new Date().toISOString();
	const player = {
		...emptyProgress(),
		name,
		score: emptyScore(),
		updatedAt: now,
	};

	gameState.players.push(player);
	gameState.updatedAt = now;
	return player;
}

function ensurePlayer(name: string) {
	return findPlayer(name) ?? addPlayer(name);
}

function gameResponse(name: string | null): GameResponse {
	return {
		game: gameState,
		player: name ? findPlayer(name) : null,
	};
}

function eventChunk() {
	return encoder.encode(`event: game\ndata: ${JSON.stringify(gameState)}\n\n`);
}

function broadcastGame() {
	const chunk = eventChunk();

	for (const client of gameClients) {
		try {
			client.enqueue(chunk);
		} catch {
			gameClients.delete(client);
		}
	}
}

function streamGame() {
	let gameClient: ReadableStreamDefaultController<Uint8Array> | null = null;

	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				gameClient = controller;
				gameClients.add(controller);
				controller.enqueue(encoder.encode('retry: 1000\n\n'));
				controller.enqueue(eventChunk());
			},
			cancel() {
				if (gameClient) gameClients.delete(gameClient);
			},
		}),
		{
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		},
	);
}

function reduceGame(action: GameAction) {
	const name = action.name.trim();
	if (!name) return null;

	const player = ensurePlayer(name);
	const now = new Date().toISOString();

	if (action.type === 'save') {
		player.quizIndex = action.progress.quizIndex;
		player.screenIndex = action.progress.screenIndex;
		player.screenScores = action.progress.screenScores;
		player.results = action.progress.results;
		player.score = action.score;
	}

	if (action.type === 'kick') {
		const targetName = action.targetName.trim();
		if (!targetName) return null;

		gameState.kickVotes[targetName] = [...new Set([...(gameState.kickVotes[targetName] ?? []), name])];
	}

	player.updatedAt = now;
	gameState.updatedAt = now;
	return player;
}

setInterval(() => {
	void ensureTodayGame()
		.then(changed => {
			if (changed) broadcastGame();
		})
		.catch(error => console.error('Failed to start daily game', error));
}, 60_000);

const server = Bun.serve({
	development: true,
	port: apiPort,
	async fetch(request) {
		const url = new URL(request.url);
		const gameChanged = await ensureTodayGame();
		if (gameChanged) broadcastGame();

		if (url.pathname === '/status') return Response.json({ ok: true });
		if (url.pathname !== '/game') return Response.json({ ok: false, error: 'Not found' }, { status: 404 });

		if (request.method === 'GET') {
			if (url.searchParams.get('stream') === '1' || request.headers.get('accept')?.includes('text/event-stream')) {
				return streamGame();
			}

			return Response.json(gameResponse(url.searchParams.get('player')));
		}

		if (request.method === 'POST') {
			const action = (await request.json()) as GameAction;
			const player = reduceGame(action);

			if (player) await saveGame();
			broadcastGame();
			return Response.json(gameResponse(player?.name ?? action.name));
		}

		return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
	},
});

console.log('Server running at:', server.url);
