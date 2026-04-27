import { useState } from 'react';
import { clampScore, averageScore } from './quizScreen.tsx';
import { tinderSwipeQuiz } from './tinderSwipe.tsx';

const quizzes = [tinderSwipeQuiz] as const;

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

	const finalScore = averageScore(results.map(result => result.score));
	const isDone = results.length === quizzes.length;
	const currentQuiz = quizzes[quizIndex];
	const currentScreen = currentQuiz?.screens[screenIndex];
	const totalScreens = quizzes.reduce((total, quiz) => total + quiz.screens.length, 0);
	const completedScreens = results.reduce((total, result) => total + result.screens.length, 0) + screenIndex;
	const progress = isDone ? 100 : Math.round((completedScreens / totalScreens) * 100);
	const activeScore = screenScores.length > 0 ? averageScore(screenScores) : '--';

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
		<main className='h-dvh overflow-hidden bg-neutral-100 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:p-5'>
			{isDone ? (
				<section className='mx-auto flex h-full w-full max-w-md flex-col p-4 sm:h-[760px] sm:max-h-full sm:p-0'>
					<section className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-lg border-2 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#171717]'>
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
				</section>
			) : currentQuiz && currentScreen ? (
				<section className='mx-auto flex h-full w-full max-w-md flex-col gap-3 overflow-visible p-3 sm:h-[760px] sm:max-h-full sm:p-0'>
					<header className='flex shrink-0 items-center gap-3'>
						<div className='h-3 flex-1 overflow-hidden rounded-lg border-2 border-neutral-950 bg-white'>
							<div className='h-full bg-emerald-500 transition-all' style={{ width: `${progress}%` }} />
						</div>
						<div className='rounded-lg border-2 border-neutral-950 bg-sky-300 px-3 py-2 text-center shadow-[3px_3px_0_#171717]'>
							<p className='text-[10px] font-bold uppercase'>score</p>
							<p className='text-2xl font-black leading-none'>{activeScore}</p>
						</div>
					</header>
					<div className='min-h-0 flex-1 overflow-visible'>
						<currentQuiz.Screen
							config={currentScreen}
							key={`${currentQuiz.id}-${screenIndex}`}
							screenCount={currentQuiz.screens.length}
							screenNumber={screenIndex + 1}
							submit={submit}
						/>
					</div>
				</section>
			) : null}
		</main>
	);
}
