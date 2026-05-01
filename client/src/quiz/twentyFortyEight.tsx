import { quizScreen } from './quizScreen.tsx';
import TwentyFortyEightScreen from './twentyFortyEightScreen.tsx';

type TwentyFortyEightScreenConfig = {
	title: string;
};

export const twentyFortyEightQuiz = quizScreen<TwentyFortyEightScreenConfig>({
	id: '2048',
	title: '2048',
	tagline: 'A tiny tile merger where every option brings baggage.',
	screens: [{ title: '2048' }],
	Screen: TwentyFortyEightScreen,
});
