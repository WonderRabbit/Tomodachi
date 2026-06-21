package com.tomodachi.backend.api

import com.tomodachi.backend.security.PrincipalUser
import com.tomodachi.backend.service.TaskTransitionService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/tasks")
class TaskController(private val transitions: TaskTransitionService) {
    @PostMapping("/{taskId}/transition")
    fun transition(
        @PathVariable taskId: String,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @AuthenticationPrincipal actor: PrincipalUser,
        @RequestBody request: TransitionRequest,
    ): TransitionResponse =
        transitions.transition(
            taskId,
            request.toStatus,
            request.reason,
            idempotencyKey ?: UUID.randomUUID().toString(),
            actor,
        )
}
