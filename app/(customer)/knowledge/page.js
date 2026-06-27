"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Apple,
  BookOpen,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";

const categories = [
  { id: "all", name: "All", icon: BookOpen },
  { id: "health", name: "Health", icon: HeartPulse },
  { id: "nutrition", name: "Nutrition", icon: Apple },
  { id: "workout", name: "Workout", icon: Dumbbell },
  { id: "recovery", name: "Recovery", icon: ShieldCheck },
  { id: "announcement", name: "Updates", icon: Megaphone },
];

const categoryStyles = {
  health: "bg-orange-50 text-[#f0813d] border-orange-100",
  nutrition: "bg-orange-50 text-[#f0813d] border-orange-100",
  workout: "bg-orange-50 text-[#f0813d] border-orange-100",
  recovery: "bg-orange-50 text-[#f0813d] border-orange-100",
  announcement: "bg-orange-50 text-[#f0813d] border-orange-100",
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
  });
}

function estimateReadTime(content = "") {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 180))} min`;
}

function CategoryIcon({ category, className = "w-5 h-5" }) {
  const found = categories.find((item) => item.id === category);
  const Icon = found?.icon || BookOpen;
  return <Icon className={className} />;
}

export default function KnowledgePage() {
  const router = useRouter();
  const { user, selectedGym } = useAuthContext();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = getStoredUserId(user);
    if (!userId) {
      setLoading(false);
      setError("Please log in to view knowledge posts.");
      return;
    }

    const controller = new AbortController();

    async function fetchPosts() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      try {
        const response = await fetch(`/api/knowledge?${params.toString()}`, {
          headers: {
            "x-user-id": String(userId),
            ...((selectedGym?.id || user?.gym_id) ? { "x-gym-id": String(selectedGym?.id || user?.gym_id) } : {}),
          },
          signal: controller.signal,
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Failed to load knowledge posts");
        }

        setPosts(json.data || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load knowledge posts");
          setPosts([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchPosts();
    return () => controller.abort();
  }, [activeCategory, searchQuery, selectedGym?.id, user]);

  const featuredPosts = useMemo(
    () => posts.filter((post) => post.is_featured).slice(0, 5),
    [posts]
  );

  const latestUpdate = useMemo(
    () => posts.find((post) => post.category === "announcement"),
    [posts]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pb-24">
      <Header title="Knowledge Hub" showBack={false} />

      <main className="px-4 py-4 space-y-4">
        <section className="rounded-[28px] bg-gradient-to-br from-[#f0813d] via-[#d76621] to-[#9c4400] p-5 text-white shadow-[0_20px_50px_rgba(240,129,61,0.24)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                Daily guidance
              </p>
              <h2 className="mt-2 text-2xl font-black leading-tight">
                Health, diet and workout knowledge
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Curated by your gym admin for your gym community.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>
        </section>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search health, diet, workout..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-orange-100"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {latestUpdate && activeCategory === "all" && !searchQuery && (
          <button
            type="button"
            onClick={() => latestUpdate.id && router.push(`/knowledge/${latestUpdate.id}`)}
            className="w-full rounded-2xl border border-orange-100 bg-orange-50 p-4 text-left active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2 text-[#f0813d]">
              <Megaphone className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-[0.14em]">
                Gym update
              </span>
            </div>
            <p className="mt-2 font-bold text-gray-900">{latestUpdate.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">
              {latestUpdate.excerpt}
            </p>
          </button>
        )}

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-[#1a1c1c] text-white"
                    : "border border-gray-200 bg-white text-gray-600"
                }`}
              >
                <Icon className="h-4 w-4" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5 text-center">
            <p className="text-sm font-semibold text-[#f0813d]">{error}</p>
          </div>
        ) : (
          <>
            {featuredPosts.length > 0 && activeCategory === "all" && !searchQuery && (
              <section>
                <h3 className="mb-3 font-bold text-gray-900">Featured</h3>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
                  {featuredPosts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => post.id && router.push(`/knowledge/${post.id}`)}
                      className="min-w-[260px] overflow-hidden rounded-2xl bg-white text-left shadow-sm"
                    >
                      {post.image_url ? (
                        <img
                          src={post.image_url}
                          alt={post.title}
                          className="h-28 w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-[#1a1c1c] to-[#3a302b] text-white">
                          <CategoryIcon category={post.category} className="h-9 w-9" />
                        </div>
                      )}
                      <div className="p-4">
                        <p className="line-clamp-2 font-bold text-gray-900">{post.title}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {estimateReadTime(post.content)} read | {formatDate(post.published_at || post.created_at)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 font-bold text-gray-900">
                {activeCategory === "all"
                  ? "Latest Posts"
                  : categories.find((cat) => cat.id === activeCategory)?.name}
              </h3>
              <div className="space-y-3">
                {posts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => post.id && router.push(`/knowledge/${post.id}`)}
                    className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                  >
                    <div className="flex gap-3">
                      {post.image_url ? (
                        <img
                          src={post.image_url}
                          alt={post.title}
                          className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${categoryStyles[post.category] || "bg-gray-50 text-gray-700 border-gray-100"}`}>
                          <CategoryIcon category={post.category} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 font-bold text-gray-900">
                            {post.title}
                          </p>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                          {post.excerpt}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                          <span>{estimateReadTime(post.content)} read</span>
                          <span>|</span>
                          <span>{formatDate(post.published_at || post.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {posts.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 font-semibold text-gray-900">No posts yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Your gym admin has not published knowledge posts for this category.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
