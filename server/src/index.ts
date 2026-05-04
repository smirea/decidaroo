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

const gameState: GameState = {
	startedAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	players: [],
};

function emptyScore(): OptionPoints {
	return Object.fromEntries(decidingOptions.map(option => [option.name, 0]));
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

	player.updatedAt = now;
	gameState.updatedAt = now;
	return player;
}

const server = Bun.serve({
	development: true,
	port: apiPort,
	async fetch(request) {
		const url = new URL(request.url);

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

			broadcastGame();
			return Response.json(gameResponse(player?.name ?? action.name));
		}

		return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
	},
});

console.log('Server running at:', server.url);
