import { lazy } from 'react';
import { quizScreen } from './quizScreen.tsx';

type AsteroidsScreenConfig = {
	title: string;
};

const AsteroidsScreen = lazy(() => import('./asteroidsScreen.tsx'));

export const asteroidsQuiz = quizScreen<AsteroidsScreenConfig>({
	id: 'asteroids',
	title: 'Asteroids',
	tagline: 'Tiny space rocks with suspicious political consequences.',
	screens: [{ title: 'Asteroids' }],
	Screen: AsteroidsScreen,
});
