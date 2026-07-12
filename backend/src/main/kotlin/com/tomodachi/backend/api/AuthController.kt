package com.tomodachi.backend.api

import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.security.PrincipalUser
import com.tomodachi.backend.security.TokenService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(private val tokens: TokenService) {
    @PostMapping("/login")
    fun login(@RequestBody request: LoginRequest): ResponseEntity<Any> =
        try {
            ResponseEntity.ok(AuthResponse(tokens.issue(request.email, request.password)))
        } catch (error: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("UNAUTHORIZED", "Bad credentials"))
        }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal actor: PrincipalUser): AuthMeResponse =
        AuthMeResponse(actor.id, actor.email, actor.role, scopesFor(actor.role))
}

private fun scopesFor(role: Role): List<String> =
    when (role) {
        Role.ADMIN -> listOf(
            "product:read",
            "project:read",
            "task:read",
            "task:write",
            "architecture:read",
            "agent:read",
            "admin:write",
        )
        Role.PRODUCT_MANAGER,
        Role.ENGINEER,
        -> listOf("product:read", "project:read", "task:read", "task:write", "architecture:read", "agent:read")
        Role.REVIEWER,
        Role.VIEWER,
        -> listOf("product:read", "project:read", "task:read", "architecture:read", "agent:read")
        Role.AGENT_SERVICE -> listOf("task:read", "task:write", "architecture:read", "agent:invoke")
    }
