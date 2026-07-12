import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { requestProduct, requestProducts } from "../api/productsClient";
import { isApiClientError } from "../api/http";
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

  useUnauthorizedRedirect(productsQuery.error, navigate);

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

export function ProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams({ from: "/products/$productId" });
  const productQuery = useQuery({
    queryFn: ({ signal }) => requestProduct(productId, signal),
    queryKey: ["product", productId],
    retry: false,
  });

  useUnauthorizedRedirect(productQuery.error, navigate);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Lifecycle"
        title={productQuery.data?.name ?? "Product detail"}
        detail={`Backend-owned product summary for ${productId}.`}
        actions={<Link className="button" to="/products">Back to products</Link>}
      />
      <ProductDetailContent
        error={productQuery.error}
        isLoading={productQuery.isLoading}
        onRetry={() => {
          void productQuery.refetch();
        }}
        product={productQuery.data}
      />
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

  if (isApiClientError(error) && error.status === 403) {
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
                <Link to="/products/$productId" params={{ productId: product.id }}>
                  {product.name}
                </Link>
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

function ProductDetailContent({
  error,
  isLoading,
  onRetry,
  product,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly product: Product | undefined;
}) {
  if (isLoading) {
    return (
      <Card title="Product summary">
        <EmptyState title="Loading product" detail="Fetching the backend product summary." />
      </Card>
    );
  }

  if (isApiClientError(error) && error.status === 403) {
    return (
      <Card title="Product summary">
        <EmptyState title="Forbidden" detail="Your current role cannot read this product summary." />
      </Card>
    );
  }

  if (isApiClientError(error) && (error.status === 404 || error.code === "NOT_FOUND")) {
    return (
      <Card title="Product summary">
        <EmptyState title="Product not found" detail="The requested product id is not available from the backend." />
      </Card>
    );
  }

  if (error !== null) {
    return (
      <Card title="Product summary">
        <div className="empty-state">
          <strong>Product unavailable</strong>
          <span>Backend product detail could not be loaded.</span>
          <button className="button" type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      </Card>
    );
  }

  if (product === undefined) {
    return (
      <Card title="Product summary">
        <EmptyState title="Product not found" detail="The backend did not return product detail." />
      </Card>
    );
  }

  return (
    <>
      <section className="metric-grid compact">
        <Card>
          <strong>{product.code}</strong>
          <span>product code</span>
        </Card>
        <Card>
          <strong>{product.activeProjects}</strong>
          <span>active projects</span>
        </Card>
        <Card>
          <strong>{product.openTasks}</strong>
          <span>open tasks</span>
        </Card>
        <Card>
          <strong>{product.lastActivity}</strong>
          <span>last activity</span>
        </Card>
      </section>
      <Card title="Product summary">
        <div className="table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Field">Product id</td>
                <td data-label="Value">{product.id}</td>
              </tr>
              <tr>
                <td data-label="Field">Name</td>
                <td data-label="Value">{product.name}</td>
              </tr>
              <tr>
                <td data-label="Field">Status</td>
                <td data-label="Value">
                  <Badge tone={statusTone(product.status)}>{product.status}</Badge>
                </td>
              </tr>
              <tr>
                <td data-label="Field">Backend source</td>
                <td data-label="Value">Product detail endpoint</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function useUnauthorizedRedirect(error: Error | null, navigate: ReturnType<typeof useNavigate>): void {
  useEffect(() => {
    if (isApiClientError(error) && error.status === 401) {
      clearAuthSession();
      void navigate({ to: "/login" });
    }
  }, [error, navigate]);
}
