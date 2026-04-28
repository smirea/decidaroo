import { useEffect, useState } from 'react';
import { QuizPage, QuizTestIndex, QuizTestPage } from './quiz/main.tsx';

function currentPath() {
	const path = window.location.pathname.replace(/\/+$/, '');
	return path === '' ? '/' : path;
}

export default function App() {
	const [path, setPath] = useState(currentPath);

	useEffect(() => {
		const syncPath = () => setPath(currentPath());

		window.addEventListener('popstate', syncPath);
		return () => window.removeEventListener('popstate', syncPath);
	}, []);

	function navigate(nextPath: string) {
		window.history.pushState(null, '', nextPath);
		setPath(currentPath());
	}

	if (path === '/test') return <QuizTestIndex navigate={navigate} />;

	const testMatch = path.match(/^\/test\/([^/]+)$/);
	if (testMatch) return <QuizTestPage navigate={navigate} quizId={decodeURIComponent(testMatch[1])} />;

	return <QuizPage />;
}
