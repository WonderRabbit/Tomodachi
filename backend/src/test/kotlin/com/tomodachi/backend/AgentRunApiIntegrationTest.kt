package com.tomodachi.backend

import org.assertj.core.api.Assertions.assertThat
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
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class AgentRunApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `agent runs response includes backend run fields`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/agent-runs").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].id").value("run_review_01"))
            .andExpect(jsonPath("$.items[0].taskId").value("task_seed_ready"))
            .andExpect(jsonPath("$.items[0].changedFiles[0]").value("backend/TaskService.kt"))
            .andExpect(jsonPath("$.items[0].requiresReview").value(true))
    }

    @Test
    fun `agent run detail returns backend run fields`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/agent-runs/run_review_01").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value("run_review_01"))
            .andExpect(jsonPath("$.status").value("ReviewRequired"))
            .andExpect(jsonPath("$.unresolvedCount").value(2))
            .andExpect(jsonPath("$.evidenceCount").value(4))
    }

    @Test
    fun `agent run detail returns not found json for missing run`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/agent-runs/missing-run").bearer(adminToken))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("NOT_FOUND"))
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
