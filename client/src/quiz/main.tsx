import { Headphones, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { clampScore, averageScore } from './quizScreen.tsx';
import { tinderSwipeQuiz } from './tinderSwipe.tsx';

const quizzes = [tinderSwipeQuiz] as const;
const themeSongUrl = '/decidaroo.mp3';
const soundChoiceKey = 'decidaroo:sound-choice';
const soundToggleKey = 'decidaroo:sound-on';
const soundChoiceSkipMs = 24 * 60 * 60 * 1000;

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

type SoundChoice = 'yes' | 'no';

type StoredSoundChoice = {
	choice: SoundChoice;
	at: number;
};

type StoredSoundToggle = {
	on: boolean;
	at: number;
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

function readStoredSoundChoice(): StoredSoundChoice | null {
	try {
		const raw = window.localStorage.getItem(soundChoiceKey);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as Partial<StoredSoundChoice>;
		if ((parsed.choice !== 'yes' && parsed.choice !== 'no') || typeof parsed.at !== 'number') return null;
		if (Date.now() - parsed.at >= soundChoiceSkipMs) {
			window.localStorage.removeItem(soundChoiceKey);
			return null;
		}

		return { choice: parsed.choice, at: parsed.at };
	} catch {
		return null;
	}
}

function writeStoredSoundChoice(choice: SoundChoice): StoredSoundChoice {
	const stored = { choice, at: Date.now() };
	window.localStorage.setItem(soundChoiceKey, JSON.stringify(stored));
	return stored;
}

function hasFreshHeadphoneYes(stored: StoredSoundChoice | null) {
	return stored?.choice === 'yes';
}

function readStoredSoundOn() {
	try {
		const raw = window.localStorage.getItem(soundToggleKey);
		if (!raw) return true;

		const parsed = JSON.parse(raw) as Partial<StoredSoundToggle>;
		if (typeof parsed.on !== 'boolean' || typeof parsed.at !== 'number') {
			window.localStorage.removeItem(soundToggleKey);
			return true;
		}

		if (Date.now() - parsed.at >= soundChoiceSkipMs) {
			window.localStorage.removeItem(soundToggleKey);
			return true;
		}

		return parsed.on;
	} catch {
		return true;
	}
}

function writeStoredSoundOn(on: boolean) {
	window.localStorage.setItem(soundToggleKey, JSON.stringify({ on, at: Date.now() }));
}

function getInitialSoundState() {
	const stored = readStoredSoundChoice();
	return { stored, showIntro: !hasFreshHeadphoneYes(stored) };
}

export function QuizPage() {
	const [quizIndex, setQuizIndex] = useState(0);
	const [screenIndex, setScreenIndex] = useState(0);
	const [screenScores, setScreenScores] = useState<number[]>([]);
	const [results, setResults] = useState<QuizResult[]>([]);
	const [soundState, setSoundState] = useState(getInitialSoundState);
	const [soundOn, setSoundOn] = useState(readStoredSoundOn);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const finalScore = averageScore(results.map(result => result.score));
	const isDone = results.length === quizzes.length;
	const currentQuiz = quizzes[quizIndex];
	const currentScreen = currentQuiz?.screens[screenIndex];
	const totalScreens = quizzes.reduce((total, quiz) => total + quiz.screens.length, 0);
	const completedScreens = results.reduce((total, result) => total + result.screens.length, 0) + screenIndex;
	const progress = isDone ? 100 : Math.round((completedScreens / totalScreens) * 100);
	const activeScore = screenScores.length > 0 ? averageScore(screenScores) : '--';

	useEffect(() => {
		const audio = document.createElement('audio');
		audio.src = themeSongUrl;
		audio.loop = true;
		audio.preload = 'auto';
		audio.hidden = true;
		audio.setAttribute('aria-hidden', 'true');
		audioRef.current = audio;
		document.body.append(audio);
		audio.load();

		return () => {
			audio.pause();
			audio.remove();
			audioRef.current = null;
		};
	}, []);

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

	async function playThemeSong() {
		const audio = audioRef.current;
		if (!audio) return false;

		try {
			await audio.play();
			return true;
		} catch {
			return false;
		}
	}

	function pauseThemeSong() {
		const audio = audioRef.current;
		if (!audio) return;

		audio.pause();
	}

	function chooseSound(choice: SoundChoice) {
		const stored = writeStoredSoundChoice(choice);
		setSoundState({ stored, showIntro: false });

		const nextSoundOn = choice === 'yes';
		setSoundOn(nextSoundOn);
		writeStoredSoundOn(nextSoundOn);

		if (nextSoundOn) void playThemeSong();
		else pauseThemeSong();
	}

	function toggleThemeSong() {
		if (soundOn && !audioRef.current?.paused) {
			setSoundOn(false);
			writeStoredSoundOn(false);
			pauseThemeSong();
			return;
		}

		const stored = writeStoredSoundChoice('yes');
		setSoundState({ stored, showIntro: false });
		setSoundOn(true);
		writeStoredSoundOn(true);

		void playThemeSong();
	}

	function SoundButton() {
		return (
			<button
				aria-label={soundOn ? 'Turn theme song off' : 'Turn theme song on'}
				className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-neutral-950 bg-white text-neutral-950 shadow-[3px_3px_0_#171717] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#171717]'
				onClick={toggleThemeSong}
				type='button'
			>
				{soundOn ? <SpeakerHigh size={21} weight='fill' /> : <SpeakerSlash size={21} weight='fill' />}
			</button>
		);
	}

	if (soundState.showIntro) {
		return (
			<main className='h-dvh overflow-hidden bg-neutral-100 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:p-5'>
				<section className='mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center sm:h-[760px] sm:max-h-full sm:p-0'>
					<div className='space-y-6'>
						<h1 className='text-5xl font-black leading-none'>Decidaroo</h1>
						<div className='mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-neutral-950 bg-fuchsia-200 shadow-[5px_5px_0_#171717]'>
							<Headphones size={54} weight='duotone' />
						</div>
						<p className='text-2xl font-black leading-tight'>Are your headphones connected?</p>
					</div>

					<div className='grid w-full gap-3'>
						<button
							className='min-h-12 rounded-lg bg-neutral-950 px-4 py-3 text-base font-black text-white shadow-sm active:translate-y-px'
							onClick={() => chooseSound('yes')}
							type='button'
						>
							yes
						</button>
						<button
							className='min-h-12 rounded-lg border-2 border-neutral-950 bg-white px-4 py-3 text-base font-black text-neutral-950 shadow-[3px_3px_0_#171717] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#171717]'
							onClick={() => chooseSound('no')}
							type='button'
						>
							no I'm a boring person
						</button>
					</div>
				</section>
			</main>
		);
	}

	return (
		<main className='h-dvh overflow-hidden bg-neutral-100 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:p-5'>
			{isDone ? (
				<section className='mx-auto flex h-full w-full max-w-md flex-col p-4 sm:h-[760px] sm:max-h-full sm:p-0'>
					<section className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-lg border-2 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#171717]'>
						<div className='flex items-start gap-3'>
							<SoundButton />
							<div className='space-y-2'>
								<p className='text-xs font-bold uppercase text-fuchsia-700'>final verdict</p>
								<h2 className='text-4xl font-black leading-none'>{finalScore}</h2>
								<p className='text-lg font-bold text-neutral-700'>{scoreMood(finalScore)}</p>
							</div>
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
						<SoundButton />
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
