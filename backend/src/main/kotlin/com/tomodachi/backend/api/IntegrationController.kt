package com.tomodachi.backend.api

import com.tomodachi.backend.domain.AgentRunStatus
import com.tomodachi.backend.repo.AgentRunRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/integrations")
class IntegrationController(
    private val runs: AgentRunRepository,
) {
    @GetMapping("/opencode/sync-summary")
    fun openCodeSyncSummary(): OpenCodeSyncSummaryDto {
        val agentRuns = runs.findAll()
        val reviewRequiredRuns = agentRuns.count { it.status == AgentRunStatus.ReviewRequired }
        val failedRuns = agentRuns.count { it.status == AgentRunStatus.Failed }
        val unresolvedEvidence = agentRuns.sumOf { it.unresolvedCount }

        return OpenCodeSyncSummaryDto(
            source = "OpenCode",
            status = if (failedRuns > 0) "Attention" else "Synced",
            lastSyncLabel = "local seed",
            totalRuns = agentRuns.size,
            reviewRequiredRuns = reviewRequiredRuns,
            failedRuns = failedRuns,
            unresolvedEvidence = unresolvedEvidence,
            changedFiles = agentRuns.sumOf { it.changedFiles.size },
        )
    }
}
