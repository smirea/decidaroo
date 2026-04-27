import { useMemo, useState } from 'react';
import { buttonsQuiz } from './buttons.tsx';
import { randomQuiz } from './random.tsx';
import { clampScore, averageScore } from './quizScreen.tsx';
import { sliderQuiz } from './slider.tsx';

const quizzes = [sliderQuiz, buttonsQuiz, randomQuiz] as const;

type ScreenResult = {
	title: string;
	score: number;
};

type QuizResult = {
	id: string;
	title: string;
	score: number;
	screens: ScreenResult[];
};

function screenTitle(screen: unknown, index: number) {
	if (typeof screen !== 'object' || screen === null) return `Screen ${index + 1}`;

	const title = (screen as { title?: unknown }).title;
	return typeof title === 'string' ? title : `Screen ${index + 1}`;
}

function scoreMood(score: number) {
	if (score >= 85) return 'reckless masterpiece';
	if (score >= 65) return 'confidently silly';
	if (score >= 40) return 'medium shrug';
	return 'suspiciously responsible';
}

export function QuizPage() {
	const [quizIndex, setQuizIndex] = useState(0);
	const [screenIndex, setScreenIndex] = useState(0);
	const [screenScores, setScreenScores] = useState<number[]>([]);
	const [results, setResults] = useState<QuizResult[]>([]);

	const totalScreens = useMemo(() => quizzes.reduce((total, quiz) => total + quiz.screens.length, 0), []);
	const completedScreens = results.reduce((total, result) => total + result.screens.length, 0) + screenIndex;
	const finalScore = averageScore(results.map(result => result.score));
	const isDone = results.length === quizzes.length;
	const progress = isDone ? 100 : Math.round((completedScreens / totalScreens) * 100);
	const currentQuiz = quizzes[quizIndex];
	const currentScreen = currentQuiz?.screens[screenIndex];

	function restart() {
		setQuizIndex(0);
		setScreenIndex(0);
		setScreenScores([]);
		setResults([]);
	}

	function submit(rawScore: number) {
		if (!currentQuiz) return;

		const nextScores = [...screenScores, clampScore(rawScore)];

		if (screenIndex < currentQuiz.screens.length - 1) {
			setScreenScores(nextScores);
			setScreenIndex(current => current + 1);
			return;
		}

		const nextResult: QuizResult = {
			id: currentQuiz.id,
			title: currentQuiz.title,
			score: currentQuiz.score(nextScores),
			screens: nextScores.map((score, index) => ({
				title: screenTitle(currentQuiz.screens[index], index),
				score,
			})),
		};

		setResults(current => [...current, nextResult]);
		setScreenScores([]);
		setScreenIndex(0);
		setQuizIndex(current => current + 1);
	}

	return (
		<main className='min-h-screen bg-neutral-100 px-4 py-5 text-neutral-950 sm:py-8'>
			<section className='mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-md flex-col gap-4'>
				<header className='space-y-3'>
					<div className='flex items-center justify-between gap-3'>
						<div>
							<p className='text-xs font-bold uppercase text-neutral-500'>Decidaroo</p>
							<h1 className='text-3xl font-black leading-none text-neutral-950'>Decision Tool Decider</h1>
						</div>
						<div className='rounded-lg border-2 border-neutral-950 bg-sky-300 px-3 py-2 text-center shadow-[3px_3px_0_#171717]'>
							<p className='text-[10px] font-bold uppercase'>score</p>
							<p className='text-2xl font-black leading-none'>{isDone ? finalScore : '--'}</p>
						</div>
					</div>
					<div className='h-3 overflow-hidden rounded-lg border-2 border-neutral-950 bg-white'>
						<div className='h-full bg-emerald-500 transition-all' style={{ width: `${progress}%` }} />
					</div>
				</header>

				{isDone ? (
					<section className='flex flex-1 flex-col gap-5 rounded-lg border-2 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#171717]'>
						<div className='space-y-2'>
							<p className='text-xs font-bold uppercase text-fuchsia-700'>final verdict</p>
							<h2 className='text-4xl font-black leading-none'>{finalScore}</h2>
							<p className='text-lg font-bold text-neutral-700'>{scoreMood(finalScore)}</p>
						</div>

						<div className='space-y-3'>
							{results.map(result => (
								<div className='rounded-lg border border-neutral-200 bg-neutral-50 p-3' key={result.id}>
									<div className='flex items-start justify-between gap-3'>
										<div>
											<h3 className='font-black'>{result.title}</h3>
											<p className='text-sm font-semibold text-neutral-500'>{scoreMood(result.score)}</p>
										</div>
										<p className='text-2xl font-black'>{result.score}</p>
									</div>
									<div className='mt-3 space-y-2'>
										{result.screens.map((screen, index) => (
											<div
												className='flex items-center justify-between gap-3 text-sm'
												key={`${result.id}-${screen.title}`}
											>
												<span className='font-semibold text-neutral-700'>
													{index + 1}. {screen.title}
												</span>
												<span className='font-black'>{screen.score}</span>
											</div>
										))}
									</div>
								</div>
							))}
						</div>

						<button
							className='mt-auto min-h-12 rounded-lg bg-neutral-950 px-4 py-3 text-base font-black text-white active:translate-y-px'
							onClick={restart}
							type='button'
						>
							Run the nonsense again
						</button>
					</section>
				) : currentQuiz && currentScreen ? (
					<section className='flex flex-1 flex-col gap-4 rounded-lg border-2 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#171717]'>
						<div className='flex items-start justify-between gap-4 border-b-2 border-neutral-950 pb-4'>
							<div>
								<p className='text-xs font-bold uppercase text-neutral-500'>
									Game {quizIndex + 1} of {quizzes.length}
								</p>
								<h2 className='text-xl font-black leading-tight'>{currentQuiz.title}</h2>
								<p className='mt-1 text-sm font-semibold text-neutral-600'>{currentQuiz.tagline}</p>
							</div>
							<p className='rounded-lg bg-lime-300 px-2 py-1 text-sm font-black'>
								{screenIndex + 1}/{currentQuiz.screens.length}
							</p>
						</div>

						<div className='flex flex-1 items-center'>
							<div className='w-full'>
								<currentQuiz.Screen
									config={currentScreen}
									key={`${currentQuiz.id}-${screenIndex}`}
									screenCount={currentQuiz.screens.length}
									screenNumber={screenIndex + 1}
									submit={submit}
								/>
							</div>
						</div>
					</section>
				) : null}
			</section>
		</main>
	);
}
