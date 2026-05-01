import { useState } from 'react';
import { decidingOptions } from '../../../shared/constants.ts';
import type { OptionPoints } from './quizScreen.tsx';

export type QuestionScoreItem = {
	title: string;
	content?: string;
	points: OptionPoints;
};

function optionPoint(points: OptionPoints, optionName: string) {
	return points[optionName] ?? 0;
}

function nonZeroOptions(points: OptionPoints) {
	return decidingOptions.filter(option => optionPoint(points, option.name) !== 0);
}

function QuestionScoreChips({ points }: { points: OptionPoints }) {
	return (
		<div className='flex shrink-0 gap-1'>
			{nonZeroOptions(points).map(option => (
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

export function QuestionScoreList({
	className = 'space-y-2',
	items,
}: {
	className?: string;
	items: readonly QuestionScoreItem[];
}) {
	const [openItems, setOpenItems] = useState<Record<number, boolean>>({});

	function toggleItem(index: number, hasContent: boolean) {
		if (!hasContent) return;
		setOpenItems(current => ({ ...current, [index]: !current[index] }));
	}

	return (
		<div className={className}>
			{items.map((item, index) => {
				const isOpen = openItems[index] && item.content;

				return (
					<button
						className='grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm transition-colors hover:bg-white'
						key={`${item.title}-${index}`}
						onClick={() => toggleItem(index, Boolean(item.content))}
						type='button'
					>
						<span className='font-black text-neutral-400'>{index + 1}</span>
						<span className='min-w-0'>
							<span className='block truncate font-bold text-neutral-700'>{item.title}</span>
							{isOpen ? (
								<span className='mt-1 block font-semibold leading-snug text-neutral-950'>{item.content}</span>
							) : null}
						</span>
						<QuestionScoreChips points={item.points} />
					</button>
				);
			})}
		</div>
	);
}
