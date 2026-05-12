import { SUPABASE_URL, SUPABASE_KEY } from "./config";

export const auth = {
  signIn: async (empId, password, workEmail = null) => {
    const emailsToTry = workEmail
      ? [workEmail, empId.toLowerCase() + "@euroclock.eurospec.internal"]
      : [empId.toLowerCase() + "@euroclock.eurospec.internal"];

    let lastStatus = 500;
    for (const email of emailsToTry) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      lastStatus = res.status;
      if (res.status === 200) return data;
      if (res.status === 400) throw new Error("WRONG_PASSWORD");
    }
    if (lastStatus === 500) throw new Error("NO_AUTH_USER");
    throw new Error("WRONG_PASSWORD");
  },
  signOut: async (token) => {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });
  },
  resetPassword: async (workEmail) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: workEmail })
    });
    return res.ok;
  }
};

export const rpc = async (fn, params) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.ok;
};

export const db = {
  get: async (table, params = "") => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" }
    });
    return res.json();
  },
  post: async (table, body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    return res.json();
  },
  patch: async (table, match, body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    return res.json();
  },
  delete: async (table, match) => {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  }
};
