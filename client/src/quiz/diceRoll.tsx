import { lazy } from 'react';
import { quizScreen } from './quizScreen.tsx';

type DiceScreenConfig = {
	title: string;
};

const DiceRollScreen = lazy(() => import('./diceRollScreen.tsx'));

export const diceRollQuiz = quizScreen<DiceScreenConfig>({
	id: 'dice-roll',
	title: 'Dice Roll',
	tagline: 'A d20 with deeply questionable authority.',
	screens: [{ title: 'Dice Roll' }],
	Screen: DiceRollScreen,
});
