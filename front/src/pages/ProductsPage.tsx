import { Link } from "@tanstack/react-router";
import { products } from "../mockData";
import { Badge, Card, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";

export function ProductsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Lifecycle"
        title="Products"
        detail="Product-level health, active workspaces, open task volume, and recent activity."
      />
      <Card title="Product portfolio">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Active projects</th>
                <th>Open tasks</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.code}</td>
                  <td>
                    <Link to="/projects">{product.name}</Link>
                  </td>
                  <td>
                    <Badge tone={statusTone(product.status)}>{product.status}</Badge>
                  </td>
                  <td>{product.activeProjects}</td>
                  <td>{product.openTasks}</td>
                  <td>{product.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
