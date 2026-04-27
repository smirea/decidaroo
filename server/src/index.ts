import { env } from 'node:process';

if (!env.API_PORT) throw new Error('API_PORT is not set');

const apiPort = Number(env.API_PORT);
if (Number.isNaN(apiPort)) throw new Error('API_PORT must be a valid number');

const server = Bun.serve({
	development: true,
	port: apiPort,
	routes: {
		'/status': Response.json({ ok: true }),
		'/*': Response.json({ ok: false, error: 'Not found' }, { status: 404 }),
	},
});

console.log('Server running at:', server.url);
