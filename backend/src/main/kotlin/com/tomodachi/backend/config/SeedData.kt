package com.tomodachi.backend.config

import com.tomodachi.backend.domain.*
import com.tomodachi.backend.repo.*
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component

@Component
class SeedData(
    private val users: UserRepository,
    private val products: ProductRepository,
    private val workspaces: WorkspaceRepository,
    private val projects: ProjectRepository,
    private val tasks: TaskRepository,
    private val artifacts: ArtifactRepository,
    private val links: TaskArtifactLinkRepository,
    private val agentRuns: AgentRunRepository,
    private val passwordEncoder: PasswordEncoder,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        if (users.count() > 0) return
        val initialPasswordHash = passwordEncoder.encode(LOCAL_SEED_PASSWORD)
        users.saveAll(
            listOf(
                UserAccount("user_admin", "admin@tomodachi.local", initialPasswordHash, "Admin", Role.ADMIN),
                UserAccount("user_engineer", "engineer@tomodachi.local", initialPasswordHash, "Engineer", Role.ENGINEER),
                UserAccount("user_viewer", "viewer@tomodachi.local", initialPasswordHash, "Viewer", Role.VIEWER),
                UserAccount("user_agent", "agent@tomodachi.local", initialPasswordHash, "Agent", Role.AGENT_SERVICE),
            ),
        )
        products.save(Product("product_tomodachi", "TMD", "Tomodachi", HealthStatus.Watch))
        workspaces.save(Workspace("workspace_core", "product_tomodachi", "Core workspace", "Product Ops"))
        projects.save(Project("project_alpha", "product_tomodachi", "workspace_core", "TMD-A1", "Lifecycle dashboard alpha", "Product Ops", HealthStatus.Watch, 68))
        seedTasks()
        seedArtifacts()
        agentRuns.save(
            AgentRun("run_review_01", AgentRunStatus.ReviewRequired, "OpenCode", "qwen3-coder", "task-implementation", "task_seed_ready", 4, 2, true, mutableSetOf("backend/TaskService.kt")),
        )
    }

    private fun seedTasks() {
        tasks.saveAll(
            listOf(
                TaskItem("task_seed_ready", "TMD-101", "project_alpha", "Create Spring API client boundary", TaskStatus.Ready, Priority.Normal, "Engineer"),
                TaskItem("task_seed_review", "TMD-102", "project_alpha", "Define transition rollback surface", TaskStatus.Review, Priority.Urgent, "Reviewer"),
                TaskItem("task_seed_blocked", "TMD-103", "project_alpha", "Normalize OpenCode unresolved evidence", TaskStatus.Blocked, Priority.High, "Agent Platform"),
            ),
        )
    }

    private fun seedArtifacts() {
        artifacts.saveAll(
            listOf(
                ArchitectureArtifact("adr_001", ArtifactType.ADR, "Backend owns OpenCode normalized metadata", ArtifactStatus.Accepted, "docs/adr/001-agent-metadata.md", "Architecture", "Backend normalizes agent metadata before UI display."),
                ArchitectureArtifact("api_003", ArtifactType.API, "Lifecycle summary contract", ArtifactStatus.Proposed, "openapi/lifecycle-summary.yaml", "Product Ops", "Dashboard consumes backend summaries."),
            ),
        )
        links.saveAll(
            listOf(
                TaskArtifactLink("link_1", "task_seed_ready", "adr_001"),
                TaskArtifactLink("link_2", "task_seed_ready", "api_003"),
            ),
        )
    }
}

private const val LOCAL_SEED_PASSWORD = "password"
