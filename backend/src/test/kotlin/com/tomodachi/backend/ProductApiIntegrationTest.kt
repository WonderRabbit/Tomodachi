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
class ProductApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `products response includes frontend summary fields`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/products").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].id").value("product_tomodachi"))
            .andExpect(jsonPath("$.items[0].activeProjects").value(1))
            .andExpect(jsonPath("$.items[0].openTasks").value(3))
            .andExpect(jsonPath("$.items[0].lastActivity").isString)
    }

    @Test
    fun `product detail returns frontend summary fields`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/products/product_tomodachi").bearer(adminToken))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value("product_tomodachi"))
            .andExpect(jsonPath("$.code").value("TMD"))
            .andExpect(jsonPath("$.name").value("Tomodachi"))
            .andExpect(jsonPath("$.activeProjects").value(1))
            .andExpect(jsonPath("$.openTasks").value(3))
            .andExpect(jsonPath("$.lastActivity").isString)
    }

    @Test
    fun `product detail returns not found json for missing product`() {
        val adminToken = login("admin@tomodachi.local", "password")

        mockMvc.perform(get("/api/products/missing-product").bearer(adminToken))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("NOT_FOUND"))
            .andExpect(jsonPath("$.message").value("Resource not found"))
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
