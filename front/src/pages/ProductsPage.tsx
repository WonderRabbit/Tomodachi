import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { requestProducts } from "../api/productsClient";
import { ApiClientError } from "../api/http";
import { clearAuthSession } from "../auth/session";
import { Badge, Card, EmptyState, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { Product } from "../types";

export function ProductsPage() {
  const navigate = useNavigate();
  const productsQuery = useQuery({
    queryFn: ({ signal }) => requestProducts(signal),
    queryKey: ["products"],
    retry: false,
  });

  useEffect(() => {
    const error = productsQuery.error;

    if (error instanceof ApiClientError && error.status === 401) {
      clearAuthSession();
      void navigate({ to: "/login" });
    }
  }, [productsQuery.error, navigate]);

  const products = productsQuery.data ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Lifecycle"
        title="Products"
        detail="Product-level health, active workspaces, open task volume, and recent activity."
      />
      <Card title="Product portfolio">
        <ProductsContent
          error={productsQuery.error}
          isLoading={productsQuery.isLoading}
          onRetry={() => {
            void productsQuery.refetch();
          }}
          products={products}
        />
      </Card>
    </div>
  );
}

function ProductsContent({
  error,
  isLoading,
  onRetry,
  products,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly products: readonly Product[];
}) {
  if (isLoading) {
    return <EmptyState title="Loading products" detail="Fetching product summaries from the backend." />;
  }

  if (error instanceof ApiClientError && error.status === 403) {
    return <EmptyState title="Forbidden" detail="Your current role cannot read product summaries." />;
  }

  if (error !== null) {
    return (
      <div className="empty-state">
        <strong>Products unavailable</strong>
        <span>Backend product summaries could not be loaded.</span>
        <button className="button" type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return <EmptyState title="No products" detail="The backend returned an empty product portfolio." />;
  }

  return (
    <div className="table-wrap">
      <table className="responsive-table">
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
              <td data-label="Code">{product.code}</td>
              <td data-label="Name">
                <Link to="/projects">{product.name}</Link>
              </td>
              <td data-label="Status">
                <Badge tone={statusTone(product.status)}>{product.status}</Badge>
              </td>
              <td data-label="Active projects">{product.activeProjects}</td>
              <td data-label="Open tasks">{product.openTasks}</td>
              <td data-label="Last activity">{product.lastActivity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
