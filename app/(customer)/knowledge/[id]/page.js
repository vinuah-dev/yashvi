"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Apple,
  BookOpen,
  CalendarDays,
  Dumbbell,
  HeartPulse,
  Megaphone,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";

const categoryConfig = {
  health: { label: "Health", icon: HeartPulse, className: "bg-orange-50 text-[#f0813d] border-orange-100" },
  nutrition: { label: "Nutrition", icon: Apple, className: "bg-orange-50 text-[#f0813d] border-orange-100" },
  workout: { label: "Workout", icon: Dumbbell, className: "bg-orange-50 text-[#f0813d] border-orange-100" },
  recovery: { label: "Recovery", icon: ShieldCheck, className: "bg-orange-50 text-[#f0813d] border-orange-100" },
  announcement: { label: "Update", icon: Megaphone, className: "bg-orange-50 text-[#f0813d] border-orange-100" },
};

function getStoredUserId(user) {
  if (user?.id) return user.id;
  if (typeof window === "undefined") return "";

  try {
    return JSON.parse(localStorage.getItem("gymUser") || "{}")?.id || "";
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "Today";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function estimateReadTime(content = "") {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 180))} min read`;
}

export default function ArticleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, selectedGym } = useAuthContext();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = getStoredUserId(user);
    if (!userId || !id) {
      setLoading(false);
      setError("Please log in to view this post.");
      return;
    }

    async function fetchPost() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/knowledge/${id}`, {
          headers: {
            "x-user-id": String(userId),
            ...((selectedGym?.id || user?.gym_id) ? { "x-gym-id": String(selectedGym?.id || user?.gym_id) } : {}),
          },
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Knowledge post not found");
        }

        setPost(json.data);
      } catch (err) {
        setError(err.message || "Knowledge post not found");
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [id, selectedGym?.id, user]);

  const config = categoryConfig[post?.category] || {
    label: "Knowledge",
    icon: BookOpen,
    className: "bg-gray-50 text-gray-700 border-gray-100",
  };
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pb-24">
      <Header title="Knowledge" />

      <main className="px-4 py-4">
        {loading ? (
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-[28px] bg-white" />
            <div className="h-96 animate-pulse rounded-2xl bg-white" />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 font-semibold text-gray-900">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/knowledge")}
              className="mt-5 rounded-xl bg-[#1a1c1c] px-5 py-3 text-sm font-bold text-white"
            >
              Back to Knowledge Hub
            </button>
          </div>
        ) : (
          <article className="space-y-4">
            <section className="rounded-[28px] bg-gradient-to-br from-[#1a1c1c] via-[#2d2926] to-[#9c4400] p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.16)]">
              {post.image_url && (
                <img
                  src={post.image_url}
                  alt={post.title}
                  className="mb-5 h-56 w-full rounded-3xl object-cover"
                />
              )}
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${config.className}`}>
                <Icon className="h-4 w-4" />
                {config.label}
              </span>
              <h1 className="mt-4 text-2xl font-black leading-tight">{post.title}</h1>
              <p className="mt-3 text-sm leading-6 text-white/75">{post.excerpt}</p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <UserCircle className="h-4 w-4" />
                  {post.author_name || "Gym Admin"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(post.published_at || post.created_at)}
                </span>
                <span>{estimateReadTime(post.content)}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="prose prose-sm max-w-none">
                {post.content.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index} className="mb-4 whitespace-pre-line text-[15px] leading-7 text-gray-700 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          </article>
        )}
      </main>
    </div>
  );
}
