package com.tomodachi.backend.api

import com.tomodachi.backend.domain.TaskStatus
import com.tomodachi.backend.repo.ProductRepository
import com.tomodachi.backend.repo.ProjectRepository
import com.tomodachi.backend.repo.TaskRepository
import com.tomodachi.backend.repo.WorkspaceRepository
import com.tomodachi.backend.service.toDto
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/workspaces")
class WorkspaceController(
    private val workspaces: WorkspaceRepository,
    private val products: ProductRepository,
    private val projects: ProjectRepository,
    private val tasks: TaskRepository,
) {
    @GetMapping("/{workspaceId}")
    fun workspace(@PathVariable workspaceId: String): WorkspaceDto {
        val workspace = workspaces.findById(workspaceId).orElseThrow()
        val product = products.findById(workspace.productId).orElseThrow()
        val workspaceProjects = projects.findAll().filter { project -> project.workspaceId == workspace.id }
        val projectIds = workspaceProjects.map { project -> project.id }.toSet()
        val workspaceTasks = tasks.findAll().filter { task -> task.projectId in projectIds }

        return WorkspaceDto(
            id = workspace.id,
            productId = workspace.productId,
            productName = product.name,
            name = workspace.name,
            owner = workspace.owner,
            projectCount = workspaceProjects.size,
            openTasks = workspaceTasks.count { task -> task.status != TaskStatus.Done },
            projects = workspaceProjects.map { project -> project.toDto() },
        )
    }
}
