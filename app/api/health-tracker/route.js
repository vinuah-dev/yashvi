import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdminClient";

function getSupabase() {
  return getSupabaseAdmin();
}

// GET: fetch logs for a date + 7-day weight trend
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("member_id");
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    if (!memberId) {
      return NextResponse.json({ error: "member_id required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch all three log types for the selected date in parallel
    const [weightRes, workoutRes, calorieRes, trendRes] = await Promise.all([
      supabase
        .from("member_weight_logs")
        .select("*")
        .eq("member_id", memberId)
        .eq("logged_at", date)
        .order("created_at", { ascending: true }),

      supabase
        .from("member_workout_logs")
        .select("*")
        .eq("member_id", memberId)
        .eq("logged_at", date)
        .order("created_at", { ascending: true }),

      supabase
        .from("member_calorie_logs")
        .select("*")
        .eq("member_id", memberId)
        .eq("logged_at", date)
        .order("created_at", { ascending: true }),

      // 7-day weight trend (morning only)
      supabase
        .from("member_weight_logs")
        .select("weight_kg, log_type, logged_at")
        .eq("member_id", memberId)
        .gte("logged_at", (() => {
          const d = new Date(date);
          d.setDate(d.getDate() - 6);
          return d.toISOString().split("T")[0];
        })())
        .lte("logged_at", date)
        .order("logged_at", { ascending: true }),
    ]);

    return NextResponse.json({
      weightLogs: weightRes.data || [],
      workoutLogs: workoutRes.data || [],
      calorieLogs: calorieRes.data || [],
      weightTrend: trendRes.data || [],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: add a log entry or get AI advice
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, member_id } = body;

    if (!member_id) {
      return NextResponse.json({ error: "member_id required" }, { status: 400 });
    }

    const supabase = getSupabase();

    if (action === "log_weight") {
      const { weight_kg, log_type, logged_at, notes } = body;
      
      // Upsert: if same member + date + type exists, update it
      const { data: existing } = await supabase
        .from("member_weight_logs")
        .select("id")
        .eq("member_id", member_id)
        .eq("logged_at", logged_at)
        .eq("log_type", log_type)
        .single();

      let result;
      if (existing) {
        result = await supabase
          .from("member_weight_logs")
          .update({ weight_kg, notes })
          .eq("id", existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("member_weight_logs")
          .insert({ member_id, weight_kg, log_type, logged_at, notes })
          .select()
          .single();
      }

      if (result.error) throw result.error;
      return NextResponse.json({ data: result.data });
    }

    if (action === "log_workout") {
      const { exercise_name, sets, reps, weight_used_kg, duration_minutes, calories_burned, logged_at, notes } = body;
      const { data, error } = await supabase
        .from("member_workout_logs")
        .insert({ member_id, exercise_name, sets, reps, weight_used_kg, duration_minutes, calories_burned, logged_at, notes })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === "update_workout") {
      const { id, exercise_name, sets, reps, weight_used_kg, duration_minutes, calories_burned, notes } = body;
      const { data, error } = await supabase
        .from("member_workout_logs")
        .update({ exercise_name, sets, reps, weight_used_kg, duration_minutes, calories_burned, notes })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === "log_calorie") {
      const { meal_type, meal_time, food_description, calories, protein_g, carbs_g, fat_g, logged_at } = body;
      const { data, error } = await supabase
        .from("member_calorie_logs")
        .insert({ member_id, meal_type, meal_time, food_description, calories, protein_g, carbs_g, fat_g, logged_at })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === "update_calorie") {
      const { id, meal_type, meal_time, food_description, calories, protein_g, carbs_g, fat_g } = body;
      const { data, error } = await supabase
        .from("member_calorie_logs")
        .update({ meal_type, meal_time, food_description, calories, protein_g, carbs_g, fat_g })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (action === "analyze_food_image") {
      const { base64Image, mimeType } = body;
      if (!base64Image) return NextResponse.json({ error: "No image provided" }, { status: 400 });

      const apiKey = process.env.GEMINI_API_KEY_P;
      if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY_P not set" }, { status: 500 });

      const prompt = `You are a nutrition expert. Analyze this food image and estimate its nutritional content.
Return ONLY a valid JSON object with exactly these fields (no markdown, no extra text):
{
  "food_description": "brief description of the food items visible",
  "calories": <integer estimate>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fat_g": <number>
}
Be realistic. Assume a standard single-serving Indian portion size if applicable.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mimeType || "image/jpeg", data: base64Image } },
                { text: prompt },
              ],
            }],
            generationConfig: { maxOutputTokens: 1000, temperature: 1, thinkingConfig: { thinkingBudget: 0 } },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        console.error("Gemini vision error:", err);
        return NextResponse.json({ error: "Image analysis failed" }, { status: 500 });
      }

      const aiData = await response.json();
      // gemini-2.5-flash has thinking parts — find the actual response (non-thinking) part
      const parts = aiData.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find(p => !p.thought && p.text) || parts[parts.length - 1];
      const text = textPart?.text || "{}";
      try {
        // Extract JSON object regardless of markdown wrapping
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        const result = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ result });
      } catch (e) {
        console.error("Parse error:", e.message, "raw text:", text.slice(0, 200));
        return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
      }
    }

    if (action === "get_ai_advice") {
      const { summary, goal } = body;

      const apiKey = process.env.GEMINI_API_KEY_P;
      if (!apiKey) {
        return NextResponse.json({
          advice: "AI advice is not configured. Please add GEMINI_API_KEY_P to your .env file.",
        });
      }

      const prompt = `You are a helpful fitness and nutrition coach. A gym member has shared their daily health data with you.

Goal: ${goal || "General fitness and health improvement"}

Today's Summary:
${summary}

Please give a short, motivating, practical coaching advice (3-4 sentences max) based on this data. Be specific, encouraging, and actionable. If something looks off (too few calories, no workout logged, etc.), gently point it out.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1000, temperature: 1 },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini error:", errText);
        let errMsg = "Could not get AI advice right now.";
        try { const e = JSON.parse(errText); errMsg = e.error?.message || errMsg; } catch {}
        return NextResponse.json({ advice: errMsg });
      }

      const aiData = await response.json();
      const advParts = aiData.candidates?.[0]?.content?.parts || [];
      const advPart = advParts.find(p => !p.thought && p.text) || advParts[advParts.length - 1];
      const advice = advPart?.text || "Keep up the great work!";
      return NextResponse.json({ advice });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: remove a log entry
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type"); // weight | workout | calorie

    if (!id || !type) {
      return NextResponse.json({ error: "id and type required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const tableMap = {
      weight: "member_weight_logs",
      workout: "member_workout_logs",
      calorie: "member_calorie_logs",
    };

    const table = tableMap[type];
    if (!table) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
