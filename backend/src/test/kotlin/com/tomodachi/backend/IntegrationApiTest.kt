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
class IntegrationApiTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `opencode sync summary returns backend agent run counts`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/integrations/opencode/sync-summary").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.source").value("OpenCode"))
            .andExpect(jsonPath("$.status").value("Synced"))
            .andExpect(jsonPath("$.lastSyncLabel").value("local seed"))
            .andExpect(jsonPath("$.totalRuns").value(1))
            .andExpect(jsonPath("$.reviewRequiredRuns").value(1))
            .andExpect(jsonPath("$.unresolvedEvidence").value(2))
            .andExpect(jsonPath("$.changedFiles").value(1))
    }

    @Test
    fun `opencode sync summary requires authentication`() {
        mockMvc.perform(get("/api/integrations/opencode/sync-summary"))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
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
