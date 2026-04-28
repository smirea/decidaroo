import type { ComponentType, LazyExoticComponent } from 'react';
import { decidingOptions } from '../../../shared/constants.ts';

export type OptionPoints = Record<string, number>;
export type SubmitScore = (score: Partial<OptionPoints>) => void;

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
	score: (screenScores: readonly OptionPoints[]) => OptionPoints;
};

type QuizConfig<TScreenConfig> = {
	id: string;
	title: string;
	tagline: string;
	screens: readonly TScreenConfig[];
	Screen: ScreenComponent<TScreenConfig>;
	score?: (screenScores: readonly OptionPoints[]) => OptionPoints;
};

function roundPoints(points: number) {
	return Math.round(points);
}

export function emptyOptionPoints() {
	return Object.fromEntries(decidingOptions.map(option => [option.name, 0])) as OptionPoints;
}

export function pointsForOption(optionName: string, points: number) {
	return { ...emptyOptionPoints(), [optionName]: roundPoints(points) };
}

export function scoreInputToPoints(score: Partial<OptionPoints>) {
	const points = emptyOptionPoints();

	for (const option of decidingOptions) points[option.name] = roundPoints(score[option.name] ?? 0);

	return points;
}

export function sumOptionPoints(scores: readonly OptionPoints[]) {
	const total = emptyOptionPoints();

	for (const score of scores) {
		for (const option of decidingOptions) total[option.name] += score[option.name] ?? 0;
	}

	return total;
}

export function quizScreen<TScreenConfig>(config: QuizConfig<TScreenConfig>): QuizDefinition {
	return {
		id: config.id,
		title: config.title,
		tagline: config.tagline,
		screens: config.screens,
		Screen: config.Screen as unknown as ScreenComponent<unknown>,
		score: config.score ?? sumOptionPoints,
	};
}
