package com.tomodachi.backend.service

import com.tomodachi.backend.api.AgentRunDto
import com.tomodachi.backend.api.ArtifactDto
import com.tomodachi.backend.api.ProductDto
import com.tomodachi.backend.api.ProjectDto
import com.tomodachi.backend.api.TaskDto
import com.tomodachi.backend.domain.AgentRun
import com.tomodachi.backend.domain.ArchitectureArtifact
import com.tomodachi.backend.domain.Product
import com.tomodachi.backend.domain.Project
import com.tomodachi.backend.domain.TaskItem

fun Product.toDto(): ProductDto = ProductDto(id, code, name, status)
fun Project.toDto(): ProjectDto = ProjectDto(id, key, name, owner, status, progress)
fun TaskItem.toDto(): TaskDto = TaskDto(id, number, projectId, title, status, priority, assignee)
fun AgentRun.toDto(): AgentRunDto =
    AgentRunDto(id, status, provider, model, agentName, taskId, changedFiles, evidenceCount, unresolvedCount, requiresReview)

fun ArchitectureArtifact.toDto(linkedTaskIds: List<String>): ArtifactDto =
    ArtifactDto(id, type, title, status, sourcePath, linkedTaskIds)
