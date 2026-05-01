import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { decidingOptions } from '../../../shared/constants.ts';
import { Button } from '../components/Button.tsx';

type VersusIntroProps = {
	onReady: () => void;
};

type SparkStyle = CSSProperties & {
	[customProperty: `--${string}`]: string;
};

const bloodRed = '#b20d1d';
const introDurationMs = 3450;

function hasReducedMotion() {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const impactSparkStyles: SparkStyle[] = [
	{ '--spark-delay': '1.72s', '--spark-rotation': '-26deg', '--spark-x': '-46%', '--spark-y': '-34%' },
	{ '--spark-delay': '1.78s', '--spark-rotation': '18deg', '--spark-x': '42%', '--spark-y': '-30%' },
	{ '--spark-delay': '1.84s', '--spark-rotation': '-58deg', '--spark-x': '-33%', '--spark-y': '34%' },
	{ '--spark-delay': '1.9s', '--spark-rotation': '48deg', '--spark-x': '39%', '--spark-y': '36%' },
	{ '--spark-delay': '1.94s', '--spark-rotation': '4deg', '--spark-x': '0%', '--spark-y': '-44%' },
] as const;

const readySparkStyles: SparkStyle[] = [
	{ '--spark-delay': '0.08s', '--spark-rotation': '-18deg', '--spark-x': '12%', '--spark-y': '12%' },
	{ '--spark-delay': '0.18s', '--spark-rotation': '28deg', '--spark-x': '28%', '--spark-y': '-8%' },
	{ '--spark-delay': '0.28s', '--spark-rotation': '-42deg', '--spark-x': '54%', '--spark-y': '8%' },
	{ '--spark-delay': '0.38s', '--spark-rotation': '36deg', '--spark-x': '70%', '--spark-y': '-10%' },
	{ '--spark-delay': '0.48s', '--spark-rotation': '-24deg', '--spark-x': '84%', '--spark-y': '10%' },
] as const;

function panelStyle(color: string, side: 'left' | 'right') {
	const angle = side === 'left' ? '145deg' : '35deg';

	return {
		background: `linear-gradient(${angle}, #fff 0%, ${color} 17%, ${color} 58%, #171717 100%)`,
	} satisfies CSSProperties;
}

export function VersusIntro({ onReady }: VersusIntroProps) {
	const [readyVisible, setReadyVisible] = useState(false);
	const [firstOption, secondOption] = decidingOptions;
	const reducedMotion = useMemo(hasReducedMotion, []);

	useEffect(() => {
		const timer = window.setTimeout(() => setReadyVisible(true), reducedMotion ? 420 : introDurationMs);
		return () => window.clearTimeout(timer);
	}, [reducedMotion]);

	return (
		<section className='relative z-10 mx-auto h-full w-full max-w-md overflow-hidden text-white sm:h-[760px] sm:max-h-full'>
			<div aria-hidden='true' className='versus-speed-lines' />
			<div aria-hidden='true' className='versus-blood-flash' />
			<div aria-hidden='true' className='versus-screen-vignette' />
			<div aria-hidden='true' className='versus-impact-burst' />
			<div aria-hidden='true' className='versus-impact-sparks'>
				{impactSparkStyles.map((style, index) => (
					<span className='versus-impact-spark' key={index} style={style} />
				))}
			</div>
			<motion.div
				animate={reducedMotion ? undefined : { x: [0, -10, 9, -5, 0], y: [0, 7, -6, 3, 0] }}
				className='relative h-full'
				transition={{ delay: 1.86, duration: 0.5, ease: 'easeOut' }}
			>
				<motion.article
					animate={{ x: 0, rotate: -4, scale: 1 }}
					className='absolute -left-10 top-14 z-10 flex h-[35%] w-[88%] origin-left flex-col justify-center overflow-hidden border-4 border-neutral-950 px-11 py-8 text-neutral-950 shadow-[10px_10px_0_rgb(0_0_0/0.5)]'
					initial={reducedMotion ? false : { x: '-112%', rotate: -14, scale: 0.96 }}
					style={panelStyle(firstOption.color, 'left')}
					transition={{ type: 'spring', stiffness: 130, damping: 15, delay: 0.16 }}
				>
					<motion.h1
						animate={{ opacity: 1, y: 0 }}
						className='break-words text-4xl font-black uppercase leading-[0.9] sm:text-5xl'
						initial={reducedMotion ? false : { opacity: 0, y: 24 }}
						transition={{ delay: 0.5, duration: 0.28 }}
					>
						{firstOption.name}
					</motion.h1>
				</motion.article>

				<motion.article
					animate={{ x: 0, rotate: 4, scale: 1 }}
					className='absolute -right-10 bottom-24 z-10 flex h-[35%] w-[88%] origin-right flex-col justify-center overflow-hidden border-4 border-neutral-950 px-11 py-8 text-right text-neutral-950 shadow-[-10px_-10px_0_rgb(0_0_0/0.5)]'
					initial={reducedMotion ? false : { x: '112%', rotate: 14, scale: 0.96 }}
					style={panelStyle(secondOption.color, 'right')}
					transition={{ type: 'spring', stiffness: 140, damping: 14, delay: 1.45 }}
				>
					<motion.h2
						animate={{ opacity: 1, y: 0 }}
						className='break-words text-4xl font-black uppercase leading-[0.9] sm:text-5xl'
						initial={reducedMotion ? false : { opacity: 0, y: -24 }}
						transition={{ delay: 1.82, duration: 0.28 }}
					>
						{secondOption.name}
					</motion.h2>
				</motion.article>

				<motion.div
					animate={
						reducedMotion
							? undefined
							: {
									opacity: [0, 1, 1],
									scale: [2.6, 0.82, 1],
									rotate: [-18, 4, -5],
								}
					}
					aria-label='versus'
					className='absolute left-1/2 top-[45.1%] z-40 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center'
					initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
					role='img'
					transition={{ delay: 0.96, duration: 0.62, times: [0, 0.58, 1] }}
				>
					<div
						aria-hidden='true'
						className='versus-mark text-[9.8rem] font-black uppercase italic leading-none sm:text-[12rem]'
						style={{ color: bloodRed }}
					>
						VS
					</div>
				</motion.div>

				<div aria-hidden='true' className='versus-slash versus-slash-a' />
				<div aria-hidden='true' className='versus-slash versus-slash-b' />
				<div aria-hidden='true' className='versus-slash versus-slash-c' />
			</motion.div>

			<AnimatePresence>
				{readyVisible ? (
					<motion.div
						animate={{ opacity: 1, scale: 1, y: 0 }}
						className='versus-ready-wrap absolute bottom-5 left-4 right-4 z-40 sm:bottom-4'
						exit={{ opacity: 0, scale: 0.92, y: 18 }}
						initial={reducedMotion ? false : { opacity: 0, scale: 0.55, y: 44, rotate: -2 }}
						transition={{ type: 'spring', stiffness: 340, damping: 13, mass: 0.72 }}
					>
						<div aria-hidden='true' className='versus-weld-line' />
						<div aria-hidden='true' className='versus-ready-sparks'>
							{readySparkStyles.map((style, index) => (
								<span className='versus-ready-spark' key={index} style={style} />
							))}
						</div>
						<Button className='versus-ready-button min-h-14 uppercase' onClick={onReady} theme='endAction'>
							my body is ready
						</Button>
					</motion.div>
				) : null}
			</AnimatePresence>
		</section>
	);
}
