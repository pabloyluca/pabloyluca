import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Sql, TransactionSql } from "postgres";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { usesLocalData } from "../mode";

export interface DB {
  query<T extends object = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<T[]>;
}
interface Store extends DB {
  close(): Promise<void>;
  tx<T>(fn: (db: DB) => Promise<T>): Promise<T>;
}
declare global {
  var pabloDb: Promise<Store> | undefined;
}
const local = (pg: PGlite | Transaction): DB => ({
  async query<T extends object>(sql: string, values: unknown[] = []) {
    return (await pg.query<T>(sql, values)).rows;
  },
});
const remote = (pg: Sql | TransactionSql): DB => ({
  async query<T extends object>(sql: string, values: unknown[] = []) {
    return await pg.unsafe<T[]>(sql, values as never[]);
  },
});
async function open(): Promise<Store> {
  if (process.env.COMMERCE_MODE === "visual-preview")
    throw new Error("Vista previa de solo lectura.");
  if (!usesLocalData()) {
    const url = process.env.DATABASE_URL;
    if (!url)
      throw new Error("Configura DATABASE_URL para la conexión de servidor.");
    const { default: postgres } = await import("postgres");
    const pg = postgres(url, {
      max: 3,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 8,
      ssl: {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_CA_CERT
          ? { ca: process.env.DATABASE_CA_CERT.replaceAll("\\n", "\n") }
          : {}),
      },
      onnotice: () => {},
    });
    const preview = process.env.COMMERCE_MODE === "online-sandbox";
    if (preview && (process.env.VERCEL_ENV === "production" ||
        new URL(url).username.split(".")[0] !== "pl_preview_orders")) {
      await pg.end();
      throw new Error("El simulador requiere la conexión exclusiva de la preview.");
    }
    async function transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
      return await pg.begin(async tx => {
        if (preview) await tx.unsafe("set local search_path = pl_preview, pg_catalog");
        return fn(remote(tx));
      }) as T;
    }
    return {
      ...(preview ? {
        query: <T extends object>(sql: string, values?: unknown[]) =>
          transaction(d => d.query<T>(sql, values)),
      } : remote(pg)),
      close: () => pg.end(),
      tx: transaction,
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const location =
    process.env.PABLO_DATA_DIR || resolve(".sandbox", "postgres");
  if (location !== "memory://") await mkdir(location, { recursive: true });
  const pg = await PGlite.create(location);
  await pg.exec(
    "create table if not exists local_migrations(name text primary key)",
  );
  const folder = resolve("supabase", "migrations");
  for (const f of (await readdir(folder))
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    if (
      (await pg.query("select 1 from local_migrations where name=$1", [f])).rows
        .length
    )
      continue;
    const script = await readFile(join(folder, f), "utf8");
    await pg.transaction(async (t) => {
      await t.exec(script);
      await t.query("insert into local_migrations values($1)", [f]);
    });
  }
  if (
    !(
      await pg.query(
        "select 1 from local_migrations where name='catalog-seed-v1'",
      )
    ).rows.length
  ) {
    const seed = await readFile(resolve("supabase", "seed.sql"), "utf8");
    await pg.transaction(async (t) => {
      await t.exec(seed);
      await t.query("insert into local_migrations values('catalog-seed-v1')");
    });
  }
  if (
    !(
      await pg.query(
        "select 1 from local_migrations where name='sandbox-fixtures-v1'",
      )
    ).rows.length
  ) {
    await pg.transaction(async (t) => {
      await t.exec(`update ingredients set stock=case when unit='pz' then 100 else 10000 end,minimum=case when unit='pz' then 5 else 100 end;
        insert into dough_batches(prepared_at,flour,hydration,yeast,salt,ball_weight,balls,remaining,ferment_start,ferment_hours,expires_at,status)
        values(now(),9000,65,25,180,250,60,60,now(),24,now()+interval '30 days','ready');
        insert into local_migrations values('sandbox-fixtures-v1'),('sandbox-vegan-stock-v1')`);
    });
  }
  // Older local test kitchens already received the original stock fixture.
  // Only seed the newly introduced ingredients, once, in that same demo kitchen.
  if (
    !(
      await pg.query(
        "select 1 from local_migrations where name='sandbox-vegan-stock-v1'",
      )
    ).rows.length
  ) {
    await pg.transaction(async (t) => {
      await t.exec(`update ingredients i set stock=10000,minimum=100
        where i.id between '00000000-0000-4000-8002-000000000010' and '00000000-0000-4000-8002-000000000016'
        and i.stock=0 and not exists(select 1 from inventory_movements m where m.ingredient_id=i.id);
        insert into local_migrations values('sandbox-vegan-stock-v1')`);
    });
  }
  return {
    ...local(pg),
    close: () => pg.close(),
    tx: <T>(fn: (db: DB) => Promise<T>) => pg.transaction((t) => fn(local(t))),
  };
}
export function db(): Promise<Store> {
  globalThis.pabloDb ??= open().catch((error) => {
    globalThis.pabloDb = undefined;
    throw error;
  });
  return globalThis.pabloDb;
}
