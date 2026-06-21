package com.tomodachi.backend.api

import com.tomodachi.backend.repo.ArtifactRepository
import com.tomodachi.backend.repo.TaskArtifactLinkRepository
import com.tomodachi.backend.service.toDto
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/architecture")
class ArchitectureController(
    private val artifacts: ArtifactRepository,
    private val links: TaskArtifactLinkRepository,
) {
    @GetMapping
    fun artifacts(): PageResponse<ArtifactDto> =
        artifacts.findAll().map { artifact ->
            artifact.toDto(links.findByArtifactId(artifact.id).map { it.taskId })
        }.let { PageResponse(it, it.size) }

    @GetMapping("/adr/{artifactId}")
    fun artifact(@PathVariable artifactId: String): ArtifactDto {
        val artifact = artifacts.findById(artifactId).orElseThrow()
        return artifact.toDto(links.findByArtifactId(artifactId).map { it.taskId })
    }
}
