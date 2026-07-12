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
class WorkspaceApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `workspace detail returns backend product project and task summary`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/workspaces/workspace_core").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value("workspace_core"))
            .andExpect(jsonPath("$.productId").value("product_tomodachi"))
            .andExpect(jsonPath("$.productName").value("Tomodachi"))
            .andExpect(jsonPath("$.projectCount").value(1))
            .andExpect(jsonPath("$.openTasks").value(3))
            .andExpect(jsonPath("$.projects[0].workspaceId").value("workspace_core"))
    }

    @Test
    fun `workspace detail returns not found json for missing workspace`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/workspaces/missing-workspace").bearer(adminToken))
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
