import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!dailyApiKey) {
      return new Response(
        JSON.stringify({ error: "DAILY_API_KEY is not configured on the server" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Client scoped to the caller's JWT so RLS applies to our own sanity-check query below.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { match_id } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Confirm the caller is actually part of this match (RLS on `matches` enforces this too,
    // but we check explicitly here since we're about to call an external paid API on their behalf).
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id")
      .eq("id", match_id)
      .single();

    if (matchError || !match) {
      return new Response(JSON.stringify({ error: "Match not found or not accessible" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (match.user1_id !== user.id && match.user2_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not a participant in this match" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create the actual Daily room server-side. The Daily API key never reaches the client.
    const roomName = `intro-${match_id}-${Date.now()}`;
    const dailyResponse = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dailyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60, // room expires 1 hour after creation
          enable_chat: false,
          enable_screenshare: false,
          max_participants: 2,
        },
      }),
    });

    if (!dailyResponse.ok) {
      const errText = await dailyResponse.text();
      return new Response(
        JSON.stringify({ error: "Failed to create Daily room", detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const dailyRoom = await dailyResponse.json();

    // Record the call in our own table so both match participants can see/subscribe to it via Realtime.
    const { data: callRow, error: insertError } = await supabase
      .from("video_calls")
      .insert({
        match_id,
        initiated_by: user.id,
        room_name: dailyRoom.name,
        room_url: dailyRoom.url,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Room created but failed to save call record", detail: insertError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ call: callRow }), {
      status: 200,
      headers: { "Content-Type": "application/json", Connection: "keep-alive" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unexpected error", detail: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
