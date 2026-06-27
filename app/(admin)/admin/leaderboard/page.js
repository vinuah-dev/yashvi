"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/contexts/ToastContext";
import {
  Flame, Trophy, Medal, Calendar, TrendingUp, Crown, Star,
  Eye, EyeOff, RotateCcw, Search, ChevronDown, ChevronUp,
  Users, Plus, X, Zap, Target, Clock, Award, Trash2, Edit3,
  CheckCircle, AlertTriangle, Dumbbell, BarChart3, Percent,
} from "lucide-react";

// ─── Challenge Type Config ───────────────────────────────────
const CHALLENGE_TYPES = {
  streak: { label: "Longest Streak", icon: <Flame className="w-4 h-4" />, color: "text-[#f0813d]", bg: "bg-orange-50", unit: "days" },
  total_days: { label: "Most Days", icon: <Calendar className="w-4 h-4" />, color: "text-[#f0813d]", bg: "bg-orange-50", unit: "days" },
  consistency: { label: "Consistency %", icon: <Percent className="w-4 h-4" />, color: "text-[#f0813d]", bg: "bg-orange-50", unit: "%" },
  custom: { label: "Custom", icon: <Dumbbell className="w-4 h-4" />, color: "text-[#f0813d]", bg: "bg-orange-50", unit: "" },
};

// ─── Avatar ──────────────────────────────────────────────────
function MemberAvatar({ name, image, size = "w-10 h-10" }) {
  const initials = (name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  if (image) return <img src={image} alt={name} className={`${size} rounded-full object-cover`} />;
  const colors = ["from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]"];
  return (
    <div className={`${size} rounded-full bg-gradient-to-br ${colors[(name || "").charCodeAt(0) % colors.length]} flex items-center justify-center text-white font-bold text-sm`}>
      {initials}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    active: { bg: "bg-orange-100 text-[#f0813d]", label: "Active" },
    upcoming: { bg: "bg-orange-100 text-[#f0813d]", label: "Upcoming" },
    ended: { bg: "bg-gray-100 text-gray-600", label: "Ended" },
  };
  const c = config[status] || config.ended;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg}`}>{c.label}</span>;
}

// ─── Create Challenge Modal ──────────────────────────────────
function CreateChallengeModal({ open, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("streak");
  const [customUnit, setCustomUnit] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState(7);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const endDate = new Date(new Date(startDate).getTime() + (duration - 1) * 86400000).toISOString().split("T")[0];

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onCreate({
      title: title.trim(),
      description: description.trim() || null,
      challenge_type: type,
      custom_unit: type === "custom" ? customUnit.trim() || null : null,
      start_date: startDate,
      end_date: endDate,
    });
    setSaving(false);
    setTitle(""); setDescription(""); setType("streak"); setCustomUnit(""); setDuration(7);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">New Challenge</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Challenge Title *</label>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. January Streak Challenge"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What's this challenge about?"
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d] resize-none"
            />
          </div>

          {/* Challenge Type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Challenge Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CHALLENGE_TYPES).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    type === key ? "border-[#f0813d] bg-orange-50 text-[#f0813d]" : "border-gray-200 text-gray-600"
                  }`}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Unit */}
          {type === "custom" && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Score Unit</label>
              <input
                type="text" value={customUnit} onChange={e => setCustomUnit(e.target.value)}
                placeholder="e.g. kg, reps, minutes"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
              />
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Duration</label>
            <div className="flex gap-2">
              {[7, 14, 21, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    duration === d ? "bg-[#f0813d] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
            <input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]"
            />
            <p className="text-xs text-gray-400 mt-1">Ends: {endDate}</p>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreate}
            disabled={!title.trim() || saving}
            className="w-full py-3 bg-[#f0813d] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Score Update Modal (for custom challenges) ──────────────
function UpdateScoreModal({ open, onClose, onSave, member, currentScore, unit }) {
  const [score, setScore] = useState(currentScore || 0);
  const [notes, setNotes] = useState("");

  useEffect(() => { setScore(currentScore || 0); }, [currentScore]);

  if (!open || !member) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
        <h3 className="font-bold text-gray-900 mb-1">Update Score</h3>
        <p className="text-sm text-gray-500 mb-4">{member.full_name}</p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Score {unit ? `(${unit})` : ""}</label>
            <input
              type="number" value={score} onChange={e => setScore(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Cancel</button>
            <button onClick={() => { onSave(score, notes); onClose(); }} className="flex-1 py-2.5 bg-[#f0813d] text-white rounded-xl text-sm font-medium">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function AdminLeaderboardPage() {
  const router = useRouter();
  const { user, selectedGym, isReady } = useAuthContext();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("streaks"); // "streaks" | "challenges"
  const [loading, setLoading] = useState(true);

  // Streak leaderboard state
  const [leaderboard, setLeaderboard] = useState([]);
  const [hiddenMembers, setHiddenMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("current");
  const [showHidden, setShowHidden] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Challenge state
  const [challenges, setChallenges] = useState([]);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [challengeLeaderboard, setChallengeLeaderboard] = useState([]);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scoreModal, setScoreModal] = useState(null);

  const [confirmAction, setConfirmAction] = useState(null);
  const [processing, setProcessing] = useState(false);

  const gymId = selectedGym?.id;

  // ─── Fetch Streak Leaderboard ──────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    if (!gymId) return;
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        body: JSON.stringify({ p_gym_id: gymId, admin_view: true }),
      });
      const json = await res.json();
      if (res.ok) setLeaderboard(json.data?.leaderboard || []);
    } catch {}
  }, [gymId, user?.id]);

  const fetchHiddenMembers = useCallback(async () => {
    if (!gymId) return;
    try {
      const { data } = await supabase.from("leaderboard_settings").select("member_id").eq("gym_id", gymId).eq("is_hidden", true);
      setHiddenMembers((data || []).map(d => d.member_id));
    } catch { setHiddenMembers([]); }
  }, [gymId]);

  // ─── Fetch Challenges ──────────────────────────────────────
  const fetchChallenges = useCallback(async () => {
    if (!gymId) return;
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        body: JSON.stringify({ action: "list", p_gym_id: gymId }),
      });
      const json = await res.json();
      if (res.ok) setChallenges(json.data || []);
    } catch {}
  }, [gymId, user?.id]);

  // ─── Fetch Challenge Leaderboard ───────────────────────────
  const fetchChallengeLeaderboard = useCallback(async (challengeId) => {
    setChallengeLoading(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        body: JSON.stringify({ action: "leaderboard", challenge_id: challengeId }),
      });
      const json = await res.json();
      if (res.ok) setChallengeLeaderboard(json.data?.leaderboard || []);
    } catch {}
    setChallengeLoading(false);
  }, [user?.id]);

  // ─── Initial Load ──────────────────────────────────────────
  useEffect(() => {
    if (gymId && isReady) {
      Promise.all([fetchLeaderboard(), fetchHiddenMembers(), fetchChallenges()]).then(() => setLoading(false));
    } else if (isReady) { setLoading(false); }
  }, [gymId, isReady, fetchLeaderboard, fetchHiddenMembers, fetchChallenges]);

  // ─── Create Challenge ──────────────────────────────────────
  const handleCreateChallenge = async (data) => {
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        body: JSON.stringify({ action: "create", ...data }),
      });
      if (res.ok) {
        showToast("Challenge created!", "success");
        fetchChallenges();
      } else {
        const json = await res.json();
        showToast(json.error || "Failed", "error");
      }
    } catch { showToast("Failed to create", "error"); }
  };

  // ─── Delete Challenge ──────────────────────────────────────
  const handleDeleteChallenge = async (id) => {
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        body: JSON.stringify({ action: "delete", challenge_id: id }),
      });
      if (res.ok) {
        showToast("Challenge deleted", "success");
        setChallenges(prev => prev.filter(c => c.id !== id));
        if (selectedChallenge?.id === id) { setSelectedChallenge(null); setChallengeLeaderboard([]); }
      }
    } catch { showToast("Failed to delete", "error"); }
    setConfirmAction(null);
  };

  // ─── End Challenge ─────────────────────────────────────────
  const handleEndChallenge = async (id) => {
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        body: JSON.stringify({ action: "update", challenge_id: id, end_date: new Date().toISOString().split("T")[0] }),
      });
      if (res.ok) { showToast("Challenge ended", "success"); fetchChallenges(); }
    } catch { showToast("Failed", "error"); }
  };

  // ─── Update Score ──────────────────────────────────────────
  const handleUpdateScore = async (memberId, score, notes) => {
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        body: JSON.stringify({ action: "update_score", challenge_id: selectedChallenge.id, member_id: memberId, score, notes }),
      });
      if (res.ok) {
        showToast("Score updated", "success");
        fetchChallengeLeaderboard(selectedChallenge.id);
      }
    } catch { showToast("Failed", "error"); }
  };

  // ─── Hide/Show Member ──────────────────────────────────────
  const toggleHideMember = async (memberId, name, hide) => {
    setProcessing(true);
    try {
      if (hide) {
        await supabase.from("leaderboard_settings").upsert({ gym_id: gymId, member_id: memberId, is_hidden: true }, { onConflict: "gym_id,member_id" });
        setHiddenMembers(prev => [...prev, memberId]);
      } else {
        await supabase.from("leaderboard_settings").delete().eq("gym_id", gymId).eq("member_id", memberId);
        setHiddenMembers(prev => prev.filter(id => id !== memberId));
      }
      showToast(`${name} ${hide ? "hidden" : "visible"}`, "success");
    } catch { showToast("Failed", "error"); }
    setProcessing(false); setConfirmAction(null);
  };

  // ─── Sorted streak list ────────────────────────────────────
  const sorted = useMemo(() => {
    let list = [...leaderboard];
    if (searchQuery.trim()) list = list.filter(m => m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!showHidden) list = list.filter(m => !hiddenMembers.includes(m.id));
    if (sortBy === "current") list.sort((a, b) => b.current_streak - a.current_streak || b.best_streak - a.best_streak);
    else if (sortBy === "best") list.sort((a, b) => b.best_streak - a.best_streak);
    else list.sort((a, b) => b.days_last_30 - a.days_last_30);
    return list;
  }, [leaderboard, searchQuery, sortBy, showHidden, hiddenMembers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Header title="Leaderboard" />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 mb-17 safe-area-inset-bottom">
      <Header title="Leaderboard" />
      <main className="px-3 py-2 space-y-3">

        {/* ── Main Tabs: Streaks vs Challenges ────────────── */}
        <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm border border-gray-100">
          <button
            onClick={() => setActiveTab("streaks")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "streaks" ? "bg-[#f0813d] text-white shadow-md" : "text-gray-500"
            }`}
          >
            <Flame className="w-4 h-4" /> Streaks
          </button>
          <button
            onClick={() => { setActiveTab("challenges"); if (challenges.length === 0) fetchChallenges(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "challenges" ? "bg-[#f0813d] text-white shadow-md" : "text-gray-500"
            }`}
          >
            <Zap className="w-4 h-4" /> Challenges
            {challenges.filter(c => c.status === "active").length > 0 && (
              <span className={`px-1.5 rounded-full text-xs ${activeTab === "challenges" ? "bg-white/30" : "bg-orange-100 text-[#f0813d]"}`}>
                {challenges.filter(c => c.status === "active").length}
              </span>
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* ── STREAKS TAB ──────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === "streaks" && (
          <>
            {/* Search + Sort */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search members..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 focus:border-[#f0813d]" />
              </div>
              <div className="flex gap-2">
                <div className="flex gap-1 flex-1 p-1 bg-white rounded-xl border border-gray-100">
                  {[
                    { key: "current", label: "Current", icon: <Flame className="w-3 h-3" /> },
                    { key: "best", label: "Best", icon: <Trophy className="w-3 h-3" /> },
                    { key: "monthly", label: "Month", icon: <Calendar className="w-3 h-3" /> },
                  ].map(t => (
                    <button key={t.key} onClick={() => setSortBy(t.key)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${sortBy === t.key ?"bg-[#f0813d] text-white" :"text-gray-500"}`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowHidden(!showHidden)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 ${showHidden ? "bg-orange-50 border-orange-200 text-[#f0813d]" : "bg-white border-gray-200 text-gray-500"}`}>
                  {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {hiddenMembers.length > 0 && <span className="bg-orange-200 text-orange-800 px-1.5 rounded-full text-xs">{hiddenMembers.length}</span>}
                </button>
              </div>
            </div>

            {/* Streak list */}
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <Trophy className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">{searchQuery ? "No match" : "No streak data yet"}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {sorted.map((member, i) => {
                  const rank = i + 1;
                  const isHidden = hiddenMembers.includes(member.id);
                  const isExpanded = expandedId === member.id;
                  const val = sortBy === "current" ? member.current_streak : sortBy === "best" ? member.best_streak : member.days_last_30;
                  return (
                    <div key={member.id}>
                      <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50 ${isHidden ? "opacity-50" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : member.id)}>
                        <span className="w-6 text-center text-sm font-bold text-gray-400">
                          {rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : `#${rank}`}
                        </span>
                        <MemberAvatar name={member.full_name} image={member.profile_image} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 truncate">{member.full_name}</p>
                          <p className="text-xs text-gray-400">Best: {member.best_streak}d • {member.days_last_30}d/mo</p>
                        </div>
                        <span className="text-lg font-black text-gray-800">{val}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 bg-gray-50/50 flex gap-2 pl-12">
                          <button onClick={() => router.push(`/members/${member.id}`)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> Profile
                          </button>
                          <button onClick={() => setConfirmAction({ type: isHidden ? "show" : "hide", memberId: member.id, memberName: member.full_name })}
                            className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 border ${isHidden ? "bg-orange-50 border-orange-200 text-[#f0813d]" : "bg-orange-50 border-orange-200 text-[#f0813d]"}`}>
                            {isHidden ? <><Eye className="w-3.5 h-3.5" /> Show</> : <><EyeOff className="w-3.5 h-3.5" /> Hide</>}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ── CHALLENGES TAB ───────────────────────────────── */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === "challenges" && (
          <>
            {/* Create button */}
            <button onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform shadow-md shadow-orange-200/40">
              <Plus className="w-4 h-4" /> Create New Challenge
            </button>

            {/* Challenge list */}
            {challenges.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <Zap className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No challenges yet</p>
                <p className="text-gray-400 text-xs">Create one to get your members competing!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {challenges.map(challenge => {
                  const cfg = CHALLENGE_TYPES[challenge.challenge_type] || CHALLENGE_TYPES.custom;
                  const isSelected = selectedChallenge?.id === challenge.id;
                  const progress = challenge.days_total > 0 ? Math.round((challenge.days_elapsed / challenge.days_total) * 100) : 0;

                  return (
                    <div key={challenge.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {/* Challenge Header */}
                      <div className="p-4 cursor-pointer active:bg-gray-50" onClick={() => {
                        if (isSelected) { setSelectedChallenge(null); setChallengeLeaderboard([]); }
                        else { setSelectedChallenge(challenge); fetchChallengeLeaderboard(challenge.id); }
                      }}>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-bold text-gray-900 text-sm truncate">{challenge.title}</h3>
                              <StatusBadge status={challenge.status} />
                            </div>
                            {challenge.description && <p className="text-xs text-gray-500 line-clamp-1">{challenge.description}</p>}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {challenge.days_total}d</span>
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {challenge.participant_count}</span>
                              {challenge.status === "active" && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {challenge.days_remaining}d left</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {challenge.status === "active" && (
                              <button onClick={e => { e.stopPropagation(); handleEndChallenge(challenge.id); }}
                                className=" icon-badge w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#f0813d]">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); setConfirmAction({ type: "deleteChallenge", id: challenge.id, name: challenge.title }); }}
                              className=" icon-badge w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#f0813d]">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {/* Progress bar */}
                        {challenge.status === "active" && (
                          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#f0813d] to-[#f0813d] rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>

                      {/* Challenge Leaderboard */}
                      {isSelected && (
                        <div className="border-t border-gray-100">
                          {challengeLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="w-8 h-8 border-3 border-[#f0813d] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : challengeLeaderboard.length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-gray-400 text-sm">No participants yet</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {challengeLeaderboard.map((m, i) => (
                                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <span className="w-6 text-center text-sm font-bold text-gray-400">
                                    {i < 3 ? ["🥇","🥈","🥉"][i] : `#${i+1}`}
                                  </span>
                                  <MemberAvatar name={m.full_name} image={m.profile_image} size="w-8 h-8" />
                                  <p className="flex-1 text-sm font-medium text-gray-800 truncate">{m.full_name}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-gray-800">
                                      {m.score}{challenge.challenge_type === "consistency" ? "%" : ""} {challenge.custom_unit || cfg.unit}
                                    </span>
                                    {challenge.challenge_type === "custom" && (
                                      <button onClick={() => setScoreModal({ member: m, score: m.score })}
                                        className=" icon-badge w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center text-[#f0813d]">
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {/* Add participant button for custom */}
                              {challenge.challenge_type === "custom" && (
                                <div className="p-3">
                                  <button onClick={() => setScoreModal({ member: null, score: 0, pickMember: true })}
                                    className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-xs font-medium text-gray-500 flex items-center justify-center gap-1">
                                    <Plus className="w-3.5 h-3.5" /> Add Participant
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="h-4"></div>
      </main>

      {/* Create Challenge Modal */}
      <CreateChallengeModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreateChallenge} />

      {/* Score Update Modal */}
      {scoreModal && !scoreModal.pickMember && (
        <UpdateScoreModal
          open={!!scoreModal} onClose={() => setScoreModal(null)}
          member={scoreModal.member} currentScore={scoreModal.score}
          unit={selectedChallenge?.custom_unit}
          onSave={(score, notes) => handleUpdateScore(scoreModal.member.id, score, notes)}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmAction.type ==="deleteChallenge" ?"bg-orange-100" :"bg-orange-100"}`}>
                <AlertTriangle className={`w-5 h-5 ${confirmAction.type === "deleteChallenge" ? "text-white" : "text-white"}`} />
              </div>
              <h3 className="font-bold text-gray-900">
                {confirmAction.type === "deleteChallenge" ? "Delete Challenge" : confirmAction.type === "hide" ? "Hide Member" : "Show Member"}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {confirmAction.type === "deleteChallenge"
                ? `Delete "${confirmAction.name}"? This cannot be undone.`
                : `${confirmAction.type === "hide" ? "Hide" : "Show"} ${confirmAction.memberName} on the leaderboard?`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={() => {
                if (confirmAction.type === "deleteChallenge") handleDeleteChallenge(confirmAction.id);
                else toggleHideMember(confirmAction.memberId, confirmAction.memberName, confirmAction.type === "hide");
              }} className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white ${confirmAction.type === "deleteChallenge" ? "bg-[#f0813d]" : "bg-[#f0813d]"}`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
