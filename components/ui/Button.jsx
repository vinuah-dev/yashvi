"use client";

import clsx from "clsx";

const baseStyles =
	"inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const variants = {
	primary:
		"bg-white text-black hover:bg-gray-100 focus-visible:outline-white disabled:opacity-60 disabled:cursor-not-allowed",
	ghost:
		"bg-white/10 text-white hover:bg-white/20 border border-white/30 focus-visible:outline-white disabled:opacity-60 disabled:cursor-not-allowed",
	light:
		"bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 focus-visible:outline-black disabled:opacity-60 disabled:cursor-not-allowed",
};

export function Button({
	className,
	variant = "primary",
	children,
	asChild,
	...props
}) {
	const buttonClasses = clsx(
		baseStyles,
		variants[variant] ?? variants.primary,
		className
	);

	// If asChild is true, apply button classes to child element
	if (asChild && children) {
		return <div className={buttonClasses}>{children}</div>;
	}

	return (
		<button className={buttonClasses} {...props}>
			{children}
		</button>
	);
}
