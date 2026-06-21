package com.tomodachi.backend.api

import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.domain.TaskStatus
import com.tomodachi.backend.repo.AgentRunRepository
import com.tomodachi.backend.repo.ArtifactRepository
import com.tomodachi.backend.repo.ProjectRepository
import com.tomodachi.backend.repo.TaskArtifactLinkRepository
import com.tomodachi.backend.repo.TaskRepository
import com.tomodachi.backend.security.PrincipalUser
import com.tomodachi.backend.service.TaskTransitionService
import com.tomodachi.backend.service.toDto
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api")
class AgentController(
    private val tasks: TaskRepository,
    private val projects: ProjectRepository,
    private val artifacts: ArtifactRepository,
    private val links: TaskArtifactLinkRepository,
    private val runs: AgentRunRepository,
    private val transitions: TaskTransitionService,
) {
    @GetMapping("/agent-runs")
    fun agentRuns(): PageResponse<AgentRunDto> = runs.findAll().map { it.toDto() }.let { PageResponse(it, it.size) }

    @GetMapping("/agent-runs/{runId}")
    fun agentRun(@PathVariable runId: String): AgentRunDto = runs.findById(runId).orElseThrow().toDto()

    @GetMapping("/opencode/task-context/{taskId}")
    fun taskContext(
        @PathVariable taskId: String,
        @AuthenticationPrincipal actor: PrincipalUser,
    ): TaskContextResponse {
        if (actor.role !in setOf(Role.ADMIN, Role.ENGINEER, Role.AGENT_SERVICE)) {
            throw ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Role cannot read task context")
        }
        val task = tasks.findById(taskId).orElseThrow()
        val project = projects.findById(task.projectId).orElseThrow()
        val taskArtifacts = links.findByTaskId(taskId).mapNotNull { link ->
            artifacts.findById(link.artifactId).orElse(null)?.toDto(links.findByArtifactId(link.artifactId).map { it.taskId })
        }
        return TaskContextResponse(
            task.toDto(),
            project.toDto(),
            transitions.statusMachine(),
            taskArtifacts,
            runs.findByTaskId(taskId).map { it.toDto() },
            listOf(
                "Frontend must call Tomodachi backend only.",
                "Agent tools must use scoped backend services, never direct database access.",
            ),
        )
    }

    @GetMapping("/mcp/tools")
    fun tools(): McpToolsResponse = McpToolsResponse(
        listOf(
            McpTool("tomodachi.get_task_context", "Return compact backend-owned task context."),
            McpTool("tomodachi.transition_task", "Transition a task through the backend state machine."),
        ),
    )

    @PostMapping("/mcp/invoke")
    fun invoke(
        @AuthenticationPrincipal actor: PrincipalUser,
        @RequestBody request: McpInvokeRequest,
    ): Any {
        if (actor.role != Role.AGENT_SERVICE) {
            throw ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only agent service can invoke MCP tools")
        }
        if (request.name == "tomodachi.get_task_context") {
            return taskContext(request.arguments.required("taskId"), actor)
        }
        if (request.name == "tomodachi.transition_task") {
            val taskId = request.arguments.required("taskId")
            val toStatus = request.arguments.requiredStatus("toStatus")
            val reason = request.arguments.required("reason")
            val key = request.arguments["idempotencyKey"] ?: UUID.randomUUID().toString()
            return transitions.transition(taskId, toStatus, reason, key, actor)
        }
        throw ApiException(HttpStatus.NOT_FOUND, "UNKNOWN_TOOL", "Unknown MCP tool")
    }
}

private fun Map<String, String>.required(name: String): String =
    this[name]?.takeIf { it.isNotBlank() }
        ?: throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Missing MCP argument: $name")

private fun Map<String, String>.requiredStatus(name: String): TaskStatus =
    try {
        TaskStatus.valueOf(required(name))
    } catch (error: IllegalArgumentException) {
        throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Invalid task status")
    }
