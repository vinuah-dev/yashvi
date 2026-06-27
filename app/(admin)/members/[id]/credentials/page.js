"use client";

import { useAuthContext } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/layout/Header";
import { useToast } from "@/contexts/ToastContext";
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Key, 
  RefreshCw, 
  Copy, 
  Eye, 
  EyeOff, 
  Shield,
  ChevronLeft,
  User,
  Phone,
  Mail,
  Calendar,
  Building,
  CreditCard,
  Check,
  MoreVertical,
  Trash2
} from "lucide-react";

export default function MemberCredentialsPage() {
    const router = useRouter();
    const params = useParams();
    const { selectedGym, isReady } = useAuthContext();
    const { showSuccess, showError } = useToast();
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState({ field: null, timestamp: null });
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("credentials");

    useEffect(() => {
        if (!isReady || !selectedGym) return;
        
        if (selectedGym.plan === "Basic" || selectedGym.plan_type === "Basic") {
            showError("Credentials setup is not available on the Basic plan.");
            router.push(`/members/${params.id}`);
            return;
        }
        fetchMemberCredentials();
    }, [params.id, selectedGym, isReady]);

    const fetchMemberCredentials = async () => {
        setLoading(true);
        try {
            const { data: memberData, error: memberError } = await supabase
                .from("members")
                .select(`
                    id,
                    full_name,
                    phone,
                    email,
                    created_at,
                    memberships (
                        status,
                        membership_plans (name)
                    )
                `)
                .eq("id", params.id)
                .single();

            if (memberError) {
                console.error("Error fetching member:", memberError);
                setLoading(false);
                return;
            }

            const { data: credentialsData, error: credError } = await supabase
                .from("member_credentials")
                .select("*")
                .eq("member_id", params.id)
                .single();

            if (credError && credError.code !== "PGRST116") {
                console.error("Error fetching credentials:", credError);
            }

            const activeMembership = memberData.memberships?.find(m => m.status === "active") || memberData.memberships?.[0];

            setMember({
                id: memberData.id,
                name: memberData.full_name,
                phone: memberData.phone,
                email: memberData.email,
                memberSince: new Date(memberData.created_at).toLocaleDateString("en-IN"),
                currentPlan: activeMembership?.membership_plans?.name || "No Plan",
                status: activeMembership?.status || "inactive",
                credentials: credentialsData ? {
                    loginType: credentialsData.login_type,
                    loginValue: credentialsData.login_value,
                    password: credentialsData.password,
                    createdAt: credentialsData.created_at,
                    hasAppAccess: true,
                } : null
            });
        } catch (err) {
            console.error("Error:", err);
        }
        setLoading(false);
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopied({ field, timestamp: Date.now() });
        showSuccess(`${field === "password" ? "Password" : "Credentials"} copied to clipboard!`);
        setTimeout(() => {
            setCopied({ field: null, timestamp: null });
        }, 2000);
    };

    const handleResetPassword = async () => {
        const newPassword = prompt("Enter new password for member:");
        if (!newPassword || newPassword.trim() === "") return;

        try {
            const { error } = await supabase
                .from("member_credentials")
                .update({ password: newPassword.trim() })
                .eq("member_id", member.id)
                .single();

            if (error) {
                console.error("Password reset error:", error);
                showError("Failed to reset password");
            } else {
                showSuccess("Password updated successfully!");
                fetchMemberCredentials();
            }
        } catch (err) {
            console.error("Password reset exception:", err);
            showError("An error occurred while resetting password");
        }
    };

    const handleCreateCredentials = async () => {
        if (!member.phone) {
            showError("Phone number is required to create credentials");
            return;
        }

        const defaultPassword = `Gym@${Math.random().toString(36).slice(-6)}`;

        try {
            const { error } = await supabase
                .from("member_credentials")
                .insert({
                    member_id: member.id,
                    login_type: "phone",
                    login_value: member.phone,
                    password: defaultPassword
                });

            if (error) {
                console.error("Error creating credentials:", error);
                showError("Failed to create credentials");
            } else {
                showSuccess(`Credentials created! Login: ${member.phone} | Password: ${defaultPassword}`);
                fetchMemberCredentials();
            }
        } catch (err) {
            showError("An error occurred");
        }
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case "active":
                return {
                    color: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
                    text: "text-[#f0813d]",
                    dot: "bg-[#f0813d]",
                    label: "Active",
                    icon: <CheckCircle className="w-3.5 h-3.5" />
                };
            case "expired":
                return {
                    color: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
                    text: "text-[#f0813d]",
                    dot: "bg-[#f0813d]",
                    label: "Expired",
                    icon: <Clock className="w-3.5 h-3.5" />
                };
            case "inactive":
                return {
                    color: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200",
                    text: "text-gray-700",
                    dot: "bg-gray-500",
                    label: "Inactive",
                    icon: <AlertTriangle className="w-3.5 h-3.5" />
                };
            default:
                return {
                    color: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200",
                    text: "text-gray-700",
                    dot: "bg-gray-500",
                    label: "Inactive",
                    icon: <AlertTriangle className="w-3.5 h-3.5" />
                };
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
                <Header title="Member Credentials" />
                <div className="flex flex-col items-center justify-center h-[60vh] p-6">
                    <div className="relative">
                        <div className="w-14 h-14 border-4 border-[#f0813d]/20 border-t-[#f0813d] rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-14 h-14 border-4 border-transparent border-t-[#f0813d] rounded-full animate-spin animation-delay-200"></div>
                    </div>
                    <p className="mt-6 text-gray-600 font-medium text-sm">Loading credentials...</p>
                </div>
            </div>
        );
    }

    if (!member) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
                <Header title="Member Credentials" />
                <div className="flex flex-col items-center justify-center h-[60vh] p-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mb-6">
                        <User className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Member Not Found</h3>
                    <p className="text-gray-500 text-center mb-6 max-w-sm">
                        The member you're looking for doesn't exist or has been removed.
                    </p>
                    <button
                        onClick={() => router.push("/members")}
                        className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300"
                    >
                        Back to Members
                    </button>
                </div>
            </div>
        );
    }

    const statusConfig = getStatusConfig(member.status);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <Header title="Member Credentials" />

            <div className="p-3 sm:p-4 max-w-4xl mx-auto space-y-4">
                {/* Member Profile Header */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold text-xl shadow-sm">
                            {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-gray-900 mb-1">{member.name}</h2>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <div className="flex items-center gap-2">
                                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-gray-600 text-sm">{member.phone}</span>
                                </div>
                                {member.email && (
                                    <>
                                        <div className="hidden sm:block text-gray-300">•</div>
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="text-gray-600 text-sm truncate">{member.email}</span>
                                        </div>
                                    </>
                                )}
                                <div className="hidden sm:block text-gray-300">•</div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-gray-600 text-sm">Member since {member.memberSince}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
                        <div>
                            <p className="text-gray-500 text-xs font-medium mb-1">Current Plan</p>
                            <p className="font-semibold text-gray-900 text-sm">{member.currentPlan}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs font-medium mb-1">Status</p>
                            <div className={`px-2.5 py-1.5 rounded-lg border ${statusConfig.color} ${statusConfig.text} inline-flex items-center gap-1.5`}>
                                {statusConfig.icon}
                                <span className="text-xs font-medium">{statusConfig.label}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs font-medium mb-1">App Access</p>
                            <p className={`font-semibold text-sm ${member.credentials ? 'text-[#f0813d]' : 'text-[#f0813d]'}`}>
                                {member.credentials ? 'Enabled' : 'Disabled'}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs font-medium mb-1">Member ID</p>
                            <p className="font-mono font-semibold text-gray-900 text-sm">#{member.id.slice(0, 8)}</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
                    <div className="flex overflow-x-auto">
                        <button
                            onClick={() => setActiveTab("credentials")}
                            className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                                activeTab === "credentials" 
                                ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-sm" 
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            <Key className="w-4 h-4" />
                            Credentials
                        </button>
                        <button
                            onClick={() => setActiveTab("actions")}
                            className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                                activeTab === "actions" 
                                ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white shadow-sm" 
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actions
                        </button>
                    </div>
                </div>

                {/* Credentials Tab */}
                {activeTab === "credentials" && (
                    <div className="space-y-4">
                        {/* No Credentials State */}
                        {!member.credentials && (
                            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
                                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Key className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No App Credentials</h3>
                                <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                                    This member doesn't have login credentials for the mobile app yet.
                                </p>
                                <button
                                    onClick={handleCreateCredentials}
                                    className="px-6 py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2 mx-auto active:scale-95"
                                >
                                    <Key className="w-4 h-4" />
                                    Create Credentials
                                </button>
                            </div>
                        )}

                        {/* Credentials Card */}
                        {member.credentials && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                                                <Key className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">Mobile App Credentials</h3>
                                                <p className="text-sm text-gray-500">
                                                    Share these credentials securely with the member
                                                </p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1.5 bg-orange-50 text-[#f0813d] rounded-lg text-xs font-medium">
                                            Active
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    {/* Login Method */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium text-gray-700">Login Method</label>
                                            <span className="text-xs text-gray-400">Phone number login</span>
                                        </div>
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg flex items-center justify-center">
                                                    <Phone className="w-4 h-4 text-white" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{member.credentials.loginValue}</p>
                                                    <p className="text-xs text-gray-500">Phone Number</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Password Field */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium text-gray-700">Password</label>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
                                                >
                                                    {showPassword ? (
                                                        <>
                                                            <EyeOff className="w-3.5 h-3.5" />
                                                            Hide
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Eye className="w-3.5 h-3.5" />
                                                            Show
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => copyToClipboard(member.credentials.password, "password")}
                                                    className="text-xs text-[#f0813d] hover:text-[#f0813d] flex items-center gap-1.5"
                                                >
                                                    {copied.field === "password" ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 text-[#f0813d]" />
                                                            Copied
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3.5 h-3.5" />
                                                            Copy
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <p className={`font-mono text-sm ${showPassword ? 'text-gray-900' : 'text-gray-400 select-none'}`}>
                                                    {showPassword ? member.credentials.password : '••••••••••••••••'}
                                                </p>
                                                <Key className="w-4 h-4 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Share All Button */}
                                    <button
                                        onClick={() => {
                                            const text = `Your Gym App Login Credentials:\n\n📱 Phone: ${member.credentials.loginValue}\n🔑 Password: ${member.credentials.password}\n\nDownload the app from the Play Store/App Store.`;
                                            copyToClipboard(text, "all");
                                        }}
                                        className={`w-full py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ${
                                            copied.field === "all" 
                                            ? "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white" 
                                            : "bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white hover:shadow-lg"
                                        }`}
                                    >
                                        {copied.field === "all" ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Credentials Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Copy All Credentials
                                            </>
                                        )}
                                    </button>

                                    {/* Account Info */}
                                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium">Account Created</p>
                                                <p className="text-sm font-medium text-gray-900 mt-0.5">
                                                    {new Date(member.credentials.createdAt).toLocaleString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                            <Calendar className="text-gray-400 w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions Tab */}
                {activeTab === "actions" && (
                    <div className="space-y-4">
                        {/* Quick Actions */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {member.credentials ? (
                                    <>
                                        <button
                                            onClick={handleResetPassword}
                                            className="p-3 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg text-[#f0813d] font-medium hover:shadow-sm transition-all duration-300 flex items-center justify-between group active:scale-95"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                                                    <RefreshCw className="w-4 h-4 text-white" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-medium text-sm">Reset Password</p>
                                                    <p className="text-xs text-[#f0813d]">Generate new password</p>
                                                </div>
                                            </div>
                                            <span className="text-[#f0813d] group-hover:text-[#f0813d]">→</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                const text = `Your Gym App Login Credentials:\n\n📱 Phone: ${member.credentials.loginValue}\n🔑 Password: ${member.credentials.password}`;
                                                navigator.clipboard.writeText(text);
                                                showSuccess("Credentials copied to clipboard!");
                                            }}
                                            className="p-3 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg text-[#f0813d] font-medium hover:shadow-sm transition-all duration-300 flex items-center justify-between group active:scale-95"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                                                    <Phone className="w-4 h-4 text-white" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-medium text-sm">Send via SMS</p>
                                                    <p className="text-xs text-[#f0813d]">Share via text message</p>
                                                </div>
                                            </div>
                                            <span className="text-[#f0813d] group-hover:text-[#f0813d]">→</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleCreateCredentials}
                                        className="col-span-full p-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-3 active:scale-95"
                                    >
                                        <Key className="w-4 h-4" />
                                        Create App Credentials
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Security Warning */}
                        <div className="bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Shield className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-orange-900 mb-2 text-sm">Security Guidelines</h4>
                                    <ul className="space-y-1.5 text-xs text-[#f0813d]">
                                        <li className="flex items-start gap-2">
                                            <span className="text-[#f0813d] mt-0.5">•</span>
                                            Share credentials only through secure channels
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-[#f0813d] mt-0.5">•</span>
                                            Never share via public platforms or screenshots
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-[#f0813d] mt-0.5">•</span>
                                            Ask member to change password on first login
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-[#f0813d] mt-0.5">•</span>
                                            Report any suspicious activity immediately
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        onClick={() => router.push(`/members/${member.id}`)}
                        className="py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:border-gray-300 hover:shadow-sm transition-all duration-300 flex items-center justify-center gap-2 active:scale-95"
                    >
                        <User className="w-4 h-4" />
                        View Profile
                    </button>
                    <button
                        onClick={() => router.push("/members")}
                        className="py-3 bg-gradient-to-r from-[#f0813d] to-[#f0813d] text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Members
                    </button>
                </div>
            </div>
        </div>
    );
}
