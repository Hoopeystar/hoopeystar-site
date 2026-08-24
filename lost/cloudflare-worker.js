const ADMIN_USER = "hoopeystar";
const ADMIN_PIN = "1432";
const SALT = "ll26-hoopey";

function json(code, payload) {
  return new Response(JSON.stringify(payload), {
    status: code,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Lost-Api": "1"
    }
  });
}

function pid(name) {
  return String(name || "").trim().toLowerCase();
}

async function pinHash(user, pin) {
  const data = new TextEncoder().encode(pid(user) + ":" + pin + ":" + SALT);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(function (b) {
    return b.toString(16).padStart(2, "0");
  }).join("");
}

function newId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return "p" + [...a].map(function (b) {
    return b.toString(16).padStart(2, "0");
  }).join("");
}

function publicPeople(data) {
  return Object.keys(data.users || {}).map(function (key) {
    const u = data.users[key];
    return {
      id: u.id,
      name: u.name,
      picks: u.picks || {},
      notes: u.notes || {},
      updatedAt: u.updatedAt || ""
    };
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (!path.endsWith("/api") && !path.endsWith("/api.php")) {
      return json(404, {
        ok: false,
        error: "This Worker should only be routed to /lost/api*, not the whole /lost/ folder."
      });
    }
    if (request.method !== "GET" && request.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    let body = {};
    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }
    } else {
      body = { action: url.searchParams.get("action") || "lists" };
    }

    const action = body.action || "lists";
    const data = (await env.LISTS.get("store", { type: "json" })) || { users: {} };
    if (!data.users) data.users = {};

    if (action === "lists") {
      return json(200, { ok: true, people: publicPeople(data) });
    }

    const user = String(body.username || "").trim();
    const pin = String(body.pin || "").replace(/\D/g, "");
    const key = pid(user);

    if (action === "login") {
      if (!user || pin.length !== 4) {
        return json(400, { ok: false, error: "Enter a username and a 4-digit PIN" });
      }
      if (key === ADMIN_USER) {
        if (pin !== ADMIN_PIN) return json(403, { ok: false, error: "Wrong PIN" });
        return json(200, { ok: true, admin: true, people: publicPeople(data) });
      }
      if (!data.users[key]) {
        const row = {
          id: newId(),
          name: user,
          pinHash: await pinHash(user, pin),
          picks: {},
          notes: {},
          updatedAt: new Date().toISOString()
        };
        data.users[key] = row;
        await env.LISTS.put("store", JSON.stringify(data));
        return json(200, {
          ok: true,
          created: true,
          user: { id: row.id, name: row.name, picks: {}, notes: {} },
          people: publicPeople(data)
        });
      }
      const row = data.users[key];
      if (row.pinHash !== (await pinHash(user, pin))) {
        return json(403, { ok: false, error: "Wrong PIN" });
      }
      return json(200, {
        ok: true,
        created: false,
        user: {
          id: row.id,
          name: row.name,
          picks: row.picks || {},
          notes: row.notes || {}
        },
        people: publicPeople(data)
      });
    }

    if (action === "save") {
      if (key === ADMIN_USER) return json(400, { ok: false, error: "Admin has no list to save" });
      const row = data.users[key];
      if (!row) return json(404, { ok: false, error: "Unknown username" });
      if (row.pinHash !== (await pinHash(user, pin))) {
        return json(403, { ok: false, error: "Wrong PIN" });
      }
      row.picks = body.picks && typeof body.picks === "object" ? body.picks : {};
      row.notes = body.notes && typeof body.notes === "object" ? body.notes : {};
      row.updatedAt = new Date().toISOString();
      await env.LISTS.put("store", JSON.stringify(data));
      return json(200, { ok: true, people: publicPeople(data) });
    }

    if (action === "delete" || action === "deleteAll") {
      if (key !== ADMIN_USER || pin !== ADMIN_PIN) {
        return json(403, { ok: false, error: "Admin only" });
      }
      if (action === "deleteAll") {
        data.users = {};
      } else {
        const target = String(body.id || "");
        const targetName = pid(body.target || "");
        Object.keys(data.users).forEach(function (k) {
          if (data.users[k].id === target || k === targetName) delete data.users[k];
        });
      }
      await env.LISTS.put("store", JSON.stringify(data));
      return json(200, { ok: true, people: publicPeople(data) });
    }

    return json(400, { ok: false, error: "Unknown action" });
  }
};
