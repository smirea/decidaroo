import AsteroidsScreen from './asteroidsScreen.tsx';
import { quizScreen } from './quizScreen.tsx';

type AsteroidsScreenConfig = {
	title: string;
};

export const asteroidsQuiz = quizScreen<AsteroidsScreenConfig>({
	id: 'asteroids',
	title: 'Asteroids',
	tagline: 'Tiny space rocks with suspicious political consequences.',
	screens: [{ title: 'Asteroids' }],
	Screen: AsteroidsScreen,
});
