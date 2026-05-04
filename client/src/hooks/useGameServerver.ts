import { useCallback, useEffect, useState } from 'react';
import type { GameAction, GamePlayer, GameResponse, GameState } from '../../../shared/game.ts';

const gameUrl = '/api/game';

export function useGameServer(enabled = true) {
	const [game, setGame] = useState<GameState | null>(null);

	const reloadGame = useCallback(async (): Promise<GameState | null> => {
		if (!enabled) return null;

		try {
			const response = await fetch(gameUrl, {
				headers: { Accept: 'application/json' },
			});
			const payload = (await response.json()) as GameResponse;

			setGame(payload.game);
			return payload.game;
		} catch {
			return null;
		}
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;

		const events = new EventSource(`${gameUrl}?stream=1`);
		const updateGame = (event: Event) => {
			try {
				setGame(JSON.parse((event as MessageEvent<string>).data) as GameState);
			} catch {
				void reloadGame();
			}
		};

		events.addEventListener('game', updateGame);
		events.onmessage = updateGame;
		events.onerror = () => void reloadGame();
		return () => events.close();
	}, [enabled, reloadGame]);

	const reloadPlayer = useCallback(
		async (name: string): Promise<GamePlayer | null> => {
			if (!enabled) return null;

			try {
				const response = await fetch(`${gameUrl}?player=${encodeURIComponent(name)}`, {
					headers: { Accept: 'application/json' },
				});
				const payload = (await response.json()) as GameResponse;

				setGame(payload.game);
				return payload.player;
			} catch {
				return null;
			}
		},
		[enabled],
	);

	const sendAction = useCallback(
		async (action: GameAction): Promise<GamePlayer | null> => {
			if (!enabled) return null;

			try {
				const response = await fetch(gameUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(action),
				});
				const payload = (await response.json()) as GameResponse;

				setGame(payload.game);
				return payload.player;
			} catch {
				return null;
			}
		},
		[enabled],
	);

	const restartGame = useCallback(async (): Promise<GameState | null> => {
		if (!enabled) return null;

		try {
			const response = await fetch(gameUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'restart' } satisfies GameAction),
			});
			const payload = (await response.json()) as GameResponse;

			setGame(payload.game);
			return payload.game;
		} catch {
			return null;
		}
	}, [enabled]);

	return { game, reloadGame, reloadPlayer, restartGame, sendAction };
}
