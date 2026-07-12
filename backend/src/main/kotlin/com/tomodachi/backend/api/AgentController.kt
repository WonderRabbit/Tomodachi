package com.tomodachi.backend.api

import com.fasterxml.jackson.databind.JsonNode
import com.tomodachi.backend.domain.AuditEvent
import com.tomodachi.backend.domain.OutboxEvent
import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.domain.TaskStatus
import com.tomodachi.backend.repo.AgentRunRepository
import com.tomodachi.backend.repo.ArtifactRepository
import com.tomodachi.backend.repo.AuditEventRepository
import com.tomodachi.backend.repo.OutboxEventRepository
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
    private val auditEvents: AuditEventRepository,
    private val outboxEvents: OutboxEventRepository,
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
            McpTool("tomodachi.record_agent_event", "Record a protocol envelope as audit and outbox events."),
            McpTool("tomodachi.transition_task", "Transition a task through the backend state machine."),
            McpTool("tomodachi.attach_evidence", "Attach normalized evidence metadata to an agent run."),
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
            return taskContext(request.arguments.requiredText("taskId"), actor)
        }
        if (request.name == "tomodachi.transition_task") {
            val taskId = request.arguments.requiredText("taskId")
            val toStatus = request.arguments.requiredStatus("toStatus")
            val reason = request.arguments.requiredText("reason")
            val key = request.arguments.optionalText("idempotencyKey") ?: UUID.randomUUID().toString()
            return transitions.transition(taskId, toStatus, reason, key, actor)
        }
        if (request.name == "tomodachi.record_agent_event") {
            return recordAgentEvent(request.arguments, actor)
        }
        if (request.name == "tomodachi.attach_evidence") {
            return attachEvidence(request.arguments, actor)
        }
        throw ApiException(HttpStatus.NOT_FOUND, "UNKNOWN_TOOL", "Unknown MCP tool")
    }

    private fun recordAgentEvent(arguments: JsonNode, actor: PrincipalUser): McpAcceptedEventResponse {
        val protocolVersion = arguments.requiredText("protocolVersion")
        if (protocolVersion != "tomodachi-agent.v1") {
            throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Unsupported protocol version")
        }
        val taskId = arguments.requiredText("taskId")
        if (!tasks.existsById(taskId)) {
            throw ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found")
        }
        val eventType = arguments.requiredObject("event").requiredText("type")
        val key = arguments.requiredText("idempotencyKey")
        arguments.requiredText("correlationId")
        arguments.requiredText("traceparent")

        auditEvents.findByActionAndDetail(AGENT_EVENT_ACTION, key)?.let { event ->
            return McpAcceptedEventResponse(event.id, outboxEvents.countByAggregateId(taskId))
        }

        val eventId = "agent_event_${UUID.randomUUID()}"
        auditEvents.save(AuditEvent(eventId, taskId, AGENT_EVENT_ACTION, actor.email, key))
        outboxEvents.save(OutboxEvent("outbox_$eventId", taskId, eventType, arguments.toString()))
        return McpAcceptedEventResponse(eventId, outboxEvents.countByAggregateId(taskId))
    }

    private fun attachEvidence(arguments: JsonNode, actor: PrincipalUser): McpAttachEvidenceResponse {
        val taskId = arguments.requiredText("taskId")
        val runId = arguments.requiredText("runId")
        val key = arguments.requiredText("idempotencyKey")
        val evidence = arguments.requiredArray("evidence")
        if (evidence.isEmpty) {
            throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Evidence must not be empty")
        }
        val run = runs.findById(runId).orElseThrow {
            ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found")
        }
        if (run.taskId != taskId) {
            throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Run does not belong to task")
        }
        evidence.forEach { item ->
            item.requiredText("kind")
            item.requiredText("path")
            item.requiredText("summary")
        }

        auditEvents.findByActionAndDetail(ATTACH_EVIDENCE_ACTION, key)?.let {
            return McpAttachEvidenceResponse(emptyList(), run.evidenceCount)
        }

        val evidenceIds = evidence.map { "evidence_${UUID.randomUUID()}" }
        run.evidenceCount += evidenceIds.size
        runs.save(run)
        auditEvents.save(AuditEvent("agent_evidence_${UUID.randomUUID()}", taskId, ATTACH_EVIDENCE_ACTION, actor.email, key))
        outboxEvents.save(OutboxEvent("outbox_evidence_${UUID.randomUUID()}", taskId, "com.tomodachi.agent.evidence.attached.v1", arguments.toString()))
        return McpAttachEvidenceResponse(evidenceIds, run.evidenceCount)
    }
}

private const val AGENT_EVENT_ACTION = "AGENT_EVENT_RECORDED"
private const val ATTACH_EVIDENCE_ACTION = "AGENT_EVIDENCE_ATTACHED"

private fun JsonNode.requiredText(name: String): String =
    this.get(name)?.takeIf { it.isTextual }?.asText()?.takeIf { it.isNotBlank() }
        ?: throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Missing MCP argument: $name")

private fun JsonNode.optionalText(name: String): String? =
    this.get(name)?.takeIf { it.isTextual }?.asText()?.takeIf { it.isNotBlank() }

private fun JsonNode.requiredObject(name: String): JsonNode =
    this.get(name)?.takeIf { it.isObject }
        ?: throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Missing MCP argument: $name")

private fun JsonNode.requiredArray(name: String): JsonNode =
    this.get(name)?.takeIf { it.isArray }
        ?: throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Missing MCP argument: $name")

private fun JsonNode.requiredStatus(name: String): TaskStatus =
    try {
        TaskStatus.valueOf(requiredText(name))
    } catch (error: IllegalArgumentException) {
        throw ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "Invalid task status")
    }
