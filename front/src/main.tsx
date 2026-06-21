import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { router } from "./router";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Tomodachi root element is missing.");
}

const queryClient = new QueryClient();

createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" theme="dark" />
    </QueryClientProvider>
  </React.StrictMode>,
);
