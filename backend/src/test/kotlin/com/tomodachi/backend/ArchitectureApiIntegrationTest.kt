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
class ArchitectureApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `architecture response includes backend artifact fields`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/architecture").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].id").value("adr_001"))
            .andExpect(jsonPath("$.items[0].owner").value("Architecture"))
            .andExpect(jsonPath("$.items[0].summary").isString)
            .andExpect(jsonPath("$.items[0].linkedTaskIds[0]").value("task_seed_ready"))
    }

    @Test
    fun `architecture detail returns backend artifact fields`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/architecture/adr/adr_001").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value("adr_001"))
            .andExpect(jsonPath("$.title").value("Backend owns OpenCode normalized metadata"))
            .andExpect(jsonPath("$.owner").value("Architecture"))
            .andExpect(jsonPath("$.summary").value("Backend normalizes agent metadata before UI display."))
    }

    @Test
    fun `architecture detail returns not found json for missing artifact`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/architecture/adr/missing-artifact").bearer(adminToken))
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
