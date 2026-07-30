import { NextRequest, NextResponse } from "next/server";
import { adminError, requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function audit(adminId: string, action: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from("admin_audit_logs").insert({ admin_user_id: adminId, action, metadata }).then(() => null, () => null);
}

export async function GET() {
  try {
    await requireAdminUser();
    const [projects, apps, goals, products] = await Promise.all([
      supabaseAdmin.from("projects").select("*").order("created_at", { ascending: false }).limit(150),
      supabaseAdmin.from("apps").select("*").order("created_at", { ascending: false }).limit(150).then((r) => r, () => ({ data: [] })),
      supabaseAdmin.from("project_release_goals").select("*").order("created_at", { ascending: false }).limit(150).then((r) => r, () => ({ data: [] })),
      supabaseAdmin.from("commerce_products").select("*").order("created_at", { ascending: false }).limit(150).then((r) => r, () => ({ data: [] })),
    ]);
    return NextResponse.json({ ok: true, projects: projects.data || [], apps: apps.data || [], goals: goals.data || [], products: products.data || [] });
  } catch (error) { return adminError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "toggleProjectStatus") {
      if (!body.projectId) return NextResponse.json({ ok: false, error: "Project ID required." }, { status: 400 });
      await supabaseAdmin.from("projects").update({ status: body.status || "active" }).eq("id", String(body.projectId));
      await audit(admin.id, "project.status", { project_id: body.projectId, status: body.status });
      return NextResponse.json({ ok: true });
    }

    if (action === "updateProject") {
      const project = body.project || {};
      if (!project.id) return NextResponse.json({ ok: false, error: "Project ID required." }, { status: 400 });
      const update: Record<string, any> = {};
      for (const key of ["name", "slug", "description", "status", "cover_image_path", "theme"]) if (project[key] !== undefined) update[key] = project[key] || null;
      const result = await supabaseAdmin.from("projects").update(update).eq("id", project.id).select("*").single();
      if (result.error) throw new Error(result.error.message);
      await audit(admin.id, "project.update", { project_id: project.id });
      return NextResponse.json({ ok: true, project: result.data });
    }

    if (action === "createProduct") {
      const product = body.product || {};
      const result = await supabaseAdmin.from("commerce_products").insert({ ...product, status: product.status || "active" }).select("*").single();
      if (result.error) throw new Error(result.error.message);
      await audit(admin.id, "product.create", { product_key: result.data.product_key });
      return NextResponse.json({ ok: true, product: result.data });
    }

    return NextResponse.json({ ok: false, error: "Unknown experience action." }, { status: 400 });
  } catch (error) { return adminError(error); }
}
