"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);

	const handleRegister = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setLoading(false);
			return;
		}

		if (password.length < 6) {
			setError("Password must be at least 6 characters");
			setLoading(false);
			return;
		}

		// Mock registration - in real app, this would call Supabase
		// For now, just simulate success and redirect to login
		setTimeout(() => {
			setLoading(false);
			router.push("/auth/login");
		}, 1000);
	};

	return (
		<div className="relative w-full min-h-screen text-white flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-y-auto">
			{/* Full Background Image */}
			<Image
				src="/bgimages/loginbg.png"
				alt="Machine background"
				fill
				priority
				quality={100}
				className="object-cover"
			/>

			{/* Gradient overlay */}
			<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />
			<div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white/80 via-white/40 to-transparent blur-xl" />

			{/* Content Container */}
			<div className="relative z-10 w-full max-w-md mx-auto px-6 py-12 flex items-center justify-center min-h-screen">
				<div className="w-full space-y-6 bg-black/50 backdrop-blur-md rounded-2xl p-6 sm:p-8 max-h-[calc(100vh-3rem)] overflow-y-auto">
					<div>
						<h1 className="text-3xl sm:text-4xl font-bold leading-tight">
							Create Account
						</h1>
						<p className="text-sm sm:text-base text-white/80 mt-2">
							Join us to get started
						</p>
					</div>

					<form onSubmit={handleRegister} className="space-y-4">
						<div>
							<label className="block text-xs sm:text-sm font-medium text-white/90 mb-2">
								Full Name
							</label>
							<input
								type="text"
								className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none transition text-sm"
								placeholder="Enter your name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
							/>
						</div>

						<div>
							<label className="block text-xs sm:text-sm font-medium text-white/90 mb-2">
								Email
							</label>
							<input
								type="email"
								className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none transition text-sm"
								placeholder="Enter your email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>

						<div>
							<label className="block text-xs sm:text-sm font-medium text-white/90 mb-2">
								Password
							</label>
							<input
								type="password"
								className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none transition text-sm"
								placeholder="Enter your password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>

						<div>
							<label className="block text-xs sm:text-sm font-medium text-white/90 mb-2">
								Confirm Password
							</label>
							<input
								type="password"
								className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none transition text-sm"
								placeholder="Confirm your password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
							/>
						</div>

						{error && (
							<div className="bg-[#f0813d]/20 text-orange-200 px-3 py-2 rounded-lg text-xs sm:text-sm border border-[#f0813d]/30">
								{error}
							</div>
						)}

						<button
							type="submit"
							disabled={loading}
							className="w-full bg-white text-black py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-gray-100 transition disabled:opacity-50 text-sm sm:text-base"
						>
							{loading ? "Creating account..." : "Sign Up"}
						</button>
					</form>

					<p className="text-center text-xs sm:text-sm text-white/80">
						Already have an account?{" "}
						<Link href="/auth/login" className="font-semibold underline">
							Sign In
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
