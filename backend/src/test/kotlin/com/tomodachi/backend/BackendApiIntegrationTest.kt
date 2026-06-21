package com.tomodachi.backend

import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import com.tomodachi.backend.repo.AuditEventRepository
import com.tomodachi.backend.repo.OutboxEventRepository

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class BackendApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val audits: AuditEventRepository,
    @Autowired private val outbox: OutboxEventRepository,
) {
    @Test
    fun `viewer can read tasks but cannot create tasks`() {
        val viewerToken = login("viewer@tomodachi.local", "password")

        mockMvc.perform(get("/api/tasks").bearer(viewerToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].number").value("TMD-101"))

        mockMvc.perform(
            post("/api/tasks")
                .bearer(viewerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"projectId":"project_alpha","title":"Viewer should fail","priority":"Normal"}"""),
        )
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("FORBIDDEN"))
    }

    @Test
    fun `engineer transition writes audit and outbox and invalid transition is rejected`() {
        val engineerToken = login("engineer@tomodachi.local", "password")

        mockMvc.perform(
            post("/api/tasks/task_seed_ready/transition")
                .bearer(engineerToken)
                .header("Idempotency-Key", "qa-transition-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"toStatus":"InProgress","reason":"QA"}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.task.status").value("InProgress"))
            .andExpect(jsonPath("$.outboxEventCount").value(1))
        assertThat(audits.count()).isEqualTo(1)
        assertThat(outbox.countByAggregateId("task_seed_ready")).isEqualTo(1)

        mockMvc.perform(
            post("/api/tasks/task_seed_ready/transition")
                .bearer(engineerToken)
                .header("Idempotency-Key", "qa-transition-2")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"toStatus":"Ready","reason":"illegal rollback"}"""),
        )
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("INVALID_TRANSITION"))
    }

    @Test
    fun `idempotency key reuse on another task is rejected`() {
        val engineerToken = login("engineer@tomodachi.local", "password")

        mockMvc.perform(
            post("/api/tasks/task_seed_ready/transition")
                .bearer(engineerToken)
                .header("Idempotency-Key", "qa-reused-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"toStatus":"InProgress","reason":"first transition"}"""),
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            post("/api/tasks/task_seed_blocked/transition")
                .bearer(engineerToken)
                .header("Idempotency-Key", "qa-reused-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"toStatus":"InProgress","reason":"must not suppress another task"}"""),
        )
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"))
        assertThat(outbox.countByAggregateId("task_seed_blocked")).isEqualTo(0)
    }

    @Test
    fun `agent can read task context and invoke transition tool while viewer cannot`() {
        val agentToken = login("agent@tomodachi.local", "password")
        val viewerToken = login("viewer@tomodachi.local", "password")

        mockMvc.perform(get("/api/opencode/task-context/task_seed_ready").bearer(agentToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.task.id").value("task_seed_ready"))
            .andExpect(jsonPath("$.project.key").value("TMD-A1"))
            .andExpect(content().string(containsString("statusMachine")))
            .andExpect(content().string(containsString("rules")))

        mockMvc.perform(
            post("/api/mcp/invoke")
                .bearer(agentToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"tomodachi.transition_task",
                      "arguments":{
                        "taskId":"task_seed_ready",
                        "toStatus":"InProgress",
                        "reason":"agent mcp transition",
                        "idempotencyKey":"qa-agent-mcp-transition"
                      }
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.task.status").value("InProgress"))
            .andExpect(jsonPath("$.outboxEventCount").value(1))

        mockMvc.perform(
            post("/api/mcp/invoke")
                .bearer(agentToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"name":"tomodachi.get_task_context","arguments":{}}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))

        mockMvc.perform(
            post("/api/mcp/invoke")
                .bearer(viewerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"tomodachi.transition_task",
                      "arguments":{"taskId":"task_seed_ready","toStatus":"InProgress","reason":"viewer should fail"}
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("FORBIDDEN"))
    }

    private fun login(email: String, password: String): String {
        val response = mockMvc.perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"$email","password":"$password"}"""),
        )
            .andExpect(status().isOk)
            .andReturn()
            .response
            .contentAsString

        val marker = """"accessToken":""""
        val start = response.indexOf(marker)
        assertThat(start).isGreaterThanOrEqualTo(0)
        val tokenStart = start + marker.length
        val tokenEnd = response.indexOf('"', tokenStart)
        return response.substring(tokenStart, tokenEnd)
    }

    private fun org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder.bearer(
        token: String,
    ): org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder =
        header("Authorization", "Bearer $token")
}
