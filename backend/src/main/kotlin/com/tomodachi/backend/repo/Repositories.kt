package com.tomodachi.backend.repo

import com.tomodachi.backend.domain.AgentRun
import com.tomodachi.backend.domain.ArchitectureArtifact
import com.tomodachi.backend.domain.AuditEvent
import com.tomodachi.backend.domain.OutboxEvent
import com.tomodachi.backend.domain.Product
import com.tomodachi.backend.domain.Project
import com.tomodachi.backend.domain.TaskArtifactLink
import com.tomodachi.backend.domain.TaskItem
import com.tomodachi.backend.domain.TaskTransition
import com.tomodachi.backend.domain.UserAccount
import com.tomodachi.backend.domain.Workspace
import org.springframework.data.jpa.repository.JpaRepository

interface UserRepository : JpaRepository<UserAccount, String> {
    fun findByEmail(email: String): UserAccount?
}

interface ProductRepository : JpaRepository<Product, String>
interface WorkspaceRepository : JpaRepository<Workspace, String>
interface ProjectRepository : JpaRepository<Project, String> {
    fun findByProductId(productId: String): List<Project>
}

interface TaskRepository : JpaRepository<TaskItem, String> {
    fun findByProjectId(projectId: String): List<TaskItem>
}

interface ArtifactRepository : JpaRepository<ArchitectureArtifact, String>
interface TaskArtifactLinkRepository : JpaRepository<TaskArtifactLink, String> {
    fun findByTaskId(taskId: String): List<TaskArtifactLink>
    fun findByArtifactId(artifactId: String): List<TaskArtifactLink>
}

interface AgentRunRepository : JpaRepository<AgentRun, String> {
    fun findByTaskId(taskId: String): List<AgentRun>
}

interface TaskTransitionRepository : JpaRepository<TaskTransition, String> {
    fun findByTaskId(taskId: String): List<TaskTransition>
    fun findByIdempotencyKey(idempotencyKey: String): TaskTransition?
}

interface AuditEventRepository : JpaRepository<AuditEvent, String>
interface OutboxEventRepository : JpaRepository<OutboxEvent, String> {
    fun countByAggregateId(aggregateId: String): Long
}
