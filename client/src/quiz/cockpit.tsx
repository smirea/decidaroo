import { lazy } from 'react';
import { quizScreen } from './quizScreen.tsx';

type CockpitScreenConfig = {
	title: string;
};

const CockpitScreen = lazy(() => import('./cockpitScreen.tsx'));

export const cockpitQuiz = quizScreen<CockpitScreenConfig>({
	id: 'cockpit',
	title: 'Cockpit',
	tagline: 'A bogus dashboard where every lever has consequences.',
	screens: [{ title: 'Cockpit' }],
	Screen: CockpitScreen,
});
