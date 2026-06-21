package com.tomodachi.backend.api

import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.domain.TaskItem
import com.tomodachi.backend.repo.ProductRepository
import com.tomodachi.backend.repo.ProjectRepository
import com.tomodachi.backend.repo.TaskRepository
import com.tomodachi.backend.security.PrincipalUser
import com.tomodachi.backend.service.toDto
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class LifecycleController(
    private val products: ProductRepository,
    private val projects: ProjectRepository,
    private val tasks: TaskRepository,
) {
    @GetMapping("/products")
    fun products(): PageResponse<ProductDto> = products.findAll().map { it.toDto() }.toPage()

    @GetMapping("/projects")
    fun projects(): PageResponse<ProjectDto> = projects.findAll().map { it.toDto() }.toPage()

    @GetMapping("/projects/{projectId}")
    fun project(@PathVariable projectId: String): ProjectDto =
        projects.findById(projectId).orElseThrow().toDto()

    @GetMapping("/tasks")
    fun tasks(): PageResponse<TaskDto> = tasks.findAll().map { it.toDto() }.toPage()

    @GetMapping("/tasks/{taskId}")
    fun task(@PathVariable taskId: String): TaskDto =
        tasks.findById(taskId).orElseThrow().toDto()

    @PostMapping("/tasks")
    fun createTask(
        @AuthenticationPrincipal actor: PrincipalUser,
        @RequestBody request: CreateTaskRequest,
    ): TaskDto {
        if (actor.role !in setOf(Role.ADMIN, Role.PRODUCT_MANAGER, Role.ENGINEER)) {
            throw ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Role cannot create tasks")
        }
        val next = TaskItem(
            id = "task_${System.currentTimeMillis()}",
            number = "TMD-${tasks.count() + 101}",
            projectId = request.projectId,
            title = request.title,
            priority = request.priority,
            assignee = actor.email,
        )
        return tasks.save(next).toDto()
    }
}

private fun <T> List<T>.toPage(): PageResponse<T> = PageResponse(this, size)
