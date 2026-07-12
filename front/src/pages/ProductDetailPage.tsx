import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { requestProduct } from "../api/productsClient";
import { isApiClientError } from "../api/http";
import { Badge, Card, EmptyState, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { Product } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

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
