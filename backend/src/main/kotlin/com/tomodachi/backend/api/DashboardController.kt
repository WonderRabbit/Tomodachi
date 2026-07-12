package com.tomodachi.backend.api

import com.tomodachi.backend.domain.AgentRunStatus
import com.tomodachi.backend.domain.ArtifactStatus
import com.tomodachi.backend.domain.HealthStatus
import com.tomodachi.backend.domain.TaskStatus
import com.tomodachi.backend.repo.AgentRunRepository
import com.tomodachi.backend.repo.ArtifactRepository
import com.tomodachi.backend.repo.ProjectRepository
import com.tomodachi.backend.repo.TaskArtifactLinkRepository
import com.tomodachi.backend.repo.TaskRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/dashboard")
class DashboardController(
    private val projects: ProjectRepository,
    private val tasks: TaskRepository,
    private val artifacts: ArtifactRepository,
    private val links: TaskArtifactLinkRepository,
    private val agentRuns: AgentRunRepository,
) {
    @GetMapping("/summary")
    fun summary(): DashboardSummaryDto {
        val projectList = projects.findAll()
        val taskList = tasks.findAll()
        val artifactList = artifacts.findAll()
        val linkList = links.findAll()
        val runList = agentRuns.findAll()
        val blockedTasks = taskList.filter { task -> task.status == TaskStatus.Blocked }
        val reviewRuns = runList.filter { run ->
            run.requiresReview || run.status == AgentRunStatus.ReviewRequired
        }

        return DashboardSummaryDto(
            activeProjects = projectList.count { project -> project.status != HealthStatus.Blocked },
            tasksInFlight = taskList.count { task -> task.status != TaskStatus.Done },
            blockedTasks = blockedTasks.size,
            blockedTaskTitle = blockedTasks.firstOrNull()?.title,
            agentReviewQueue = reviewRuns.size,
            projects = projectList.map { project ->
                DashboardProjectSummaryDto(
                    id = project.id,
                    key = project.key,
                    name = project.name,
                    status = project.status,
                    progress = project.progress,
                    blockers = taskList.count { task ->
                        task.projectId == project.id && task.status == TaskStatus.Blocked
                    },
                )
            },
            reviewRuns = reviewRuns.map { run ->
                DashboardReviewRunDto(
                    id = run.id,
                    model = run.model,
                    unresolvedCount = run.unresolvedCount,
                )
            },
            architecture = DashboardArchitectureSummaryDto(
                acceptedArtifacts = artifactList.count { artifact -> artifact.status == ArtifactStatus.Accepted },
                staleArtifacts = artifactList.count { artifact -> artifact.status == ArtifactStatus.Stale },
                linkedTasks = linkList.map { link -> link.taskId }.distinct().size,
            ),
        )
    }
}
