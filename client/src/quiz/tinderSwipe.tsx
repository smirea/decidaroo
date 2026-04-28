import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { decidingOptions } from '../../../shared/constants.ts';
import { pointsForOption, quizScreen, type QuizScreenProps } from './quizScreen.tsx';

type SwipeQuestion = {
	title: string;
	question: string;
	optionName: (typeof decidingOptions)[number]['name'];
};

type DragState = {
	startX: number;
	currentX: number;
	dragging: boolean;
};

const swipeThreshold = 96;

function TinderSwipeScreen({ screenNumber, screenCount, config, submit }: QuizScreenProps<SwipeQuestion>) {
	const [drag, setDrag] = useState<DragState>({ startX: 0, currentX: 0, dragging: false });
	const [leaving, setLeaving] = useState<'yes' | 'no' | null>(null);
	const offset = drag.dragging ? drag.currentX - drag.startX : 0;
	const direction = offset > 0 ? 'yes' : offset < 0 ? 'no' : null;
	const intensity = Math.min(Math.abs(offset) / swipeThreshold, 1);
	const rotation = Math.max(-12, Math.min(12, offset / 12));
	const idle = !drag.dragging && !leaving;

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
		if (leaving) return;

		setLeaving(answer);
		window.setTimeout(() => submit(pointsForOption(config.optionName, answer === 'yes' ? 2 : -2)), 180);
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
					className={`flex h-full select-none flex-col justify-between rounded-lg border-2 border-neutral-950 bg-white p-6 shadow-[6px_6px_0_#171717] ${idle ? 'swipe-card-idle' : ''}`}
				>
					<div className='flex justify-between gap-3'>
						<span className='rounded-lg bg-fuchsia-200 px-3 py-1 text-xs font-black uppercase text-fuchsia-950'>
							Decide?
						</span>
						<span className='text-sm font-black text-neutral-400'>
							{screenNumber}/{screenCount}
						</span>
					</div>
					<p className='text-3xl font-black leading-tight text-neutral-950'>{config.question}</p>
					<p className='text-base font-bold text-neutral-500'>{config.title}</p>
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
		title: 'Group Patience',
		question: 'Can everyone handle more than two options?',
		optionName: 'deci-mate',
	},
	{
		title: 'Drama Forecast',
		question: 'Will someone argue with the result anyway?',
		optionName: 'decision-buddy',
	},
	{
		title: 'Time Pressure',
		question: 'Does this need a decision before snacks disappear?',
		optionName: 'deci-mate',
	},
	{
		title: 'Fairness Vibes',
		question: 'Should every person get equal blame for the outcome?',
		optionName: 'decision-buddy',
	},
	{
		title: 'Chaos Appetite',
		question: 'Would randomness make this objectively funnier?',
		optionName: 'deci-mate',
	},
	{
		title: 'Ceremony Budget',
		question: 'Would a result feel better if it seemed slightly official?',
		optionName: 'decision-buddy',
	},
] as const satisfies SwipeQuestion[];

function assertEqualQuestionCoverage(questions: readonly SwipeQuestion[]) {
	const counts = new Map(decidingOptions.map(option => [option.name, 0]));

	for (const question of questions) counts.set(question.optionName, (counts.get(question.optionName) ?? 0) + 1);

	const expectedCount = counts.get(decidingOptions[0]?.name ?? '') ?? 0;
	const unevenOption = decidingOptions.find(option => counts.get(option.name) !== expectedCount);

	if (unevenOption) {
		throw new Error('Tinder Swipe must have an equal number of questions for each deciding option.');
	}
}

assertEqualQuestionCoverage(swipeQuestions);

export const tinderSwipeQuiz = quizScreen<SwipeQuestion>({
	id: 'tinder-swipe',
	title: 'Tinder Swipe',
	tagline: 'A dating app interface for tiny decision science.',
	screens: swipeQuestions,
	Screen: TinderSwipeScreen,
});
