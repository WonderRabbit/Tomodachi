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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class TaskApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `tasks response includes backend summary fields`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/tasks").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].id").value("task_seed_ready"))
            .andExpect(jsonPath("$.items[0].number").value("TMD-101"))
            .andExpect(jsonPath("$.items[0].projectId").value("project_alpha"))
            .andExpect(jsonPath("$.items[0].status").value("Ready"))
    }

    @Test
    fun `task detail returns backend summary fields`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/tasks/task_seed_review").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value("task_seed_review"))
            .andExpect(jsonPath("$.number").value("TMD-102"))
            .andExpect(jsonPath("$.title").value("Define transition rollback surface"))
            .andExpect(jsonPath("$.status").value("Review"))
    }

    @Test
    fun `task context returns project artifacts runs and rules`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/opencode/task-context/task_seed_review").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.task.id").value("task_seed_review"))
            .andExpect(jsonPath("$.project.id").value("project_alpha"))
            .andExpect(content().string(containsString("statusMachine")))
            .andExpect(content().string(containsString("rules")))
    }

    @Test
    fun `task and task context return not found json for missing task`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/tasks/missing-task").bearer(adminToken))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("NOT_FOUND"))

        mockMvc.perform(get("/api/opencode/task-context/missing-task").bearer(adminToken))
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
