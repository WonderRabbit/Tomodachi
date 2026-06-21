import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppShell } from "./components/AppShell";
import { AgentRunDetailPage, AgentRunsPage } from "./pages/AgentRunsPage";
import { ArchitectureDetailPage, ArchitecturePage } from "./pages/ArchitecturePage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProjectBoardPage, ProjectDetailPage, ProjectsPage } from "./pages/ProjectsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TaskDetailPage, TasksPage } from "./pages/TasksPage";

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/products",
  component: ProductsPage,
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
  productsRoute,
  projectsRoute,
  projectDetailRoute,
  projectBoardRoute,
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
