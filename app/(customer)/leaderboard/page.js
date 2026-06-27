"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  Flame, Trophy, Calendar, Crown, Star, Zap,
  Clock, Users, TrendingUp, Dumbbell, Percent,
} from "lucide-react";

const CHALLENGE_TYPES = {
  streak: { label: "Streak", icon: <Flame className="w-3.5 h-3.5" />, color: "text-[#f0813d]", bg: "bg-orange-50", unit: "days" },
  total_days: { label: "Days", icon: <Calendar className="w-3.5 h-3.5" />, color: "text-[#f0813d]", bg: "bg-orange-50", unit: "days" },
  consistency: { label: "Consistency", icon: <Percent className="w-3.5 h-3.5" />, color: "text-[#f0813d]", bg: "bg-orange-50", unit: "%" },
  custom: { label: "Custom", icon: <Dumbbell className="w-3.5 h-3.5" />, color: "text-[#f0813d]", bg: "bg-orange-50", unit: "" },
};

function MemberAvatar({ name, image, rank, size = "w-11 h-11" }) {
  const initials = (name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const ring = rank === 1 ? "ring-[#f0813d] ring-2" : rank === 2 ? "ring-gray-300 ring-2" : rank === 3 ? "ring-[#f0813d] ring-2" : "";
  if (image) return <img src={image} alt={name} className={`${size} rounded-full object-cover ${ring}`} />;
  const colors = ["from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]", "from-[#f0813d] to-[#f0813d]"];
  return <div className={`${size} rounded-full bg-gradient-to-br ${colors[(name || "").charCodeAt(0) % colors.length]} flex items-center justify-center text-white font-bold text-sm ${ring}`}>{initials}</div>;
}

function Podium({ top3, myId }) {
  if (top3.length === 0) return null;
  const order = [];
  if (top3[1]) order.push({ ...top3[1], rank: 2 });
  if (top3[0]) order.push({ ...top3[0], rank: 1 });
  if (top3[2]) order.push({ ...top3[2], rank: 3 });
  const heights = { 1: "h-24", 2: "h-18", 3: "h-14" };
  const bg = { 1: "bg-gradient-to-t from-[#f0813d] to-[#f0813d]", 2: "bg-gradient-to-t from-gray-300 to-gray-200", 3: "bg-gradient-to-t from-[#f0813d] to-orange-200" };

  return (
    <div className="flex items-end justify-center gap-2 px-4 pt-4 pb-2">
      {order.map(m => (
        <div key={m.id} className="flex flex-col items-center flex-1 max-w-[120px]">
          {m.rank === 1 && <div className="mb-1 animate-bounce"><Crown className="w-6 h-6 text-[#f0813d]" /></div>}
          <div className="relative mb-2">
            <MemberAvatar name={m.full_name} image={m.profile_image} rank={m.rank} />
            {m.id === myId && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#f0813d] rounded-full flex items-center justify-center"><Star className="w-3 h-3 text-white" /></div>}
          </div>
          <p className={`text-xs font-semibold text-center truncate w-full ${m.id === myId ? "text-[#f0813d]" : "text-gray-800"}`}>{m.id === myId ? "You" : m.full_name?.split(" ")[0]}</p>
          <div className="flex items-center gap-0.5 mt-0.5">
            <Flame className={`w-3 h-3 ${m.current_streak >= 7 ? "text-[#f0813d]" : "text-gray-400"}`} />
            <span className="text-xs font-bold text-gray-700">{m.current_streak}d</span>
          </div>
          <div className={`w-full ${heights[m.rank]} ${bg[m.rank]} rounded-t-xl mt-2 flex items-center justify-center`}>
            <span className="text-lg font-black text-white/80">{m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : "🥉"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const { user, selectedGym, isReady } = useAuthContext();
  const [activeTab, setActiveTab] = useState("streaks");
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [challengeLB, setChallengeLB] = useState([]);
  const [loading, setLoading] = useState(true);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [streakTab, setStreakTab] = useState("current");

  const gymId = selectedGym?.id || user?.gym_id;
  const myId = user?.member_id || user?.id;

  useEffect(() => {
    if (!gymId || !isReady) { if (isReady) setLoading(false); return; }
    const load = async () => {
      try {
        const [lbRes, chRes] = await Promise.all([
          fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" }, body: JSON.stringify({ p_gym_id: gymId }) }),
          fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" }, body: JSON.stringify({ action: "list", p_gym_id: gymId }) }),
        ]);
        const lbJson = await lbRes.json();
        const chJson = await chRes.json();
        setLeaderboard(lbJson.data?.leaderboard || []);
        // Only show active + recently ended challenges to members
        const allCh = chJson.data || [];
        setChallenges(allCh.filter(c => c.status === "active" || c.status === "upcoming" || (c.status === "ended" && c.days_remaining >= -7)));
      } catch {}
      setLoading(false);
    };
    load();
  }, [gymId, isReady, user?.id]);

  const fetchChallengeLB = async (id) => {
    setChallengeLoading(true);
    try {
      const res = await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" }, body: JSON.stringify({ action: "leaderboard", challenge_id: id }) });
      const json = await res.json();
      setChallengeLB(json.data?.leaderboard || []);
    } catch {}
    setChallengeLoading(false);
  };

  const sorted = useMemo(() => {
    const list = [...leaderboard];
    if (streakTab === "current") list.sort((a, b) => b.current_streak - a.current_streak || b.best_streak - a.best_streak);
    else if (streakTab === "best") list.sort((a, b) => b.best_streak - a.best_streak);
    else list.sort((a, b) => b.days_last_30 - a.days_last_30);
    return list;
  }, [leaderboard, streakTab]);

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const myRank = sorted.findIndex(m => m.id === myId) + 1;
  const myData = sorted.find(m => m.id === myId);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 mb-17 safe-area-inset-bottom">
      <Header title="Leaderboard" />
      <main className="px-3 py-2 space-y-3">

        {/* Main Tabs */}
        <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm border border-gray-100">
          <button onClick={() => setActiveTab("streaks")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab ==="streaks" ?"bg-[#f0813d] text-white shadow-md" :"text-gray-500"}`}>
            <Flame className="w-4 h-4" /> Streaks
          </button>
          <button onClick={() => setActiveTab("challenges")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab ==="challenges" ?"bg-[#f0813d] text-white shadow-md" :"text-gray-500"}`}>
            <Zap className="w-4 h-4" /> Challenges
            {challenges.filter(c => c.status === "active").length > 0 && (
              <span className={`px-1.5 rounded-full text-xs ${activeTab === "challenges" ? "bg-white/30" : "bg-orange-100 text-white"}`}>
                {challenges.filter(c => c.status === "active").length}
              </span>
            )}
          </button>
        </div>

        {/* ── STREAKS ──────────────────────────────────── */}
        {activeTab === "streaks" && (
          <>
            {myData && (
              <div className="bg-gradient-to-r from-[#f0813d] to-[#f0813d] rounded-2xl p-4 text-white shadow-lg shadow-orange-200/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MemberAvatar name={myData.full_name} image={myData.profile_image} rank={myRank} />
                    <div><p className="font-bold text-base">Your Rank</p><p className="text-orange-100 text-xs">Keep the streak alive!</p></div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black">#{myRank}</p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <Flame className="w-3.5 h-3.5 text-[#f0813d]" />
                      <span className="text-sm font-bold text-orange-100">{myData.current_streak} day streak</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm border border-gray-100">
              {[{ key: "current", label: "Current Streak", icon: <Flame className="w-3.5 h-3.5" /> }, { key: "best", label: "Best Streak", icon: <Trophy className="w-3.5 h-3.5" /> }, { key: "monthly", label: "This Month", icon: <Calendar className="w-3.5 h-3.5" /> }].map(t => (
                <button key={t.key} onClick={() => setStreakTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${streakTab === t.key ?"bg-[#f0813d] text-white shadow-md" :"text-gray-500"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {top3.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <Podium top3={top3} myId={myId} />
              </div>
            )}

            {rest.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {rest.map((m, i) => {
                  const rank = i + 4;
                  const isMe = m.id === myId;
                  const val = streakTab === "current" ? m.current_streak : streakTab === "best" ? m.best_streak : m.days_last_30;
                  return (
                    <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-orange-50/50" : ""}`}>
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><span className="text-sm font-bold text-gray-500">#{rank}</span></div>
                      <MemberAvatar name={m.full_name} image={m.profile_image} rank={rank} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isMe ? "text-white" : "text-white"}`}>{isMe ? "You" : m.full_name}</p>
                        <p className="text-xs text-gray-400">Best: {m.best_streak}d • {m.days_last_30}d/mo</p>
                      </div>
                      <span className="text-lg font-black text-gray-800">{val}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {sorted.length === 0 && (
              <div className="flex flex-col items-center py-16">
                <Trophy className="w-12 h-12 text-gray-300 mb-3" />
                <h3 className="text-gray-800 font-bold text-lg mb-1">No Streaks Yet</h3>
                <p className="text-gray-500 text-sm text-center">Start attending daily to build your streak!</p>
              </div>
            )}
          </>
        )}

        {/* ── CHALLENGES ───────────────────────────────── */}
        {activeTab === "challenges" && (
          <>
            {challenges.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <Zap className="w-12 h-12 text-gray-300 mb-3" />
                <h3 className="text-gray-800 font-bold text-lg mb-1">No Active Challenges</h3>
                <p className="text-gray-500 text-sm text-center">Your gym hasn't created any challenges yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {challenges.map(ch => {
                  const cfg = CHALLENGE_TYPES[ch.challenge_type] || CHALLENGE_TYPES.custom;
                  const isSelected = selectedChallenge?.id === ch.id;
                  const progress = ch.days_total > 0 ? Math.round((ch.days_elapsed / ch.days_total) * 100) : 0;
                  const myChRank = challengeLB.findIndex(m => m.id === myId) + 1;

                  return (
                    <div key={ch.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-4 cursor-pointer active:bg-gray-50" onClick={() => {
                        if (isSelected) { setSelectedChallenge(null); setChallengeLB([]); }
                        else { setSelectedChallenge(ch); fetchChallengeLB(ch.id); }
                      }}>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 text-sm">{ch.title}</h3>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ch.status === "active" ? "bg-orange-100 text-[#f0813d]" : ch.status === "upcoming" ? "bg-orange-100 text-[#f0813d]" : "bg-gray-100 text-gray-600"}`}>{ch.status === "active" ? "Active" : ch.status === "upcoming" ? "Upcoming" : "Ended"}</span>
                            </div>
                            {ch.description && <p className="text-xs text-gray-500 mt-0.5">{ch.description}</p>}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {ch.days_total} days</span>
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {ch.participant_count}</span>
                              {ch.status === "active" && <span className="flex items-center gap-1 text-[#f0813d] font-medium"><Clock className="w-3 h-3" /> {ch.days_remaining}d left</span>}
                            </div>
                          </div>
                        </div>
                        {ch.status === "active" && (
                          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#f0813d] to-[#f0813d] rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <div className="border-t border-gray-100">
                          {challengeLoading ? (
                            <div className="flex items-center justify-center py-8"><div className="w-8 h-8 border-3 border-[#f0813d] border-t-transparent rounded-full animate-spin"></div></div>
                          ) : challengeLB.length === 0 ? (
                            <div className="text-center py-8"><p className="text-gray-400 text-sm">No participants yet</p></div>
                          ) : (
                            <>
                              {myChRank > 0 && (
                                <div className="px-4 py-3 bg-orange-50/50 flex items-center justify-between border-b border-gray-100">
                                  <span className="text-sm font-semibold text-[#f0813d]">Your Rank</span>
                                  <span className="text-lg font-black text-[#f0813d]">#{myChRank}</span>
                                </div>
                              )}
                              <div className="divide-y divide-gray-50">
                                {challengeLB.map((m, i) => (
                                  <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 ${m.id === myId ? "bg-orange-50/30" : ""}`}>
                                    <span className="w-6 text-center text-sm font-bold text-gray-400">{i < 3 ? ["🥇","🥈","🥉"][i] : `#${i+1}`}</span>
                                    <MemberAvatar name={m.full_name} image={m.profile_image} rank={i+1} size="w-8 h-8" />
                                    <p className={`flex-1 text-sm font-medium truncate ${m.id === myId ? "text-[#f0813d]" : "text-gray-800"}`}>{m.id === myId ? "You" : m.full_name}</p>
                                    <span className="text-sm font-black text-gray-800">{m.score}{ch.challenge_type === "consistency" ? "%" : ""} {ch.custom_unit || cfg.unit}</span>
                                  </div>
                                ))}
                              </div>
                            </>
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
    </div>
  );
}
