import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./src/App.jsx";
import "./src/styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

createRoot(document.getElementById("root")).render(
  convex ? (
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  ) : (
    <div className="authConfigMissing">
      <h1>Convex is not configured</h1>
      <p>Set VITE_CONVEX_URL in client/.env.local to use the client portal.</p>
    </div>
  )
);
