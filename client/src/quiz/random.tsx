import { useState } from 'react';
import { quizScreen, type QuizScreenProps } from './quizScreen.tsx';

type RandomScreenConfig = {
	title: string;
	prompt: string;
	maxRerolls: number;
};

function rollScore() {
	return Math.floor(Math.random() * 101);
}

function RandomScreen({ screenNumber, screenCount, config, submit }: QuizScreenProps<RandomScreenConfig>) {
	const [value, setValue] = useState(rollScore);
	const [rerolls, setRerolls] = useState(0);
	const rerollsLeft = config.maxRerolls - rerolls;

	return (
		<div className='space-y-6'>
			<div className='space-y-2'>
				<p className='text-xs font-bold uppercase text-amber-700'>
					RNG courtroom {screenNumber} of {screenCount}
				</p>
				<h2 className='text-2xl font-black leading-tight text-neutral-950'>{config.title}</h2>
				<p className='text-base leading-6 text-neutral-700'>{config.prompt}</p>
			</div>

			<div className='rounded-lg border-2 border-neutral-950 bg-amber-300 p-5 text-center shadow-[4px_4px_0_#171717]'>
				<p className='text-sm font-bold uppercase text-neutral-700'>suspicious number</p>
				<p className='text-7xl font-black leading-none text-neutral-950'>{value}</p>
			</div>

			<div className='grid grid-cols-2 gap-3'>
				<button
					className='min-h-12 rounded-lg border-2 border-neutral-950 bg-white px-3 py-3 text-sm font-black text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400'
					disabled={rerollsLeft <= 0}
					onClick={() => {
						setValue(rollScore());
						setRerolls(current => current + 1);
					}}
					type='button'
				>
					Reroll ({rerollsLeft})
				</button>
				<button
					className='min-h-12 rounded-lg bg-neutral-950 px-3 py-3 text-sm font-black text-white active:translate-y-px'
					onClick={() => submit(value)}
					type='button'
				>
					Accept fate
				</button>
			</div>
		</div>
	);
}

export const randomQuiz = quizScreen<RandomScreenConfig>({
	id: 'random',
	title: 'The Tiny Chaos Engine',
	tagline: 'One number, three chances to be less cursed.',
	screens: [
		{
			title: 'Summon a number.',
			prompt: 'Keep it when it feels official enough.',
			maxRerolls: 3,
		},
	],
	Screen: RandomScreen,
});
