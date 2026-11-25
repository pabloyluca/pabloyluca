import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";

test("permisos PostgreSQL reales para anónimo, cliente, KITCHEN, ADMIN y OWNER con identidad Auth local", async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    grant select,insert,update,delete on all tables in schema public to anon,authenticated;
    alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`);
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await pg.exec(await readFile("supabase/seed.sql", "utf8"));
    const roles = ["KITCHEN", "ADMIN", "OWNER"] as const;
    const users = roles.map(
      (_, i) => "00000000-0000-4000-8200-00000000000" + i,
    );
    await pg.query("insert into auth.users(id) select unnest($1::uuid[])", [
      users,
    ]);
    for (const [i, role] of roles.entries())
      await pg.query("insert into profiles(id,role) values($1,$2)", [
        users[i],
        role,
      ]);
    for (const [role, subject, want] of [
      ["anon", "", "public"],
      ["authenticated", "00000000-0000-4000-8300-000000000000", "public"],
      ["authenticated", users[0], "kitchen,public"],
      ["authenticated", users[1], "kitchen,public,staff"],
      ["authenticated", users[2], "kitchen,public,staff"],
    ]) {
      await pg.exec("set role " + role);
      await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
        subject,
      ]);
      const rows = await pg.query<{ topic: string }>(
        "select topic from store_signals order by topic",
      );
      assert.equal(rows.rows.map((r) => r.topic).join(","), want);
      for (const table of [
        "orders",
        "payments",
        "finance_sales",
        "ingredients",
        "payment_preferences",
        "support_requests",
        "notification_events",
        "audit_logs",
      ])
        await assert.rejects(
          pg.query("select * from " + table),
          /permission denied/,
        );
      await assert.rejects(
        pg.query("update store_signals set version=version+1"),
        /permission denied/,
      );
      await assert.rejects(
        pg.query(
          "insert into profiles(id,role) values(gen_random_uuid(),'OWNER')",
        ),
        /permission denied/,
      );
      if (role === "authenticated") {
        const p = await pg.query<{ id: string }>("select id from profiles");
        assert.equal(
          p.rows.every((r) => r.id === subject),
          true,
        );
      }
      await pg.exec("reset role");
    }
  } finally {
    await pg.close();
  }
});
