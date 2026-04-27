import type { ComponentType } from 'react';

export type SubmitScore = (score: number) => void;

export type QuizScreenProps<TConfig> = {
	screenNumber: number;
	screenCount: number;
	config: TConfig;
	submit: SubmitScore;
};

export type QuizDefinition = {
	id: string;
	title: string;
	tagline: string;
	screens: readonly unknown[];
	Screen: ComponentType<QuizScreenProps<unknown>>;
	score: (screenScores: readonly number[]) => number;
};

type QuizConfig<TScreenConfig> = {
	id: string;
	title: string;
	tagline: string;
	screens: readonly TScreenConfig[];
	Screen: ComponentType<QuizScreenProps<TScreenConfig>>;
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
		Screen: config.Screen as unknown as ComponentType<QuizScreenProps<unknown>>,
		score: config.score ?? averageScore,
	};
}
