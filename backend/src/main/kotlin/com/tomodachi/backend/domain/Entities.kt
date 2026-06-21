package com.tomodachi.backend.domain

import jakarta.persistence.ElementCollection
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "users")
class UserAccount(
    @Id var id: String = "",
    var email: String = "",
    var password: String = "",
    var displayName: String = "",
    @Enumerated(EnumType.STRING) var role: Role = Role.VIEWER,
)

@Entity
class Product(
    @Id var id: String = "",
    var code: String = "",
    var name: String = "",
    @Enumerated(EnumType.STRING) var status: HealthStatus = HealthStatus.Healthy,
)

@Entity
class Workspace(
    @Id var id: String = "",
    var productId: String = "",
    var name: String = "",
    var owner: String = "",
)

@Entity
class Project(
    @Id var id: String = "",
    var productId: String = "",
    var workspaceId: String = "",
    @Column(name = "project_key") var key: String = "",
    var name: String = "",
    var owner: String = "",
    @Enumerated(EnumType.STRING) var status: HealthStatus = HealthStatus.Watch,
    var progress: Int = 0,
)

@Entity
@Table(name = "tasks")
class TaskItem(
    @Id var id: String = "",
    var number: String = "",
    var projectId: String = "",
    var title: String = "",
    @Enumerated(EnumType.STRING) var status: TaskStatus = TaskStatus.Ready,
    @Enumerated(EnumType.STRING) var priority: Priority = Priority.Normal,
    var assignee: String = "",
    var description: String = "",
    var updatedAt: Instant = Instant.now(),
)

@Entity
class ArchitectureArtifact(
    @Id var id: String = "",
    @Enumerated(EnumType.STRING) var type: ArtifactType = ArtifactType.ADR,
    var title: String = "",
    @Enumerated(EnumType.STRING) var status: ArtifactStatus = ArtifactStatus.Proposed,
    var sourcePath: String = "",
    var owner: String = "",
    var summary: String = "",
)

@Entity
class TaskArtifactLink(
    @Id var id: String = "",
    var taskId: String = "",
    var artifactId: String = "",
)

@Entity
class AgentRun(
    @Id var id: String = "",
    @Enumerated(EnumType.STRING) var status: AgentRunStatus = AgentRunStatus.Completed,
    var provider: String = "",
    var model: String = "",
    var agentName: String = "",
    var taskId: String = "",
    var evidenceCount: Int = 0,
    var unresolvedCount: Int = 0,
    var requiresReview: Boolean = false,
    @ElementCollection(fetch = FetchType.EAGER) var changedFiles: MutableSet<String> = mutableSetOf(),
)

@Entity
class TaskTransition(
    @Id var id: String = "",
    var taskId: String = "",
    @Enumerated(EnumType.STRING) var fromStatus: TaskStatus = TaskStatus.Ready,
    @Enumerated(EnumType.STRING) var toStatus: TaskStatus = TaskStatus.Ready,
    var actorEmail: String = "",
    var reason: String = "",
    var idempotencyKey: String = "",
    var createdAt: Instant = Instant.now(),
)

@Entity
class AuditEvent(
    @Id var id: String = "",
    var aggregateId: String = "",
    var action: String = "",
    var actorEmail: String = "",
    var detail: String = "",
    var createdAt: Instant = Instant.now(),
)

@Entity
class OutboxEvent(
    @Id var id: String = "",
    var aggregateId: String = "",
    var type: String = "",
    var payload: String = "",
    var createdAt: Instant = Instant.now(),
)
