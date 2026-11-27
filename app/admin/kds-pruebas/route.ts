import { requirePageRole } from "@/lib/auth";
import { isSandbox } from "@/lib/mode";

export const dynamic = "force-dynamic";

export async function GET() {
  await requirePageRole(["OWNER", "ADMIN"]);
  const url = process.env.KDS_SANDBOX_URL;
  if (!url || isSandbox()) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 307,
    headers: {
      Location: url,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
