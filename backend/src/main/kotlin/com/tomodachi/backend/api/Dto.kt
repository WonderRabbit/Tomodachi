package com.tomodachi.backend.api

import com.tomodachi.backend.domain.AgentRunStatus
import com.tomodachi.backend.domain.ArtifactStatus
import com.tomodachi.backend.domain.ArtifactType
import com.tomodachi.backend.domain.HealthStatus
import com.tomodachi.backend.domain.Priority
import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.domain.TaskStatus

data class LoginRequest(val email: String, val password: String)
data class AuthResponse(val accessToken: String, val tokenType: String = "Bearer")
data class AuthMeResponse(val id: String, val email: String, val role: Role, val scopes: List<String>)
data class ErrorResponse(val code: String, val message: String)

data class PageResponse<T>(val items: List<T>, val total: Int)
data class CreateTaskRequest(val projectId: String, val title: String, val priority: Priority)
data class TransitionRequest(val toStatus: TaskStatus, val reason: String)
data class TransitionResponse(val task: TaskDto, val outboxEventCount: Long)

data class ProductDto(
    val id: String,
    val code: String,
    val name: String,
    val status: HealthStatus,
    val activeProjects: Int = 0,
    val openTasks: Int = 0,
    val lastActivity: String = "No activity",
)
data class ProjectDto(
    val id: String,
    val key: String,
    val name: String,
    val owner: String,
    val status: HealthStatus,
    val progress: Int,
)

data class TaskDto(
    val id: String,
    val number: String,
    val projectId: String,
    val title: String,
    val status: TaskStatus,
    val priority: Priority,
    val assignee: String,
)

data class ArtifactDto(
    val id: String,
    val type: ArtifactType,
    val title: String,
    val status: ArtifactStatus,
    val sourcePath: String,
    val linkedTaskIds: List<String>,
)

data class AgentRunDto(
    val id: String,
    val status: AgentRunStatus,
    val provider: String,
    val model: String,
    val agentName: String,
    val taskId: String,
    val changedFiles: Set<String>,
    val evidenceCount: Int,
    val unresolvedCount: Int,
    val requiresReview: Boolean,
)

data class TaskContextResponse(
    val task: TaskDto,
    val project: ProjectDto,
    val statusMachine: Map<TaskStatus, List<TaskStatus>>,
    val artifacts: List<ArtifactDto>,
    val agentRuns: List<AgentRunDto>,
    val rules: List<String>,
)

data class McpInvokeRequest(val name: String, val arguments: Map<String, String>)
data class McpTool(val name: String, val description: String)
data class McpToolsResponse(val tools: List<McpTool>)

data class SearchResultDto(
    val type: String,
    val id: String,
    val title: String,
    val subtitle: String,
    val path: String,
)
data class SearchResponse(val query: String, val type: String?, val items: List<SearchResultDto>, val total: Int)

data class OpenCodeSyncSummaryDto(
    val source: String,
    val status: String,
    val lastSyncLabel: String,
    val totalRuns: Int,
    val reviewRequiredRuns: Int,
    val failedRuns: Int,
    val unresolvedEvidence: Int,
    val changedFiles: Int,
)

data class DashboardProjectSummaryDto(
    val id: String,
    val key: String,
    val name: String,
    val status: HealthStatus,
    val progress: Int,
    val blockers: Int,
)

data class DashboardReviewRunDto(
    val id: String,
    val model: String,
    val unresolvedCount: Int,
)

data class DashboardArchitectureSummaryDto(
    val acceptedArtifacts: Int,
    val staleArtifacts: Int,
    val linkedTasks: Int,
)

data class DashboardSummaryDto(
    val activeProjects: Int,
    val tasksInFlight: Int,
    val blockedTasks: Int,
    val blockedTaskTitle: String?,
    val agentReviewQueue: Int,
    val projects: List<DashboardProjectSummaryDto>,
    val reviewRuns: List<DashboardReviewRunDto>,
    val architecture: DashboardArchitectureSummaryDto,
)
