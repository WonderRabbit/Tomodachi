package com.tomodachi.backend.service

import com.tomodachi.backend.api.ApiException
import com.tomodachi.backend.api.TransitionResponse
import com.tomodachi.backend.domain.AuditEvent
import com.tomodachi.backend.domain.OutboxEvent
import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.domain.TaskStatus
import com.tomodachi.backend.domain.TaskTransition
import com.tomodachi.backend.repo.AuditEventRepository
import com.tomodachi.backend.repo.OutboxEventRepository
import com.tomodachi.backend.repo.TaskRepository
import com.tomodachi.backend.repo.TaskTransitionRepository
import com.tomodachi.backend.security.PrincipalUser
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Service
class TaskTransitionService(
    private val tasks: TaskRepository,
    private val transitions: TaskTransitionRepository,
    private val audits: AuditEventRepository,
    private val outbox: OutboxEventRepository,
) {
    private val allowed = mapOf(
        TaskStatus.Ready to listOf(TaskStatus.InProgress, TaskStatus.Blocked),
        TaskStatus.InProgress to listOf(TaskStatus.Review, TaskStatus.Blocked),
        TaskStatus.Blocked to listOf(TaskStatus.Ready, TaskStatus.InProgress),
        TaskStatus.Review to listOf(TaskStatus.QA, TaskStatus.Done, TaskStatus.Blocked),
        TaskStatus.QA to listOf(TaskStatus.Done, TaskStatus.Blocked),
        TaskStatus.Done to emptyList(),
    )

    fun statusMachine(): Map<TaskStatus, List<TaskStatus>> = allowed

    @Transactional
    fun transition(
        taskId: String,
        toStatus: TaskStatus,
        reason: String,
        idempotencyKey: String,
        actor: PrincipalUser,
    ): TransitionResponse {
        if (actor.role !in setOf(Role.ADMIN, Role.ENGINEER, Role.PRODUCT_MANAGER, Role.AGENT_SERVICE)) {
            throw ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Role cannot transition tasks")
        }
        transitions.findByIdempotencyKey(idempotencyKey)?.let { previous ->
            if (previous.taskId != taskId || previous.toStatus != toStatus) {
                throw ApiException(
                    HttpStatus.CONFLICT,
                    "IDEMPOTENCY_CONFLICT",
                    "Idempotency key was already used for a different transition",
                )
            }
            val task = tasks.findById(taskId).orElseThrow()
            return TransitionResponse(task.toDto(), outbox.countByAggregateId(taskId))
        }
        val task = tasks.findById(taskId).orElseThrow()
        val fromStatus = task.status
        if (!allowed.getValue(fromStatus).contains(toStatus)) {
            throw ApiException(HttpStatus.CONFLICT, "INVALID_TRANSITION", "$fromStatus cannot transition to $toStatus")
        }
        task.status = toStatus
        task.updatedAt = Instant.now()
        tasks.save(task)
        transitions.save(TaskTransition(UUID.randomUUID().toString(), taskId, fromStatus, toStatus, actor.email, reason, idempotencyKey))
        audits.save(AuditEvent(UUID.randomUUID().toString(), taskId, "task.transition", actor.email, "$fromStatus->$toStatus"))
        outbox.save(OutboxEvent(UUID.randomUUID().toString(), taskId, "tomodachi.task.transitioned", """{"taskId":"$taskId","toStatus":"$toStatus"}"""))
        return TransitionResponse(task.toDto(), outbox.countByAggregateId(taskId))
    }
}
