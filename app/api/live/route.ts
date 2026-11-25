import { isVisualPreview, usesLocalData } from "@/lib/mode";
import { allStaff, staff, managers, api, json } from "@/lib/http";
import { realtimeToken } from "@/lib/auth";
export const GET = api(async (req) => {
  const topic = new URL(req.url).searchParams.get("topic") || "public";
  if (topic !== "public")
    await staff(topic === "kitchen" ? allStaff : managers);
  return json(
    isVisualPreview() ? {mode:"visual"} : usesLocalData()
      ? { mode: "local" }
      : {
          mode: "supabase",
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          token: topic === "public" ? null : await realtimeToken(),
        },
  );
});
