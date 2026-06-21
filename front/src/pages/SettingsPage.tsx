import { Badge, Card, PageHeader } from "../components/Primitives";

export function SettingsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operations"
        title="Settings"
        detail="MVP read-only operations surface for profile, scopes, integrations, webhooks, and appearance."
      />
      <section className="dashboard-grid">
        <Card title="Profile">
          <p>oneyoon · Admin/Product Manager</p>
          <div className="summary-pills">
            <Badge>product:read</Badge>
            <Badge>task:write</Badge>
            <Badge>agent-run:read</Badge>
          </div>
        </Card>
        <Card title="Integrations">
          <p>OpenCode sync uses backend import and MCP facade only.</p>
          <Badge tone="success">MCP tools available</Badge>
        </Card>
      </section>
      <Card title="Appearance token preview">
        <div className="token-row">
          <span className="swatch swatch-accent" />
          <span>Accent</span>
          <span className="swatch swatch-success" />
          <span>Success</span>
          <span className="swatch swatch-warning" />
          <span>Warning</span>
          <span className="swatch swatch-danger" />
          <span>Danger</span>
        </div>
      </Card>
    </div>
  );
}
