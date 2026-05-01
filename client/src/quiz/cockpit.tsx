import CockpitScreen from './cockpitScreen.tsx';
import { quizScreen } from './quizScreen.tsx';

type CockpitScreenConfig = {
	title: string;
};

export const cockpitQuiz = quizScreen<CockpitScreenConfig>({
	id: 'cockpit',
	title: 'Cockpit',
	tagline: 'A bogus cockpit where every lever has consequences.',
	screens: [{ title: 'Cockpit' }],
	Screen: CockpitScreen,
});
