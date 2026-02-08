import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Buffer } from "buffer";

// Polyfill Buffer for simple-peer
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

import { AuthProvider } from "./context/AuthContext";
import { VideoProvider } from "./context/VideoContext";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <VideoProvider>
          <App />
        </VideoProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
