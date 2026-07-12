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
class SearchApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `search returns typed task project artifact and agent run results`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/search?q=transition").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].type").value("task"))
            .andExpect(jsonPath("$.items[0].path").value("/tasks/task_seed_review"))

        mockMvc.perform(get("/api/search?q=run&type=agent-run").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].type").value("agent-run"))
            .andExpect(jsonPath("$.items[0].path").value("/agent-runs/run_review_01"))
    }

    @Test
    fun `search validates query and type`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/search?q=   ").bearer(adminToken))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))

        mockMvc.perform(get("/api/search?q=transition&type=unknown").bearer(adminToken))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
    }

    @Test
    fun `viewer search excludes agent run results`() {
        val viewerToken = login("viewer@tomodachi.local", "password")

        mockMvc.perform(get("/api/search?q=run&type=agent-run").bearer(viewerToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.total").value(0))
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
