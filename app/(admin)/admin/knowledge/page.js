"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Apple,
  BookOpen,
  CheckCircle2,
  Dumbbell,
  Eye,
  HeartPulse,
  Megaphone,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";

import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";

const emptyForm = {
  id: null,
  title: "",
  excerpt: "",
  content: "",
  image_url: "",
  category: "health",
  status: "published",
  is_featured: false,
};

const categories = [
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "nutrition", label: "Nutrition", icon: Apple },
  { id: "workout", label: "Workout", icon: Dumbbell },
  { id: "recovery", label: "Recovery", icon: ShieldCheck },
  { id: "announcement", label: "Update", icon: Megaphone },
];

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
  if (!value) return "Draft";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function getCategoryLabel(category) {
  return categories.find((item) => item.id === category)?.label || "Knowledge";
}

export default function AdminKnowledgePage() {
  const { user, role, selectedGym } = useAuthContext();
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const canManage = ["superadmin", "owner", "admin"].includes(role);

  const stats = useMemo(() => ({
    total: posts.length,
    published: posts.filter((post) => post.status === "published").length,
    draft: posts.filter((post) => post.status === "draft").length,
    featured: posts.filter((post) => post.is_featured).length,
  }), [posts]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return posts;
    return posts.filter((post) =>
      [post.title, post.excerpt, post.content, post.category]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [posts, searchQuery]);

  const fetchPosts = useCallback(async () => {
    const userId = getStoredUserId(user);
    if (!userId) {
      setLoading(false);
      setError("Please log in as a gym admin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/knowledge?admin=1", {
        headers: {
          "x-user-id": String(userId),
          ...(selectedGym?.id ? { "x-gym-id": String(selectedGym.id) } : {}),
        },
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to load knowledge posts");
      }

      setPosts(json.data || []);
    } catch (err) {
      setError(err.message || "Failed to load knowledge posts");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedGym?.id, user]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openCreateForm = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditForm = (post) => {
    setForm({
      id: post.id,
      title: post.title || "",
      excerpt: post.excerpt || "",
      content: post.content || "",
      image_url: post.image_url || "",
      category: post.category || "health",
      status: post.status || "published",
      is_featured: Boolean(post.is_featured),
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const userId = getStoredUserId(user);

    if (!canManage) {
      alert("Only gym admins can create knowledge posts.");
      return;
    }

    if (!form.title.trim() || !form.excerpt.trim() || !form.content.trim()) {
      alert("Please fill title, short summary, and full content.");
      return;
    }

    setSaving(true);

    try {
      const url = form.id ? `/api/knowledge/${form.id}` : "/api/knowledge";
      const response = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
          ...(selectedGym?.id ? { "x-gym-id": String(selectedGym.id) } : {}),
        },
        body: JSON.stringify({
          title: form.title,
          excerpt: form.excerpt,
          content: form.content,
          image_url: form.image_url,
          category: form.category,
          status: form.status,
          is_featured: form.is_featured,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to save knowledge post");
      }

      setFormOpen(false);
      setForm(emptyForm);
      await fetchPosts();
    } catch (err) {
      alert(err.message || "Failed to save knowledge post");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    const userId = getStoredUserId(user);
    if (!confirm(`Delete "${post.title}"?`)) return;

    try {
      const response = await fetch(`/api/knowledge/${post.id}`, {
        method: "DELETE",
        headers: {
          "x-user-id": String(userId),
          ...(selectedGym?.id ? { "x-gym-id": String(selectedGym.id) } : {}),
        },
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to delete knowledge post");
      }

      await fetchPosts();
    } catch (err) {
      alert(err.message || "Failed to delete knowledge post");
    }
  };

  const handleToggleStatus = async (post) => {
    const userId = getStoredUserId(user);
    const nextStatus = post.status === "published" ? "draft" : "published";

    try {
      const response = await fetch(`/api/knowledge/${post.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
          ...(selectedGym?.id ? { "x-gym-id": String(selectedGym.id) } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to update status");
      }

      await fetchPosts();
    } catch (err) {
      alert(err.message || "Failed to update status");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pb-24">
      <Header title="Knowledge Base" showBack={false} />

      <main className="px-3 py-3 space-y-4">
        <section className="mx-1 rounded-[28px] bg-gradient-to-br from-[#f0813d] via-[#d76621] to-[#9c4400] p-5 text-white shadow-[0_20px_50px_rgba(240,129,61,0.24)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                {canManage ? "Admin publishing" : "Gym knowledge"}
              </p>
              <h2 className="mt-2 text-2xl font-black leading-tight">
                {canManage ? "Share daily gym knowledge" : "Read gym knowledge"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Health, diet, workout, and recovery posts stay visible only inside this gym.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
              <BookOpen className="h-7 w-7" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-4 gap-2 px-1">
          {[
            { label: "Total", value: stats.total },
            { label: "Live", value: stats.published },
            { label: "Draft", value: stats.draft },
            { label: "Featured", value: stats.featured },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-3 text-center shadow-sm">
              <p className="text-lg font-black text-gray-900">{item.value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
                {item.label}
              </p>
            </div>
          ))}
        </section>

        <section className="mx-1 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search knowledge posts..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f0813d] to-[#9c4400] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(240,129,61,0.25)]"
            >
              <Plus className="h-5 w-5" />
              New Knowledge Post
            </button>
          )}
        </section>

        {loading ? (
          <div className="space-y-3 px-1">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="mx-1 rounded-2xl border border-orange-100 bg-orange-50 p-5 text-center text-sm font-semibold text-[#f0813d]">
            {error}
          </div>
        ) : (
          <section className="space-y-3 px-1">
            {filteredPosts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="mb-4 h-40 w-full rounded-2xl object-cover"
                    loading="lazy"
                  />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-600">
                        {getCategoryLabel(post.category)}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        post.status === "published"
                          ? "bg-orange-50 text-[#f0813d]"
                          : "bg-orange-50 text-[#f0813d]"
                      }`}>
                        {post.status === "published" ? <CheckCircle2 className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                        {post.status === "published" ? "Live" : "Draft"}
                      </span>
                      {post.is_featured && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-[#f0813d]">
                          <Star className="h-3 w-3" />
                          Featured
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 line-clamp-2 font-bold text-gray-900">{post.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{post.excerpt}</p>
                    <p className="mt-3 text-xs font-medium text-gray-400">
                      {formatDate(post.published_at || post.created_at)} by {post.author_name || "Gym Admin"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 overflow-x-auto border-t border-gray-100 pt-3 no-scrollbar">
                  <a
                    href={post.id ? `/knowledge/${post.id}` : "#"}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-[#f0813d]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </a>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditForm(post)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(post)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-[#f0813d]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {post.status === "published" ? "Move to Draft" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(post)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-[#f0813d]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}

            {filteredPosts.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 font-semibold text-gray-900">No knowledge posts yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Create the first daily health or diet post for this gym.
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/50 p-3 sm:items-center sm:justify-center">
          <form
            onSubmit={handleSubmit}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                  {form.id ? "Edit post" : "New post"}
                </p>
                <h3 className="text-lg font-black text-gray-900">Knowledge Post</h3>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <label className="block">
                <span className="text-sm font-bold text-gray-800">Title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  maxLength={255}
                  required
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-orange-100"
                  placeholder="Example: Simple protein snacks after workout"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-800">Short summary</span>
                <textarea
                  value={form.excerpt}
                  onChange={(event) => updateForm("excerpt", event.target.value)}
                  required
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-orange-100"
                  placeholder="A quick preview members will see in the list."
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-800">Full content</span>
                <textarea
                  value={form.content}
                  onChange={(event) => updateForm("content", event.target.value)}
                  required
                  rows={8}
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-orange-100"
                  placeholder="Write the full health, diet, workout, or recovery guidance."
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-800">Image URL</span>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(event) => updateForm("image_url", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-orange-100"
                  placeholder="https://example.com/knowledge-image.jpg"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Optional. Paste a gym, workout, nutrition, or health image link.
                </span>
              </label>

              {form.image_url && (
                <img
                  src={form.image_url}
                  alt="Knowledge image preview"
                  className="h-44 w-full rounded-2xl border border-gray-100 object-cover"
                />
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-gray-800">Category</span>
                  <select
                    value={form.category}
                    onChange={(event) => updateForm("category", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-orange-100"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-gray-800">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#f0813d] focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <span>
                  <span className="block text-sm font-bold text-gray-900">Featured post</span>
                  <span className="block text-xs text-gray-500">Show it in the highlighted row for members.</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(event) => updateForm("is_featured", event.target.checked)}
                  className="h-5 w-5 accent-[#f0813d]"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f0813d] to-[#9c4400] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(240,129,61,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : form.id ? "Save Changes" : "Publish Knowledge"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
