import { useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Server, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { requestLogin, AuthClientError } from "../api/authClient";
import { saveAuthSession } from "../auth/session";
import { appConfig } from "../config/runtimeConfig";
import { Badge } from "../components/Primitives";

type SubmitState = "idle" | "submitting";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = submitState === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (normalizedEmail.length === 0 || password.length === 0) {
      setErrorMessage("이메일과 비밀번호를 입력하세요.");
      return;
    }

    setSubmitState("submitting");
    setErrorMessage(null);

    try {
      const response = await requestLogin({
        email: normalizedEmail,
        password,
      });

      saveAuthSession({
        accessToken: response.accessToken,
        createdAt: new Date().toISOString(),
        email: normalizedEmail,
        tokenType: response.tokenType,
      });

      toast.success("로그인되었습니다.");
      await navigate({ to: "/" });
    } catch (error) {
      setErrorMessage(messageFromError(error));
      setSubmitState("idle");
    }
  }

  return (
    <main className="login-screen">
      <section className="login-copy" aria-labelledby="login-title">
        <div className="brand login-brand">
          <div className="brand-mark">T</div>
          <span>Tomodachi</span>
        </div>
        <Badge tone="accent">Operations MVP</Badge>
        <h1 id="login-title">Sign in to Tomodachi</h1>
        <p>
          제품, 프로젝트, 작업, 아키텍처, agent run 운영 상태를 인증된 내부 사용자 기준으로 확인합니다.
        </p>
        <div className="login-contract-grid" aria-label="Login contract">
          <div>
            <ShieldCheck size={18} />
            <span>Role-based API access</span>
          </div>
          <div>
            <Server size={18} />
            <span>{appConfig.apiBaseUrl}</span>
          </div>
        </div>
      </section>

      <section className="login-card" aria-label="Login form">
        <div>
          <span className="eyebrow">Authentication</span>
          <h2>계정으로 로그인</h2>
          <p>Uses POST /api/auth/login.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              autoComplete="username"
              className="input"
              disabled={isSubmitting}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@tomodachi.local"
              type="email"
              value={email}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              className="input"
              disabled={isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {errorMessage !== null && (
            <div className="form-alert" role="alert">
              <LockKeyhole size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function messageFromError(error: unknown): string {
  if (error instanceof AuthClientError && error.status === 401) {
    return "이메일 또는 비밀번호를 확인하세요.";
  }

  if (error instanceof AuthClientError) {
    return `로그인 요청이 실패했습니다. (${error.code})`;
  }

  if (error instanceof TypeError) {
    return "백엔드 API에 연결할 수 없습니다. 서버와 CORS 설정을 확인하세요.";
  }

  return "로그인 처리 중 알 수 없는 오류가 발생했습니다.";
}
