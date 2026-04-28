import type { ButtonHTMLAttributes } from 'react';

export type ButtonTheme = 'dark' | 'endAction' | 'ghost' | 'primary' | 'secondary' | 'warning';
export type ButtonSize = 'icon' | 'md' | 'sm' | 'xl';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	size?: ButtonSize;
	theme?: ButtonTheme;
};

const sizes = {
	icon: 'h-11 w-11 p-0 text-base',
	md: 'min-h-11 px-3 py-2 text-sm',
	sm: 'min-h-9 px-2.5 py-1.5 text-sm',
	xl: 'min-h-12 px-4 py-3 text-base',
} satisfies Record<ButtonSize, string>;

const themes = {
	dark: {
		size: 'xl',
		className: 'border-neutral-950 bg-neutral-950 text-white shadow-[4px_4px_0_#171717]',
	},
	endAction: {
		size: 'xl',
		className: 'w-full border-neutral-950 bg-orange-300 text-neutral-950 shadow-[4px_4px_0_#171717]',
	},
	ghost: {
		size: 'xl',
		className: 'border-white/80 bg-transparent text-white shadow-none',
	},
	primary: {
		size: 'xl',
		className: 'border-neutral-950 bg-white text-neutral-950 shadow-[4px_4px_0_#171717]',
	},
	secondary: {
		size: 'xl',
		className: 'border-neutral-950 bg-white text-neutral-950 shadow-[3px_3px_0_#171717]',
	},
	warning: {
		size: 'xl',
		className: 'border-neutral-950 bg-yellow-200 text-neutral-950 shadow-[4px_4px_0_#171717]',
	},
} satisfies Record<ButtonTheme, { className: string; size: ButtonSize }>;

function joinClasses(...classes: Array<string | undefined>) {
	return classes.filter(Boolean).join(' ');
}

export function Button({ className, size, theme = 'primary', type = 'button', ...props }: ButtonProps) {
	const themeConfig = themes[theme];

	return (
		<button
			className={joinClasses(
				'inline-flex items-center justify-center rounded-lg border-2 font-black leading-tight transition-transform duration-75 disabled:scale-100 disabled:border-neutral-950 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:shadow-[2px_2px_0_#171717] active:scale-[0.985]',
				sizes[size ?? themeConfig.size],
				themeConfig.className,
				className,
			)}
			type={type}
			{...props}
		/>
	);
}
