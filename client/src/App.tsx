import { useEffect, useLayoutEffect, useState } from 'react';
import { QuizPage, QuizTestIndex, QuizTestPage } from './quiz/main.tsx';

const autofillIgnoredSelector = 'form, input, textarea, select';
const autofillIgnoreAttributes = {
	autocomplete: 'off',
	'data-1p-ignore': 'true',
	'data-bwignore': 'true',
	'data-form-type': 'other',
	'data-lpignore': 'true',
	'data-op-ignore': 'true',
} as const;

function currentPath() {
	const path = window.location.pathname.replace(/\/+$/, '');
	return path === '' ? '/' : path;
}

function setAutofillIgnored(element: Element) {
	if (!(element instanceof HTMLElement)) return;

	for (const [name, value] of Object.entries(autofillIgnoreAttributes)) {
		element.setAttribute(name, value);
	}
}

function markAutofillIgnored(root: ParentNode) {
	root.querySelectorAll(autofillIgnoredSelector).forEach(setAutofillIgnored);
}

function useDisableAppAutofill() {
	useLayoutEffect(() => {
		setAutofillIgnored(document.documentElement);
		setAutofillIgnored(document.body);
		markAutofillIgnored(document);

		const observer = new MutationObserver(records => {
			for (const record of records) {
				for (const node of record.addedNodes) {
					if (!(node instanceof Element)) continue;

					if (node.matches(autofillIgnoredSelector)) setAutofillIgnored(node);
					markAutofillIgnored(node);
				}
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, []);
}

export default function App() {
	useDisableAppAutofill();

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
