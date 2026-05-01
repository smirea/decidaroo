import { defineConfig } from 'vite';
import { env } from 'node:process';
// import MillionLint from "@million/lint";
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';

if (!env.CLIENT_PORT) throw new Error('CLIENT_PORT is not set');
if (!env.VITE_API_URL) throw new Error('VITE_API_URL is not set');

const clientPort = Number(env.CLIENT_PORT);
if (Number.isNaN(clientPort)) throw new Error('CLIENT_PORT must be a valid number');
const allowedHosts = env.CLIENT_HOST ? [env.CLIENT_HOST] : [];

// https://vite.dev/config/
export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		port: clientPort,
		strictPort: true,
		allowedHosts,
		proxy: {
			'/api': {
				target: env.VITE_API_URL,
				changeOrigin: true,
				secure: false,
				rewrite: (path: string) => path.replace(/^\/api/, ''),
			},
		},
	},
	plugins: [
		tanstackRouter({
			target: 'react',
			autoCodeSplitting: true,
		}) as any,
		react(),
		tailwindcss() as any,
	],
});
