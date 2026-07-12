package com.tomodachi.backend.api

import com.tomodachi.backend.domain.Product
import com.tomodachi.backend.domain.HealthStatus
import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.domain.TaskItem
import com.tomodachi.backend.domain.TaskStatus
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
    fun products(): PageResponse<ProductDto> = products.findAll().map { product -> summarizeProduct(product) }.toPage()

    @GetMapping("/products/{productId}")
    fun product(@PathVariable productId: String): ProductDto =
        summarizeProduct(products.findById(productId).orElseThrow())

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

    private fun summarizeProduct(product: Product): ProductDto {
        val productProjects = projects.findByProductId(product.id)
        val projectIds = productProjects.map { it.id }.toSet()
        val productTasks = tasks.findAll().filter { it.projectId in projectIds }
        val lastActivity = productTasks.maxByOrNull { it.updatedAt }?.updatedAt?.toString() ?: "No activity"

        return ProductDto(
            id = product.id,
            code = product.code,
            name = product.name,
            status = product.status,
            activeProjects = productProjects.count { it.status != HealthStatus.Blocked },
            openTasks = productTasks.count { it.status != TaskStatus.Done },
            lastActivity = lastActivity,
        )
    }
}

private fun <T> List<T>.toPage(): PageResponse<T> = PageResponse(this, size)
