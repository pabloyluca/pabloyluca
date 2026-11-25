import manifest from "@/app/manifest";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ area: string }> },
) {
  const { area } = await params;
  if (area !== "admin" && area !== "kitchen")
    return new Response(null, { status: 404 });
  const route = "/" + area,
    name =
      area === "kitchen"
        ? "Cocina · Pablo & Luca"
        : "Administración · Pablo & Luca";
  return Response.json(
    {
      ...manifest(),
      id: route,
      name,
      short_name: area === "kitchen" ? "P&L Cocina" : "P&L Admin",
      start_url: route,
      display: "standalone",
      display_override:
        area === "kitchen" ? ["fullscreen", "standalone"] : ["standalone"],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
