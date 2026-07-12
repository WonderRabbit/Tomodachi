package com.tomodachi.backend

import com.tomodachi.backend.repo.AuditEventRepository
import com.tomodachi.backend.repo.OutboxEventRepository
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class McpToolIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val audits: AuditEventRepository,
    @Autowired private val outbox: OutboxEventRepository,
) {
    @Test
    fun `mcp catalog includes agent event and evidence tools`() {
        val agentToken = login("agent@tomodachi.local", "password")

        mockMvc.perform(get("/api/mcp/tools").bearer(agentToken))
            .andExpect(status().isOk)
            .andExpect(content().string(containsString("tomodachi.record_agent_event")))
            .andExpect(content().string(containsString("tomodachi.attach_evidence")))
    }

    @Test
    fun `agent can record protocol event idempotently`() {
        val agentToken = login("agent@tomodachi.local", "password")
        val body = recordAgentEventBody()

        val first = mockMvc.perform(post("/api/mcp/invoke").bearer(agentToken).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.eventId").isString)
            .andExpect(jsonPath("$.outboxEventCount").value(1))
            .andReturn()
            .response
            .contentAsString

        mockMvc.perform(post("/api/mcp/invoke").bearer(agentToken).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.outboxEventCount").value(1))
        assertThat(audits.findByActionAndDetail("AGENT_EVENT_RECORDED", "agent-event-seed-ready-1")).isNotNull
        assertThat(first).contains("agent_event_")
    }

    @Test
    fun `agent can attach structured evidence to run`() {
        val agentToken = login("agent@tomodachi.local", "password")

        mockMvc.perform(post("/api/mcp/invoke").bearer(agentToken).contentType(MediaType.APPLICATION_JSON).content(attachEvidenceBody()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.evidenceIds[0]").isString)
            .andExpect(jsonPath("$.evidenceCount").value(5))
        assertThat(audits.findByActionAndDetail("AGENT_EVIDENCE_ATTACHED", "attach-evidence-seed-ready-1")).isNotNull
        assertThat(outbox.countByAggregateId("task_seed_ready")).isEqualTo(1)
    }

    @Test
    fun `agent evidence tool rejects malformed structured arguments`() {
        val agentToken = login("agent@tomodachi.local", "password")

        mockMvc.perform(
            post("/api/mcp/invoke")
                .bearer(agentToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"name":"tomodachi.attach_evidence","arguments":{"taskId":"task_seed_ready","runId":"run_review_01","idempotencyKey":"bad-evidence","evidence":[]}}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
    }

    private fun recordAgentEventBody(): String = """
        {
          "name":"tomodachi.record_agent_event",
          "arguments":{
            "protocolVersion":"tomodachi-agent.v1",
            "source":{"agentHost":"opencode","sessionId":"session_1","workspace":"workspace_core","repo":"Tomodachi"},
            "correlationId":"corr_task_seed_ready_session_1",
            "idempotencyKey":"agent-event-seed-ready-1",
            "traceparent":"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
            "taskId":"task_seed_ready",
            "event":{"type":"com.tomodachi.agent.run.completed.v1","time":"2026-06-21T13:00:00Z"},
            "agentRun":{"provider":"OpenCode","model":"qwen3-coder","agentName":"task-implementation","status":"ReviewRequired"}
          }
        }
    """.trimIndent()

    private fun attachEvidenceBody(): String = """
        {
          "name":"tomodachi.attach_evidence",
          "arguments":{
            "taskId":"task_seed_ready",
            "runId":"run_review_01",
            "idempotencyKey":"attach-evidence-seed-ready-1",
            "evidence":[{"kind":"test","path":"backend/build/test-results/test/TEST-com.tomodachi.backend.McpToolIntegrationTest.xml","summary":"MockMvc MCP evidence tests passed."}]
          }
        }
    """.trimIndent()

    private fun login(email: String, password: String): String {
        val response = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("""{"email":"$email","password":"$password"}"""))
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
