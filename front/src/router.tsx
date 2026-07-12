import {
  Outlet,
  Navigate,
  createRootRoute,
  createRoute,
  createRouter,
  useLocation,
} from "@tanstack/react-router";
import { loadAuthSession } from "./auth/session";
import { AppShell } from "./components/AppShell";
import { AgentRunDetailPage, AgentRunsPage } from "./pages/AgentRunsPage";
import { ArchitectureDetailPage, ArchitecturePage } from "./pages/ArchitecturePage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProjectBoardPage } from "./pages/ProjectBoardPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TaskDetailPage, TasksPage } from "./pages/TasksPage";
import { WorkspacePage } from "./pages/WorkspacePage";

const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useLocation({ select: (location) => location.pathname });

  if (pathname === "/login") {
    return <Outlet />;
  }

  if (loadAuthSession() === null) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/products",
  component: ProductsPage,
});

const productDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/products/$productId",
  component: ProductDetailPage,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: ProjectsPage,
});

const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  component: ProjectDetailPage,
});

const projectBoardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/tasks/board",
  component: ProjectBoardPage,
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId",
  component: WorkspacePage,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tasks",
  component: TasksPage,
});

const taskDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tasks/$taskId",
  component: TaskDetailPage,
});

const architectureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/architecture",
  component: ArchitecturePage,
});

const architectureDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/architecture/adr/$artifactId",
  component: ArchitectureDetailPage,
});

const agentRunsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agent-runs",
  component: AgentRunsPage,
});

const agentRunDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agent-runs/$runId",
  component: AgentRunDetailPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  productsRoute,
  productDetailRoute,
  projectsRoute,
  projectDetailRoute,
  projectBoardRoute,
  workspaceRoute,
  tasksRoute,
  taskDetailRoute,
  architectureRoute,
  architectureDetailRoute,
  agentRunsRoute,
  agentRunDetailRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
