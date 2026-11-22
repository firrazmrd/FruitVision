import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
// Blur-reveal awal: lepas status "booting" setelah frame pertama dirender (CSS memudarkan veil sekitar 0,8 dtk). Tidak ada loading palsu.
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("booting")));
