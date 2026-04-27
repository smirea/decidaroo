import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<ConfigProvider
			theme={{
				token: {
					fontFamily:
						"'Google Sans Flex', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				},
			}}
		>
			<App />
		</ConfigProvider>
	</StrictMode>,
);
