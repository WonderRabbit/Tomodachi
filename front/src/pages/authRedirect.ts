import type { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isApiClientError } from "../api/http";
import { clearAuthSession } from "../auth/session";

export function useUnauthorizedRedirect(error: Error | null, navigate: ReturnType<typeof useNavigate>): void {
  useEffect(() => {
    if (isApiClientError(error) && error.status === 401) {
      clearAuthSession();
      void navigate({ to: "/login" });
    }
  }, [error, navigate]);
}
