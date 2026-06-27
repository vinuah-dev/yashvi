import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";

export async function POST(request) {
  try {
    const { login, password } = await request.json();
    const rawLogin = String(login || "").trim();
    const normalizedPassword = String(password || "").trim();
    const isEmail = rawLogin.includes("@") && rawLogin.includes(".");
    const normalizedLogin = isEmail
      ? rawLogin.toLowerCase()
      : rawLogin.replace(/\D/g, "").slice(-10);

    if (!normalizedLogin || !normalizedPassword) {
      return NextResponse.json(
        { error: "Email/phone and password are required" },
        { status: 400 },
      );
    }

    if (!isEmail && normalizedLogin.length !== 10) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit phone number" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("member_credentials")
      .select(`
        id,
        password,
        created_at,
        members (
          id,
          full_name,
          email,
          phone,
          gym_id,
          profile_image
        )
      `)
      .eq("login_type", isEmail ? "email" : "phone")
      .order("created_at", { ascending: false })
      .limit(20);

    query = isEmail
      ? query.ilike("login_value", normalizedLogin)
      : query.eq("login_value", normalizedLogin);

    let { data, error } = await query;
    if (error) {
      console.error("Member login lookup failed:", error);
      return NextResponse.json({ error: "Unable to verify login" }, { status: 500 });
    }

    // Onboarding currently creates phone credentials. If a member enters the
    // email saved on their member profile, resolve the linked phone credential.
    if (isEmail && (!data || data.length === 0)) {
      const { data: members, error: memberError } = await supabase
        .from("members")
        .select("id")
        .ilike("email", normalizedLogin)
        .limit(20);

      if (memberError) {
        console.error("Member email lookup failed:", memberError);
        return NextResponse.json({ error: "Unable to verify login" }, { status: 500 });
      }

      const memberIds = (members || []).map((member) => member.id);
      if (memberIds.length > 0) {
        const credentialResult = await supabase
          .from("member_credentials")
          .select(`
            id,
            password,
            created_at,
            members (
              id,
              full_name,
              email,
              phone,
              gym_id,
              profile_image
            )
          `)
          .in("member_id", memberIds)
          .order("created_at", { ascending: false })
          .limit(20);

        if (credentialResult.error) {
          console.error("Linked member credential lookup failed:", credentialResult.error);
          return NextResponse.json({ error: "Unable to verify login" }, { status: 500 });
        }
        data = credentialResult.data;
      }
    }

    const credential = (data || []).find(
      (row) =>
        row.members?.id &&
        String(row.password || "").trim() === normalizedPassword,
    );

    if (!credential) {
      return NextResponse.json(
        { error: "Invalid email/phone or password" },
        { status: 401 },
      );
    }

    const member = credential.members;
    return NextResponse.json({
      member: {
        id: member.id,
        name: member.full_name,
        email: member.email,
        phone: member.phone,
        role: "member",
        gym_id: member.gym_id,
        profileImage: member.profile_image,
      },
    });
  } catch (error) {
    console.error("Member login error:", error);
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}
