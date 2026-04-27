import { quizScreen, type QuizScreenProps } from './quizScreen.tsx';

type ButtonOption = {
	label: string;
	score: number;
};

type ButtonScreenConfig = {
	title: string;
	prompt: string;
	options: readonly ButtonOption[];
};

function ButtonsScreen({ screenNumber, screenCount, config, submit }: QuizScreenProps<ButtonScreenConfig>) {
	return (
		<div className='space-y-5'>
			<div className='space-y-2'>
				<p className='text-xs font-bold uppercase text-emerald-700'>
					Button tribunal {screenNumber} of {screenCount}
				</p>
				<h2 className='text-2xl font-black leading-tight text-neutral-950'>{config.title}</h2>
				<p className='text-base leading-6 text-neutral-700'>{config.prompt}</p>
			</div>

			<div className='grid gap-3'>
				{config.options.map(option => (
					<button
						className='min-h-14 rounded-lg border-2 border-neutral-950 bg-white px-4 py-3 text-left text-base font-black text-neutral-950 shadow-[3px_3px_0_#171717] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#171717]'
						key={option.label}
						onClick={() => submit(option.score)}
						type='button'
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	);
}

export const buttonsQuiz = quizScreen<ButtonScreenConfig>({
	id: 'buttons',
	title: 'The Button Tribunal',
	tagline: 'Two taps to determine whether democracy was a mistake.',
	screens: [
		{
			title: 'Pick the current group energy.',
			prompt: 'No wrong answers, only documented nonsense.',
			options: [
				{ label: 'Everyone is weirdly reasonable', score: 30 },
				{ label: 'One friend has a spreadsheet', score: 64 },
				{ label: 'A coin flip would be too dignified', score: 92 },
			],
		},
		{
			title: 'What would be funniest right now?',
			prompt: 'The app is legally obligated to respect the bit.',
			options: [
				{ label: 'A careful pro/con list', score: 18 },
				{ label: 'A bracket with fake team names', score: 70 },
				{ label: 'Let fate press buttons with oven mitts', score: 99 },
			],
		},
	],
	Screen: ButtonsScreen,
});
