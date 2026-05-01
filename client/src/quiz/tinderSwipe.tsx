import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { decidingOptions } from '../../../shared/constants.ts';
import { Button } from '../components/Button.tsx';
import { QuestionScoreList, type QuestionScoreItem } from './questionScoreList.tsx';
import { addOptionScore, ScoreChips } from './scoreHud.tsx';
import {
	emptyOptionPoints,
	pointsForOption,
	quizScreen,
	type OptionPoints,
	type QuizScreenProps,
	type SubmitScore,
} from './quizScreen.tsx';

type SwipeQuestion = {
	title: string;
	question: string;
	optionName: (typeof decidingOptions)[number]['name'];
	late?: boolean;
};

type TinderSwipeConfig = {
	title: string;
	questions: readonly SwipeQuestion[];
};

type SwipeResult = {
	title: string;
	question: string;
	points: OptionPoints;
};

type DragState = {
	startX: number;
	currentX: number;
	dragging: boolean;
};

const swipeThreshold = 96;
const selectedQuestionCount = 10;
const firstHalfQuestionCount = selectedQuestionCount / 2;
const questionsPerOption = selectedQuestionCount / decidingOptions.length;

function shuffle<TItem>(items: readonly TItem[]) {
	const shuffled = [...items];

	for (let index = shuffled.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		const current = shuffled[index] as TItem;
		shuffled[index] = shuffled[swapIndex] as TItem;
		shuffled[swapIndex] = current;
	}

	return shuffled;
}

function selectSwipeQuestions(questions: readonly SwipeQuestion[]) {
	const earlyQuestions: SwipeQuestion[] = [];

	for (const question of shuffle(questions.filter(question => !question.late))) {
		if (earlyQuestions.length >= firstHalfQuestionCount) break;

		const optionCount = earlyQuestions.filter(item => item.optionName === question.optionName).length;
		if (optionCount < questionsPerOption) earlyQuestions.push(question);
	}

	const lateQuestions = decidingOptions.flatMap(option => {
		const selectedOptionCount = earlyQuestions.filter(question => question.optionName === option.name).length;
		const remainingCount = questionsPerOption - selectedOptionCount;
		const remainingQuestions = questions.filter(
			question => question.optionName === option.name && !earlyQuestions.includes(question),
		);
		return shuffle(remainingQuestions).slice(0, remainingCount);
	});

	return [...shuffle(earlyQuestions), ...shuffle(lateQuestions)];
}

function TinderSwipeOverview({
	results,
	scores,
	submit,
}: {
	results: readonly SwipeResult[];
	scores: OptionPoints;
	submit: SubmitScore;
}) {
	const items: QuestionScoreItem[] = results.map(result => ({
		title: result.title,
		content: result.question,
		points: result.points,
	}));

	return (
		<div className='flex h-full min-h-0 w-full items-center justify-center px-2 py-3'>
			<section className='flex max-h-full min-h-0 w-[calc(100%-1rem)] flex-col gap-4 overflow-hidden rounded-lg border-2 border-neutral-950 bg-white p-4 text-neutral-950 shadow-[6px_6px_0_#171717]'>
				<div>
					<p className='text-xs font-black uppercase text-fuchsia-700'>swipe overview</p>
					<h2 className='mt-1 text-2xl font-black leading-tight'>The match math has spoken</h2>
				</div>

				<ScoreChips scores={scores} />

				<QuestionScoreList className='min-h-0 flex-1 space-y-2 overflow-y-auto pr-1' items={items} />

				<Button
					className='mt-auto'
					onClick={() =>
						submit(
							scores,
							results.map(result => ({
								title: result.title,
								content: result.question,
								points: result.points,
							})),
						)
					}
					theme='endAction'
				>
					It's what I really think
				</Button>
			</section>
		</div>
	);
}

function TinderSwipeScreen({ config, previewScore, submit }: QuizScreenProps<TinderSwipeConfig>) {
	const [drag, setDrag] = useState<DragState>({ startX: 0, currentX: 0, dragging: false });
	const [questions] = useState(() => selectSwipeQuestions(config.questions));
	const [questionIndex, setQuestionIndex] = useState(0);
	const [leaving, setLeaving] = useState<'yes' | 'no' | null>(null);
	const [results, setResults] = useState<SwipeResult[]>([]);
	const [scores, setScores] = useState<OptionPoints>(() => emptyOptionPoints());
	const [finished, setFinished] = useState(false);
	const question = questions[questionIndex] ?? questions[0];
	const offset = drag.dragging ? drag.currentX - drag.startX : 0;
	const direction = offset > 0 ? 'yes' : offset < 0 ? 'no' : null;
	const intensity = Math.min(Math.abs(offset) / swipeThreshold, 1);
	const rotation = Math.max(-12, Math.min(12, offset / 12));
	const idle = !drag.dragging && !leaving;

	useEffect(() => previewScore(scores), [previewScore, scores]);

	const cardStyle = useMemo(
		() => ({
			opacity: leaving ? 0 : 1,
			transform: leaving
				? `translateX(${leaving === 'yes' ? 420 : -420}px) rotate(${leaving === 'yes' ? 18 : -18}deg)`
				: `translateX(${offset}px) rotate(${rotation}deg)`,
			transition: drag.dragging ? 'none' : 'transform 220ms ease, opacity 220ms ease',
		}),
		[drag.dragging, leaving, offset, rotation],
	);

	function finishSwipe(answer: 'yes' | 'no') {
		if (leaving || !question) return;

		const points = (answer === 'yes' ? 2 : -2) * (question.late ? 2 : 1);
		const resultPoints = pointsForOption(question.optionName, points);
		const nextScores = addOptionScore(scores, question.optionName, points).scores;
		const nextResults = [...results, { title: question.title, question: question.question, points: resultPoints }];
		const isLastQuestion = questionIndex >= questions.length - 1;

		setLeaving(answer);
		window.setTimeout(() => {
			setScores(nextScores);
			setResults(nextResults);
			setDrag({ startX: 0, currentX: 0, dragging: false });
			setLeaving(null);

			if (isLastQuestion) {
				setFinished(true);
				return;
			}

			setQuestionIndex(current => current + 1);
		}, 180);
	}

	function settleDrag() {
		if (!drag.dragging) return;

		const finalOffset = drag.currentX - drag.startX;
		if (finalOffset >= swipeThreshold) {
			finishSwipe('yes');
			return;
		}
		if (finalOffset <= -swipeThreshold) {
			finishSwipe('no');
			return;
		}

		setDrag({ startX: 0, currentX: 0, dragging: false });
	}

	if (finished) return <TinderSwipeOverview results={results} scores={scores} submit={submit} />;
	if (!question) return null;

	return (
		<div className='relative flex h-full min-h-0 w-full items-center justify-center overflow-visible px-2 py-3'>
			<div
				aria-label='Swipe question card'
				className='relative z-10 h-[68dvh] max-h-[560px] w-[calc(100%-1rem)] touch-none cursor-grab rounded-lg active:cursor-grabbing'
				onPointerCancel={settleDrag}
				onPointerDown={event => {
					event.currentTarget.setPointerCapture(event.pointerId);
					setDrag({ startX: event.clientX, currentX: event.clientX, dragging: true });
				}}
				onPointerMove={event => {
					if (!drag.dragging) return;
					setDrag(current => ({ ...current, currentX: event.clientX }));
				}}
				onPointerUp={settleDrag}
				role='group'
				style={cardStyle}
			>
				<div
					className={`flex h-full select-none flex-col justify-center gap-5 rounded-lg border-2 border-neutral-950 bg-white p-6 shadow-[6px_6px_0_#171717] ${idle ? 'swipe-card-idle' : ''}`}
				>
					<p className='text-3xl font-black leading-tight text-neutral-950'>{question.question}</p>
					<p className='text-base font-bold text-neutral-500'>{question.title}</p>
				</div>
			</div>

			<div
				className='pointer-events-none absolute left-3 top-1/2 z-30 flex h-24 w-24 -translate-y-1/2 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition-opacity'
				style={{ opacity: direction === 'no' ? intensity : 0 }}
			>
				<ThumbsDown size={52} weight='fill' />
			</div>
			<div
				className='pointer-events-none absolute right-3 top-1/2 z-30 flex h-24 w-24 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-opacity'
				style={{ opacity: direction === 'yes' ? intensity : 0 }}
			>
				<ThumbsUp size={52} weight='fill' />
			</div>
		</div>
	);
}

const swipeQuestions = [
	{
		title: 'Cat Test',
		question: 'Are you a cat (or do you have strong affinity for laser pointers) ?',
		optionName: 'deci-mate',
	},
	{
		title: 'Emoji Audit',
		question:
			'Should the deciding interface include enough emoji energy that nobody can tell whether it is satire or UX?',
		optionName: 'deci-mate',
	},
	{
		title: 'Taste Check',
		question: 'Do you have long covid and have subsequently lost all sense of taste ?',
		optionName: 'deci-mate',
		late: true,
	},
	{
		title: 'Dimension Check',
		question: "Have you ever felt that everyone's mindset is 2 dimensional and you alone are in anoter dimension?",
		optionName: 'deci-mate',
	},
	{
		title: 'Extra Axis',
		question: 'Do you think it would be helpful to allow to you ALSO slide this card up AND down?',
		optionName: 'deci-mate',
		late: true,
	},
	{
		title: 'Voting Theory',
		question:
			'Did you (or your AI) spend hours researching political voting theory to optimize equitos distributivity?',
		optionName: 'decision-buddy',
	},
	{
		title: 'Precise Excitement',
		question:
			'Is the decision important enough to let everyone be exactly 31% excited and still pretend that is normal?',
		optionName: 'decision-buddy',
	},
	{
		title: 'Form Enjoyer',
		question:
			'Do you have a fetish for meticulously filling out forms and would like to subject everyone else to it as well?',
		optionName: 'decision-buddy',
	},
	{
		title: 'Soft Veto',
		question:
			'Will "I\'ll do it if others want to" save the group from one person heroically pretending to have no opinion?',
		optionName: 'decision-buddy',
		late: true,
	},
	{
		title: 'Style Courage',
		question:
			'Do you lack any artistic courage and just use boilerplate colors (or are you closeted communist and love the idea of a single universal style)',
		optionName: 'decision-buddy',
		late: true,
	},
] as const satisfies SwipeQuestion[];

function assertEnoughQuestionCoverage(questions: readonly SwipeQuestion[]) {
	const nonLateCount = questions.filter(question => !question.late).length;
	const shortOption = decidingOptions.find(
		option => questions.filter(question => question.optionName === option.name).length < questionsPerOption,
	);

	if (!Number.isInteger(questionsPerOption) || !Number.isInteger(firstHalfQuestionCount) || shortOption) {
		throw new Error(`Tinder Swipe needs at least ${questionsPerOption} questions for each deciding option.`);
	}

	if (nonLateCount < firstHalfQuestionCount) {
		throw new Error(`Tinder Swipe needs at least ${firstHalfQuestionCount} non-late questions.`);
	}
}

assertEnoughQuestionCoverage(swipeQuestions);

export const tinderSwipeQuiz = quizScreen<TinderSwipeConfig>({
	id: 'tinder-swipe',
	title: 'Tinder Swipe',
	tagline: 'A dating app interface for tiny decision science.',
	screens: [{ title: 'Swipe Overview', questions: swipeQuestions }],
	Screen: TinderSwipeScreen,
});
