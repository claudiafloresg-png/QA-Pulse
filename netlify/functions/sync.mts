import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, context: Context) => {
  const store = getStore({ name: "qa-pulse-3-state", consistency: "strong" });

  if (req.method === "GET") {
    const result = await store.getWithMetadata("state", { type: "json" });
    if (!result) {
      return new Response(JSON.stringify({ data: null, version: 0 }), {
        headers: { "content-type": "application/json" },
      });
    }
    const version = (result.metadata && (result.metadata as any).version) || 0;
    return new Response(JSON.stringify({ data: result.data, version }), {
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const { data, expectedVersion } = body || {};
    if (!data || typeof data !== "object") {
      return new Response(JSON.stringify({ error: "Falta 'data'" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const currentMeta = await store.getMetadata("state");
    const currentVersion =
      (currentMeta && (currentMeta.metadata as any)?.version) || 0;

    if (
      typeof expectedVersion === "number" &&
      expectedVersion !== currentVersion
    ) {
      return new Response(
        JSON.stringify({ conflict: true, serverVersion: currentVersion }),
        { status: 409, headers: { "content-type": "application/json" } }
      );
    }

    const newVersion = currentVersion + 1;
    await store.setJSON("state", data, {
      metadata: { version: newVersion, savedAt: new Date().toISOString() },
    });

    return new Response(JSON.stringify({ ok: true, version: newVersion }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/sync",
};
