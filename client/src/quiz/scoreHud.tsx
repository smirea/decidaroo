import { useEffect, useRef, useState } from 'react';
import { decidingOptions } from '../../../shared/constants.ts';
import { emptyOptionPoints, type OptionPoints } from './quizScreen.tsx';

export type ScoreDelta = {
	optionName: string;
	delta: number;
	scores: OptionPoints;
};

export type ScoreEffect = {
	id: number;
	optionName: string;
	delta: number;
};

function cloneScores(scores: OptionPoints) {
	return { ...scores };
}

export function addOptionScore(scores: OptionPoints, optionName: string, delta: number) {
	const nextScores = {
		...scores,
		[optionName]: (scores[optionName] ?? 0) + delta,
	};

	return {
		delta: { optionName, delta, scores: nextScores },
		scores: nextScores,
	};
}

export function scoreDeltasBetween(previousScores: OptionPoints, nextScores: OptionPoints) {
	return decidingOptions.reduce<ScoreDelta[]>((deltas, option) => {
		const delta = (nextScores[option.name] ?? 0) - (previousScores[option.name] ?? 0);
		if (delta !== 0) deltas.push({ optionName: option.name, delta, scores: nextScores });
		return deltas;
	}, []);
}

export function ScoreChips({ scores }: { scores: OptionPoints }) {
	return (
		<div className='grid grid-cols-2 gap-2'>
			{decidingOptions.map(option => (
				<div
					className='rounded-lg border-2 border-neutral-950 px-3 py-2 text-neutral-950 shadow-[3px_3px_0_#171717]'
					key={option.name}
					style={{ backgroundColor: option.color }}
				>
					<p className='truncate text-xs font-black uppercase'>{option.name}</p>
					<p className='text-2xl font-black leading-none'>{scores[option.name] ?? 0}</p>
				</div>
			))}
		</div>
	);
}

export function OptionScoreDisplays({ effects, scores }: { effects: ScoreEffect[]; scores: OptionPoints }) {
	return (
		<div className='flex flex-1 flex-wrap justify-end gap-2'>
			{decidingOptions.map(option => (
				<div className='relative' key={option.name}>
					<div
						aria-label={`${option.name} score ${scores[option.name] ?? 0}`}
						className='min-w-10 rounded-lg border-2 border-neutral-950 px-2 py-2 text-center text-xl font-black leading-none text-neutral-950 shadow-[3px_3px_0_#171717]'
						style={{ backgroundColor: option.color }}
					>
						{scores[option.name] ?? 0}
					</div>
					{effects
						.filter(effect => effect.optionName === option.name)
						.map(effect => (
							<div
								className={`score-delta-float absolute left-1/2 top-full mt-1 rounded border-2 border-neutral-950 px-2 py-1 text-sm font-black leading-none shadow-[2px_2px_0_#171717] ${
									effect.delta < 0 ? 'bg-red-500 text-white' : 'text-neutral-950'
								}`}
								key={effect.id}
								style={{ backgroundColor: effect.delta < 0 ? undefined : option.color }}
							>
								{effect.delta > 0 ? '+' : ''}
								{effect.delta}
							</div>
						))}
				</div>
			))}
		</div>
	);
}

export function CompactScoreHud({
	effects,
	remaining,
	scores,
}: {
	effects: ScoreEffect[];
	remaining: number;
	scores: OptionPoints;
}) {
	return (
		<div className='pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-start gap-2'>
			<div className='shrink-0 rounded-lg border-2 border-neutral-950 bg-white px-3 py-2 text-xl font-black leading-none text-neutral-950 shadow-[3px_3px_0_#171717]'>
				{remaining}
			</div>
			<OptionScoreDisplays effects={effects} scores={scores} />
		</div>
	);
}

export function useAnimatedScores(initialScores: OptionPoints = emptyOptionPoints()) {
	const [scores, setScoresState] = useState<OptionPoints>(() => cloneScores(initialScores));
	const [displayScores, setDisplayScores] = useState<OptionPoints>(() => cloneScores(initialScores));
	const [scoreEffects, setScoreEffects] = useState<ScoreEffect[]>([]);
	const effectIdRef = useRef(0);
	const scoreTimeoutsRef = useRef<number[]>([]);

	useEffect(() => () => clearScoreAnimationTimeouts(), []);

	function clearScoreAnimationTimeouts(resetVisibleEffects = false) {
		for (const timeout of scoreTimeoutsRef.current) window.clearTimeout(timeout);
		scoreTimeoutsRef.current = [];

		if (!resetVisibleEffects) return;

		setScoreEffects([]);
	}

	function scheduleScoreAnimation(callback: () => void, delay: number) {
		const timeout = window.setTimeout(() => {
			scoreTimeoutsRef.current = scoreTimeoutsRef.current.filter(item => item !== timeout);
			callback();
		}, delay);
		scoreTimeoutsRef.current.push(timeout);
	}

	function setAnimatedScores(nextScores: OptionPoints, scoreDeltas: ScoreDelta | ScoreDelta[] = []) {
		const deltas = Array.isArray(scoreDeltas) ? scoreDeltas : [scoreDeltas];
		const visibleDeltas = deltas.filter(delta => delta.delta !== 0);

		setScoresState(nextScores);
		setDisplayScores(nextScores);

		if (visibleDeltas.length === 0) return;

		for (const delta of visibleDeltas) {
			const effectId = effectIdRef.current + 1;
			effectIdRef.current = effectId;
			setScoreEffects(current => [...current, { id: effectId, optionName: delta.optionName, delta: delta.delta }]);
			scheduleScoreAnimation(() => {
				setScoreEffects(current => current.filter(effect => effect.id !== effectId));
			}, 760);
		}
	}

	return {
		clearScoreAnimationTimeouts,
		displayScores,
		scoreEffects,
		scores,
		setAnimatedScores,
	};
}
