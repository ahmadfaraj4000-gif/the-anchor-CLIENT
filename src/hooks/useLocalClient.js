import { useEffect, useState } from "react";
import { useAuthToken, useConvexAuth } from "@convex-dev/auth/react";

const CONVEX_SITE_URL = (import.meta.env.VITE_CONVEX_SITE_URL || window.ANCHOR_CONVEX_SITE_URL || "").replace(/\/$/, "");

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function setCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=604800; SameSite=Lax`;
}

export function useLocalClient() {
  const token = useAuthToken();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("");
  const isAuthReady = isAuthenticated && Boolean(token);

  useEffect(() => {
    const email = getCookie("anchorUserEmail");
    const name = getCookie("anchorUserName");
    if (email) {
      setClient({ email: decodeURIComponent(email), name: name ? decodeURIComponent(name) : "Member" });
    } else {
      setClient(null);
    }
  }, []);

  function authHeaders() {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiPost(path, payload) {
    if (!CONVEX_SITE_URL) throw new Error("The member portal connection is not configured yet.");
    if (path !== "/api/auth/sync" && path !== "/api/profile" && path !== "/api/public" && path !== "/api/account-exists" && !token) {
      throw new Error("Your secure session is still loading. Try again in a second.");
    }
    const response = await fetch(`${CONVEX_SITE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
  }

  async function apiGet(path) {
    if (!CONVEX_SITE_URL) throw new Error("The member portal connection is not configured yet.");
    const response = await fetch(`${CONVEX_SITE_URL}${path}`, {
      headers: authHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
  }

  useEffect(() => {
    if (!isAuthReady) return;
    apiPost("/api/auth/sync", {})
      .then(async ({ user }) => {
        let activeUser = user;
        const pendingProfile = localStorage.getItem("anchorPendingProfile");
        if (pendingProfile) {
          const profile = JSON.parse(pendingProfile);
          const response = await apiPost("/api/profile", profile);
          activeUser = response.user;
          localStorage.removeItem("anchorPendingProfile");
        }
        if (!activeUser?.email) return;
        setCookie("anchorUserEmail", activeUser.email);
        setCookie("anchorUserName", activeUser.name || "Member");
        setClient(activeUser);
      })
      .catch((error) => setStatus(error.message));
  }, [isAuthReady, token]);

  async function registerClient(profile) {
    const { user } = await apiPost("/api/profile", profile);
    setCookie("anchorUserEmail", user.email);
    setCookie("anchorUserName", user.name || "Member");
    setClient(user);
    setStatus("");
  }

  return {
    client,
    registerClient,
    status,
    setStatus,
    apiGet,
    apiPost,
    isSignedIn: isAuthReady && Boolean(client),
    isAuthLoading: isLoading || (isAuthenticated && !token) || (isAuthReady && !client && !status)
  };
}
