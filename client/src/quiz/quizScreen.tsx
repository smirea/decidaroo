import type { ComponentType, LazyExoticComponent } from 'react';

export type SubmitScore = (score: number) => void;

export type QuizScreenProps<TConfig> = {
	screenNumber: number;
	screenCount: number;
	config: TConfig;
	submit: SubmitScore;
};

type ScreenComponent<TConfig> =
	| ComponentType<QuizScreenProps<TConfig>>
	| LazyExoticComponent<ComponentType<QuizScreenProps<TConfig>>>;

export type QuizDefinition = {
	id: string;
	title: string;
	tagline: string;
	screens: readonly unknown[];
	Screen: ScreenComponent<unknown>;
	score: (screenScores: readonly number[]) => number;
};

type QuizConfig<TScreenConfig> = {
	id: string;
	title: string;
	tagline: string;
	screens: readonly TScreenConfig[];
	Screen: ScreenComponent<TScreenConfig>;
	score?: (screenScores: readonly number[]) => number;
};

export function clampScore(score: number) {
	return Math.max(0, Math.min(100, Math.round(score)));
}

export function averageScore(scores: readonly number[]) {
	if (scores.length === 0) return 0;

	return clampScore(scores.reduce((total, score) => total + score, 0) / scores.length);
}

export function quizScreen<TScreenConfig>(config: QuizConfig<TScreenConfig>): QuizDefinition {
	return {
		id: config.id,
		title: config.title,
		tagline: config.tagline,
		screens: config.screens,
		Screen: config.Screen as unknown as ScreenComponent<unknown>,
		score: config.score ?? averageScore,
	};
}
