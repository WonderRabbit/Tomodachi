package com.tomodachi.backend.domain

enum class Role {
    ADMIN,
    PRODUCT_MANAGER,
    ENGINEER,
    REVIEWER,
    VIEWER,
    AGENT_SERVICE,
}

enum class HealthStatus {
    Healthy,
    Watch,
    Blocked,
}

enum class TaskStatus {
    Ready,
    InProgress,
    Blocked,
    Review,
    QA,
    Done,
}

enum class Priority {
    Low,
    Normal,
    High,
    Urgent,
}

enum class ArtifactType {
    ADR,
    RFC,
    API,
    Diagram,
}

enum class ArtifactStatus {
    Accepted,
    Proposed,
    Stale,
}

enum class AgentRunStatus {
    Completed,
    Failed,
    ReviewRequired,
}
