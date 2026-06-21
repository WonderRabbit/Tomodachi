import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  trend?: string;
  children?: ReactNode;
}

export function Card({ title, action, children, className = "" }: CardProps) {
  return (
    <section className={`card ${className}`}>
      {(title !== undefined || action !== undefined) && (
        <div className="card-header">
          {title !== undefined && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function MetricCard({
  label,
  value,
  detail,
  trend,
  children,
}: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="muted small">{label}</div>
      <div className="metric-row">
        <strong>{value}</strong>
        {trend !== undefined && <Badge tone="accent">{trend}</Badge>}
      </div>
      <p>{detail}</p>
      {children}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  detail,
  actions,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {actions}
    </header>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress" aria-label={`${value}% complete`}>
      <div style={{ width: `${value}%` }} />
    </div>
  );
}
