import React from "react";
import ReactDOM from "react-dom/client";
import { Router } from "wouter";
import App from "./App.js";
import { ThemeProvider } from "./components/ThemeProvider.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Router>
  </React.StrictMode>
);
