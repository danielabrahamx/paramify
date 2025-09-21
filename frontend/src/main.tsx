import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Buffer } from "buffer";

// Polyfill for Node.js globals in browser environment
if (typeof global === 'undefined') {
  (window as any).global = globalThis;
}

// Polyfill for Buffer
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

// Polyfill for process global
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {},
    nextTick: (fn: Function) => setTimeout(fn, 0),
    platform: 'browser',
    version: '',
    versions: { node: '' }
  };
}

console.log("main.tsx loading...");
console.log("Environment:", import.meta.env);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
