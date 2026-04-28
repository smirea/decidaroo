import { lazy } from 'react';
import { quizScreen } from './quizScreen.tsx';

type TwentyFortyEightScreenConfig = {
	title: string;
};

const TwentyFortyEightScreen = lazy(() => import('./twentyFortyEightScreen.tsx'));

export const twentyFortyEightQuiz = quizScreen<TwentyFortyEightScreenConfig>({
	id: '2048',
	title: '2048',
	tagline: 'A tiny tile merger where every option brings baggage.',
	screens: [{ title: '2048' }],
	Screen: TwentyFortyEightScreen,
});
