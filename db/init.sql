CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN (
        'ADMIN',
        'PRODUCT_MANAGER',
        'ENGINEER',
        'REVIEWER',
        'VIEWER',
        'AGENT_SERVICE'
    ))
);

CREATE TABLE IF NOT EXISTS product (
    id VARCHAR(255) PRIMARY KEY,
    code VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    CONSTRAINT uk_product_code UNIQUE (code),
    CONSTRAINT ck_product_status CHECK (status IN ('Healthy', 'Watch', 'Blocked'))
);

CREATE TABLE IF NOT EXISTS workspace (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    CONSTRAINT fk_workspace_product FOREIGN KEY (product_id) REFERENCES product (id)
);

CREATE TABLE IF NOT EXISTS project (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    project_key VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_project_key UNIQUE (project_key),
    CONSTRAINT ck_project_status CHECK (status IN ('Healthy', 'Watch', 'Blocked')),
    CONSTRAINT ck_project_progress CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT fk_project_product FOREIGN KEY (product_id) REFERENCES product (id),
    CONSTRAINT fk_project_workspace FOREIGN KEY (workspace_id) REFERENCES workspace (id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY KEY,
    number VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    priority VARCHAR(255) NOT NULL,
    assignee VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tasks_number UNIQUE (number),
    CONSTRAINT ck_tasks_status CHECK (status IN ('Ready', 'InProgress', 'Blocked', 'Review', 'QA', 'Done')),
    CONSTRAINT ck_tasks_priority CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE TABLE IF NOT EXISTS architecture_artifact (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    source_path VARCHAR(255) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    summary VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT ck_architecture_artifact_type CHECK (type IN ('ADR', 'RFC', 'API', 'Diagram')),
    CONSTRAINT ck_architecture_artifact_status CHECK (status IN ('Accepted', 'Proposed', 'Stale'))
);

CREATE TABLE IF NOT EXISTS task_artifact_link (
    id VARCHAR(255) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    CONSTRAINT uk_task_artifact_link_task_artifact UNIQUE (task_id, artifact_id),
    CONSTRAINT fk_task_artifact_link_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_artifact_link_artifact FOREIGN KEY (artifact_id) REFERENCES architecture_artifact (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_run (
    id VARCHAR(255) PRIMARY KEY,
    status VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    unresolved_count INTEGER NOT NULL DEFAULT 0,
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_agent_run_status CHECK (status IN ('Completed', 'Failed', 'ReviewRequired')),
    CONSTRAINT ck_agent_run_evidence_count CHECK (evidence_count >= 0),
    CONSTRAINT ck_agent_run_unresolved_count CHECK (unresolved_count >= 0),
    CONSTRAINT fk_agent_run_task FOREIGN KEY (task_id) REFERENCES tasks (id)
);

CREATE TABLE IF NOT EXISTS agent_run_changed_files (
    agent_run_id VARCHAR(255) NOT NULL,
    changed_files VARCHAR(255) NOT NULL,
    CONSTRAINT pk_agent_run_changed_files PRIMARY KEY (agent_run_id, changed_files),
    CONSTRAINT fk_agent_run_changed_files_run FOREIGN KEY (agent_run_id) REFERENCES agent_run (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_transition (
    id VARCHAR(255) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    from_status VARCHAR(255) NOT NULL,
    to_status VARCHAR(255) NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    reason VARCHAR(255) NOT NULL DEFAULT '',
    idempotency_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_task_transition_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT ck_task_transition_from_status CHECK (from_status IN ('Ready', 'InProgress', 'Blocked', 'Review', 'QA', 'Done')),
    CONSTRAINT ck_task_transition_to_status CHECK (to_status IN ('Ready', 'InProgress', 'Blocked', 'Review', 'QA', 'Done')),
    CONSTRAINT fk_task_transition_task FOREIGN KEY (task_id) REFERENCES tasks (id)
);

CREATE TABLE IF NOT EXISTS audit_event (
    id VARCHAR(255) PRIMARY KEY,
    aggregate_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    detail VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outbox_event (
    id VARCHAR(255) PRIMARY KEY,
    aggregate_id VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_workspace_product_id ON workspace (product_id);
CREATE INDEX IF NOT EXISTS ix_project_product_id ON project (product_id);
CREATE INDEX IF NOT EXISTS ix_project_workspace_id ON project (workspace_id);
CREATE INDEX IF NOT EXISTS ix_tasks_project_id ON tasks (project_id);
CREATE INDEX IF NOT EXISTS ix_task_artifact_link_task_id ON task_artifact_link (task_id);
CREATE INDEX IF NOT EXISTS ix_task_artifact_link_artifact_id ON task_artifact_link (artifact_id);
CREATE INDEX IF NOT EXISTS ix_agent_run_task_id ON agent_run (task_id);
CREATE INDEX IF NOT EXISTS ix_task_transition_task_id ON task_transition (task_id);
CREATE INDEX IF NOT EXISTS ix_audit_event_aggregate_id ON audit_event (aggregate_id);
CREATE INDEX IF NOT EXISTS ix_outbox_event_aggregate_id ON outbox_event (aggregate_id);
