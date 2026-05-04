export type OptionPoints = Record<string, number>;

export type ScreenResult = {
	title: string;
	content?: string;
	points: OptionPoints;
};

export type QuizResult = {
	id: string;
	title: string;
	points: OptionPoints;
	screens: ScreenResult[];
	completedScreenCount: number;
};

export type PlayerProgress = {
	quizIndex: number;
	screenIndex: number;
	screenScores: OptionPoints[];
	results: QuizResult[];
};

export type GamePlayer = PlayerProgress & {
	endScreenAt?: string;
	name: string;
	score: OptionPoints;
	updatedAt: string;
};

export type GameState = {
	startedAt: string;
	updatedAt: string;
	players: GamePlayer[];
	kickVotes: Record<string, string[]>;
};

export type GameResponse = {
	game: GameState;
	player: GamePlayer | null;
};

export type GameAction =
	| { type: 'join'; name: string }
	| { type: 'kick'; name: string; targetName: string }
	| { type: 'ready'; name: string }
	| { type: 'restart' }
	| { type: 'save'; name: string; progress: PlayerProgress; score: OptionPoints };
