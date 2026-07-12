package com.tomodachi.backend.api

import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.repo.AgentRunRepository
import com.tomodachi.backend.repo.ArtifactRepository
import com.tomodachi.backend.repo.ProjectRepository
import com.tomodachi.backend.repo.TaskRepository
import com.tomodachi.backend.security.PrincipalUser
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class SearchController(
    private val tasks: TaskRepository,
    private val projects: ProjectRepository,
    private val artifacts: ArtifactRepository,
    private val runs: AgentRunRepository,
) {
    @GetMapping("/search")
    fun search(
        @RequestParam q: String?,
        @RequestParam type: String?,
        @AuthenticationPrincipal actor: PrincipalUser,
    ): SearchResponse {
        val query = q?.trim().orEmpty()
        if (query.isBlank()) {
            throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Search query is required")
        }

        val normalizedType = type?.trim()?.takeIf { it.isNotEmpty() }
        if (normalizedType != null && normalizedType !in SEARCH_TYPES) {
            throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Invalid search type")
        }

        val needle = query.lowercase()
        val results = buildList {
            if (normalizedType == null || normalizedType == "task") {
                addAll(taskResults(needle))
            }
            if (normalizedType == null || normalizedType == "project") {
                addAll(projectResults(needle))
            }
            if (normalizedType == null || normalizedType == "artifact") {
                addAll(artifactResults(needle))
            }
            if ((normalizedType == null || normalizedType == "agent-run") && actor.canReadAgentRuns()) {
                addAll(agentRunResults(needle))
            }
        }.sortedWith(compareBy<SearchResultDto> { it.type }.thenBy { it.title }).take(20)

        return SearchResponse(query, normalizedType, results, results.size)
    }

    private fun taskResults(needle: String): List<SearchResultDto> =
        tasks.findAll().filter { task ->
            listOf(task.id, task.number, task.title, task.projectId, task.assignee).any { it.matchesSearch(needle) }
        }.map { task ->
            SearchResultDto(
                type = "task",
                id = task.id,
                title = "${task.number} · ${task.title}",
                subtitle = "${task.status} · ${task.assignee}",
                path = "/tasks/${task.id}",
            )
        }

    private fun projectResults(needle: String): List<SearchResultDto> =
        projects.findAll().filter { project ->
            listOf(project.id, project.key, project.name, project.owner).any { it.matchesSearch(needle) }
        }.map { project ->
            SearchResultDto(
                type = "project",
                id = project.id,
                title = "${project.key} · ${project.name}",
                subtitle = "${project.status} · ${project.owner}",
                path = "/projects/${project.id}",
            )
        }

    private fun artifactResults(needle: String): List<SearchResultDto> =
        artifacts.findAll().filter { artifact ->
            listOf(artifact.id, artifact.type.name, artifact.title, artifact.sourcePath).any { it.matchesSearch(needle) }
        }.map { artifact ->
            SearchResultDto(
                type = "artifact",
                id = artifact.id,
                title = artifact.title,
                subtitle = "${artifact.type} · ${artifact.status}",
                path = "/architecture/adr/${artifact.id}",
            )
        }

    private fun agentRunResults(needle: String): List<SearchResultDto> =
        runs.findAll().filter { run ->
            listOf(run.id, run.provider, run.model, run.agentName, run.taskId).any { it.matchesSearch(needle) }
        }.map { run ->
            SearchResultDto(
                type = "agent-run",
                id = run.id,
                title = run.id,
                subtitle = "${run.status} · ${run.provider}/${run.model}",
                path = "/agent-runs/${run.id}",
            )
        }

    private fun PrincipalUser.canReadAgentRuns(): Boolean =
        role in setOf(Role.ADMIN, Role.ENGINEER, Role.AGENT_SERVICE)
}

private val SEARCH_TYPES = setOf("task", "project", "artifact", "agent-run")

private fun String.matchesSearch(needle: String): Boolean = lowercase().contains(needle)
