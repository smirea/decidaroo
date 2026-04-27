import { defineConfig } from 'vite';
import { env } from 'node:process';
// import MillionLint from "@million/lint";
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

if (!env.CLIENT_PORT) throw new Error('CLIENT_PORT is not set');
if (!env.VITE_API_URL) throw new Error('VITE_API_URL is not set');

const clientPort = Number(env.CLIENT_PORT);
if (Number.isNaN(clientPort)) throw new Error('CLIENT_PORT must be a valid number');

// https://vite.dev/config/
export default defineConfig({
	server: {
		port: clientPort,
		strictPort: true,
		proxy: {
			'/api': {
				target: env.VITE_API_URL,
				changeOrigin: true,
				rewrite: (path: string) => path.replace(/^\/api/, ''),
			},
		},
	},
	plugins: [
		tsconfigPaths(),
		tanstackRouter({
			target: 'react',
			autoCodeSplitting: true,
		}) as any,
		react(),
		tailwindcss() as any,
	],
});
