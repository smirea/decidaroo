import { Headphones, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button.tsx';
import { decidingOptions } from '../../../shared/constants.ts';
import { scoreInputToPoints, sumOptionPoints, type OptionPoints, type QuizDefinition } from './quizScreen.tsx';
import { asteroidsQuiz } from './asteroids.tsx';
import { diceRollQuiz } from './diceRoll.tsx';
import { tinderSwipeQuiz } from './tinderSwipe.tsx';
import { twentyFortyEightQuiz } from './twentyFortyEight.tsx';

export const quizzes = [tinderSwipeQuiz, diceRollQuiz, asteroidsQuiz, twentyFortyEightQuiz] as const;
const themeSongUrl = '/decidaroo.mp3';
const soundChoiceKey = 'decidaroo:sound-choice';
const soundToggleKey = 'decidaroo:sound-on';
const soundChoiceSkipMs = 24 * 60 * 60 * 1000;

type ScreenResult = {
	title: string;
	points: OptionPoints;
};

type QuizResult = {
	id: string;
	title: string;
	points: OptionPoints;
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

function ClubBackground() {
	return (
		<div aria-hidden='true' className='club-background'>
			<span className='club-spotlight club-spotlight-a' />
			<span className='club-spotlight club-spotlight-b' />
			<span className='club-spotlight club-spotlight-c' />
			<span className='club-spotlight club-spotlight-d' />
			<span className='club-spotlight club-spotlight-e' />
			<span className='club-spotlight club-spotlight-f' />
			<span className='club-spotlight club-spotlight-g' />
		</div>
	);
}

function optionPoint(points: OptionPoints, optionName: string) {
	return points[optionName] ?? 0;
}

function nonZeroOptions(points: OptionPoints) {
	return decidingOptions.filter(option => optionPoint(points, option.name) !== 0);
}

function winningOption(points: OptionPoints) {
	return decidingOptions.reduce((winner, option) =>
		optionPoint(points, option.name) > optionPoint(points, winner.name) ? option : winner,
	);
}

function ScoreStrip({ points }: { points: OptionPoints }) {
	const options = nonZeroOptions(points);

	if (options.length === 0) return null;

	return (
		<div className='grid shrink-0 grid-flow-col gap-2'>
			{options.map(option => (
				<div
					className='min-w-12 rounded-lg border-2 border-neutral-950 px-2 py-2 text-center text-xl font-black leading-none text-neutral-950 shadow-[3px_3px_0_#171717]'
					key={option.name}
					style={{ backgroundColor: option.color }}
				>
					{optionPoint(points, option.name)}
				</div>
			))}
		</div>
	);
}

function PointsBreakdown({ points }: { points: OptionPoints }) {
	const options = nonZeroOptions(points);

	if (options.length === 0) return null;

	return (
		<div className='grid grid-cols-2 gap-2'>
			{options.map(option => (
				<div
					className='rounded-lg border-2 border-neutral-950 p-2 text-neutral-950 shadow-[3px_3px_0_#171717]'
					key={option.name}
					style={{ backgroundColor: option.color }}
				>
					<p className='truncate text-sm font-black'>{option.name}</p>
					<p className='text-2xl font-black leading-none'>{optionPoint(points, option.name)}</p>
				</div>
			))}
		</div>
	);
}

function ScreenPointChips({ points }: { points: OptionPoints }) {
	const options = nonZeroOptions(points);

	return (
		<div className='flex gap-1'>
			{options.map(option => (
				<span
					className='min-w-7 rounded border border-neutral-950 px-1.5 py-0.5 text-center font-black text-neutral-950'
					key={option.name}
					style={{ backgroundColor: option.color }}
				>
					{optionPoint(points, option.name)}
				</span>
			))}
		</div>
	);
}

type Navigate = (path: string) => void;

type QuizPageProps = {
	quizSet?: readonly QuizDefinition[];
	skipIntro?: boolean;
};

export function QuizPage({ quizSet = quizzes, skipIntro = false }: QuizPageProps) {
	const [quizIndex, setQuizIndex] = useState(0);
	const [screenIndex, setScreenIndex] = useState(0);
	const [screenScores, setScreenScores] = useState<OptionPoints[]>([]);
	const [results, setResults] = useState<QuizResult[]>([]);
	const [soundState, setSoundState] = useState(() => {
		if (!skipIntro) return getInitialSoundState();

		return { stored: readStoredSoundChoice(), showIntro: false };
	});
	const [soundOn, setSoundOn] = useState(readStoredSoundOn);
	const [themeSongPlaying, setThemeSongPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const finalPoints = sumOptionPoints(results.map(result => result.points));
	const isDone = results.length === quizSet.length;
	const currentQuiz = quizSet[quizIndex];
	const currentScreen = currentQuiz?.screens[screenIndex];
	const totalScreens = quizSet.reduce((total, quiz) => total + quiz.screens.length, 0);
	const completedScreens = results.reduce((total, result) => total + result.screens.length, 0) + screenIndex;
	const progress = isDone || totalScreens === 0 ? 100 : Math.round((completedScreens / totalScreens) * 100);
	const activePoints = sumOptionPoints([...results.map(result => result.points), ...screenScores]);

	useEffect(() => {
		const audio = document.createElement('audio');
		audio.src = themeSongUrl;
		audio.loop = true;
		audio.preload = 'auto';
		audio.hidden = true;
		audio.setAttribute('aria-hidden', 'true');
		audioRef.current = audio;
		const syncAudioState = () => setThemeSongPlaying(!audio.paused);

		audio.addEventListener('play', syncAudioState);
		audio.addEventListener('pause', syncAudioState);
		audio.addEventListener('ended', syncAudioState);
		document.body.append(audio);
		audio.load();

		if (soundOn && soundState.stored?.choice === 'yes') void playThemeSong();

		return () => {
			audio.removeEventListener('play', syncAudioState);
			audio.removeEventListener('pause', syncAudioState);
			audio.removeEventListener('ended', syncAudioState);
			audio.pause();
			audio.remove();
			audioRef.current = null;
			setThemeSongPlaying(false);
		};
	}, []);

	function restart() {
		setQuizIndex(0);
		setScreenIndex(0);
		setScreenScores([]);
		setResults([]);
	}

	function submit(rawScore: Partial<OptionPoints>) {
		if (!currentQuiz) return;

		const nextScores = [...screenScores, scoreInputToPoints(rawScore)];

		if (screenIndex < currentQuiz.screens.length - 1) {
			setScreenScores(nextScores);
			setScreenIndex(current => current + 1);
			return;
		}

		const nextResult: QuizResult = {
			id: currentQuiz.id,
			title: currentQuiz.title,
			points: currentQuiz.score(nextScores),
			screens: nextScores.map((points, index) => ({
				title: screenTitle(currentQuiz.screens[index], index),
				points,
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
			setThemeSongPlaying(true);
			return true;
		} catch {
			setThemeSongPlaying(false);
			return false;
		}
	}

	function pauseThemeSong() {
		const audio = audioRef.current;
		if (!audio) return;

		audio.pause();
		setThemeSongPlaying(false);
	}

	function saveThemeSongIntent(on: boolean) {
		setSoundOn(on);
		writeStoredSoundOn(on);
	}

	function chooseSound(choice: SoundChoice) {
		const stored = writeStoredSoundChoice(choice);
		setSoundState({ stored, showIntro: false });

		const nextSoundOn = choice === 'yes';

		if (!nextSoundOn) {
			saveThemeSongIntent(false);
			pauseThemeSong();
			return;
		}

		void playThemeSong().then(saveThemeSongIntent);
	}

	function toggleThemeSong() {
		if (themeSongPlaying) {
			saveThemeSongIntent(false);
			pauseThemeSong();
			return;
		}

		const stored = writeStoredSoundChoice('yes');
		setSoundState({ stored, showIntro: false });

		void playThemeSong().then(saveThemeSongIntent);
	}

	function SoundButton() {
		return (
			<button
				aria-label={themeSongPlaying ? 'Turn theme song off' : 'Turn theme song on'}
				className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-neutral-950 bg-white text-neutral-950 shadow-[3px_3px_0_#171717] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#171717]'
				onClick={toggleThemeSong}
				type='button'
			>
				{themeSongPlaying ? <SpeakerHigh size={21} weight='fill' /> : <SpeakerSlash size={21} weight='fill' />}
			</button>
		);
	}

	if (soundState.showIntro) {
		return (
			<main className='relative isolate h-dvh overflow-hidden bg-neutral-950 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:p-5'>
				<ClubBackground />
				<section className='relative z-10 mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center text-white sm:h-[760px] sm:max-h-full sm:p-0'>
					<div className='space-y-6'>
						<h1 className='text-5xl font-black leading-none drop-shadow-[0_2px_18px_rgba(255,255,255,0.45)]'>
							Decidaroo
						</h1>
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
		<main className='relative isolate h-dvh overflow-hidden bg-neutral-950 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:p-5'>
			<ClubBackground />
			{isDone ? (
				<section className='relative z-10 mx-auto flex h-full w-full max-w-md flex-col p-4 sm:h-[760px] sm:max-h-full sm:p-0'>
					<section className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-lg border-2 border-neutral-950 bg-white p-4 shadow-[5px_5px_0_#171717]'>
						<div className='flex items-start gap-3'>
							<SoundButton />
							<div className='flex-1 space-y-3'>
								<p className='text-xs font-bold uppercase text-fuchsia-700'>final verdict</p>
								<h2 className='text-2xl font-black leading-tight text-neutral-950'>
									{winningOption(finalPoints).name} is what you truly desire
								</h2>
								<PointsBreakdown points={finalPoints} />
							</div>
						</div>

						<div className='space-y-3'>
							{results.map(result => (
								<div className='rounded-lg border border-neutral-200 bg-neutral-50 p-3' key={result.id}>
									<div className='grid grid-cols-[1fr_auto] items-center gap-3'>
										<h3 className='font-black'>{result.title}</h3>
										{result.screens.length === 1 ? <ScreenPointChips points={result.points} /> : null}
									</div>
									{result.screens.length > 1 ? (
										<div className='mt-3 space-y-2'>
											{result.screens.map((screen, index) => (
												<div
													className='grid grid-cols-[1fr_auto] items-center gap-3 text-sm'
													key={`${result.id}-${screen.title}`}
												>
													<span className='font-semibold text-neutral-700'>
														{index + 1}. {screen.title}
													</span>
													<ScreenPointChips points={screen.points} />
												</div>
											))}
										</div>
									) : null}
								</div>
							))}
						</div>

						<Button className='mt-auto' onClick={restart} theme='endAction'>
							Run the nonsense again
						</Button>
					</section>
				</section>
			) : currentQuiz && currentScreen ? (
				<section className='relative z-10 mx-auto flex h-full w-full max-w-md flex-col gap-3 overflow-visible p-3 sm:h-[760px] sm:max-h-full sm:p-0'>
					<header className='flex shrink-0 items-center gap-3'>
						<SoundButton />
						<div className='h-3 flex-1 overflow-hidden rounded-lg border-2 border-neutral-950 bg-white'>
							<div className='h-full bg-emerald-500 transition-all' style={{ width: `${progress}%` }} />
						</div>
						<ScoreStrip points={activePoints} />
					</header>
					<div className='min-h-0 flex-1 overflow-visible'>
						<Suspense
							fallback={
								<div className='flex h-full items-center justify-center text-lg font-black text-white'>
									loading nonsense...
								</div>
							}
						>
							<currentQuiz.Screen
								config={currentScreen}
								key={`${currentQuiz.id}-${screenIndex}`}
								screenCount={currentQuiz.screens.length}
								screenNumber={screenIndex + 1}
								submit={submit}
							/>
						</Suspense>
					</div>
				</section>
			) : null}
		</main>
	);
}

export function QuizTestIndex({ navigate }: { navigate: Navigate }) {
	return (
		<main className='relative isolate h-dvh overflow-hidden bg-neutral-950 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:p-5'>
			<ClubBackground />
			<section className='relative z-10 mx-auto flex h-full w-full max-w-md flex-col justify-center gap-5 p-4 text-white sm:h-[760px] sm:max-h-full sm:p-0'>
				<div className='space-y-2'>
					<p className='text-xs font-bold uppercase text-cyan-200'>test mode</p>
					<h1 className='text-4xl font-black leading-none'>Pick a quiz</h1>
				</div>

				<div className='grid gap-3'>
					{quizzes.map(quiz => (
						<button
							className='rounded-lg border-2 border-neutral-950 bg-white p-4 text-left text-neutral-950 shadow-[5px_5px_0_#171717] active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_#171717]'
							key={quiz.id}
							onClick={() => navigate(`/test/${quiz.id}`)}
							type='button'
						>
							<span className='block text-lg font-black'>{quiz.title}</span>
							<span className='mt-1 block text-sm font-bold text-neutral-500'>
								{quiz.screens.length} {quiz.screens.length === 1 ? 'screen' : 'screens'}
							</span>
						</button>
					))}
				</div>

				<button
					className='min-h-12 rounded-lg border-2 border-white/80 bg-transparent px-4 py-3 text-base font-black text-white active:translate-y-px'
					onClick={() => navigate('/')}
					type='button'
				>
					Back to the real thing
				</button>
			</section>
		</main>
	);
}

export function QuizTestPage({ navigate, quizId }: { navigate: Navigate; quizId: string }) {
	const quiz = quizzes.find(candidate => candidate.id === quizId);

	if (!quiz) {
		return (
			<main className='relative isolate h-dvh overflow-hidden bg-neutral-950 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:p-5'>
				<ClubBackground />
				<section className='relative z-10 mx-auto flex h-full w-full max-w-md flex-col justify-center gap-4 p-4 text-white sm:h-[760px] sm:max-h-full sm:p-0'>
					<p className='text-xs font-bold uppercase text-rose-200'>missing quiz</p>
					<h1 className='text-4xl font-black leading-none'>No such nonsense</h1>
					<button
						className='min-h-12 rounded-lg bg-white px-4 py-3 text-base font-black text-neutral-950 active:translate-y-px'
						onClick={() => navigate('/test')}
						type='button'
					>
						Back to test mode
					</button>
				</section>
			</main>
		);
	}

	return <QuizPage key={quiz.id} quizSet={[quiz]} skipIntro />;
}
