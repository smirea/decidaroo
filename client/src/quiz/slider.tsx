import { useState } from 'react';
import { quizScreen, type QuizScreenProps } from './quizScreen.tsx';

type SliderScreenConfig = {
	title: string;
	prompt: string;
	leftLabel: string;
	rightLabel: string;
	defaultValue: number;
};

function SliderScreen({ screenNumber, screenCount, config, submit }: QuizScreenProps<SliderScreenConfig>) {
	const [value, setValue] = useState(config.defaultValue);

	return (
		<div className='space-y-6'>
			<div className='space-y-2'>
				<p className='text-xs font-bold uppercase text-pink-700'>
					Slider round {screenNumber} of {screenCount}
				</p>
				<h2 className='text-2xl font-black leading-tight text-neutral-950'>{config.title}</h2>
				<p className='text-base leading-6 text-neutral-700'>{config.prompt}</p>
			</div>

			<div className='space-y-3'>
				<div className='flex items-end justify-between gap-3 text-sm font-semibold text-neutral-600'>
					<span>{config.leftLabel}</span>
					<span className='rounded-lg bg-neutral-950 px-3 py-1 text-lg font-black text-white'>{value}</span>
					<span className='text-right'>{config.rightLabel}</span>
				</div>
				<input
					aria-label={config.title}
					className='h-3 w-full accent-pink-600'
					max={100}
					min={0}
					onChange={event => setValue(Number(event.target.value))}
					type='range'
					value={value}
				/>
			</div>

			<button
				className='min-h-12 w-full rounded-lg bg-pink-600 px-4 py-3 text-base font-black text-white shadow-sm active:translate-y-px'
				onClick={() => submit(value)}
				type='button'
			>
				Bottle this opinion
			</button>
		</div>
	);
}

export const sliderQuiz = quizScreen<SliderScreenConfig>({
	id: 'slider',
	title: 'The Wobbly Slider',
	tagline: 'Three tiny judgments wearing a trench coat.',
	screens: [
		{
			title: 'How spicy is the decision?',
			prompt: 'Drag toward chaos if everyone already has a dramatic opinion.',
			leftLabel: 'mild',
			rightLabel: 'chaos',
			defaultValue: 48,
		},
		{
			title: 'How much do you trust the group chat?',
			prompt: 'A high score means the chat might actually contain wisdom today.',
			leftLabel: 'nope',
			rightLabel: 'prophecy',
			defaultValue: 62,
		},
		{
			title: 'How hungry is everyone?',
			prompt: 'Hunger turns ordinary choices into civic emergencies.',
			leftLabel: 'fine',
			rightLabel: 'feral',
			defaultValue: 75,
		},
	],
	Screen: SliderScreen,
});
