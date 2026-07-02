package com.tomodachi.backend

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.core.env.PropertySource
import org.springframework.core.io.ClassPathResource

class RuntimeProfileConfigTest {
    private val propertySources: List<PropertySource<*>> =
        YamlPropertySourceLoader().load("application", ClassPathResource("application.yml"))

    @Test
    fun `default profile keeps local h2 fallback and non-prod ddl update`() {
        val default = propertySourceWithoutProfile()

        assertThat(default.getProperty("spring.datasource.url"))
            .isEqualTo(
                "\${TOMODACHI_DATABASE_URL:jdbc:h2:mem:tomodachi;MODE=PostgreSQL;" +
                    "DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}",
            )
        assertThat(default.getProperty("spring.datasource.username"))
            .isEqualTo("\${TOMODACHI_DATABASE_USER:sa}")
        assertThat(default.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("update")
    }

    @Test
    fun `dev profile uses postgresql and schema validation`() {
        val dev = propertySourceForProfile("dev")

        assertThat(dev.getProperty("spring.datasource.driver-class-name"))
            .isEqualTo("org.postgresql.Driver")
        assertThat(dev.getProperty("spring.datasource.url"))
            .isEqualTo("\${TOMODACHI_DATABASE_URL:jdbc:postgresql://localhost:5432/tomodachi_dev}")
        assertThat(dev.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate")
        assertThat(dev.getProperty("spring.flyway.enabled")).isEqualTo(false)
    }

    @Test
    fun `prod profile uses required postgresql environment and schema validation`() {
        val prod = propertySourceForProfile("prod")

        assertThat(prod.getProperty("spring.datasource.driver-class-name"))
            .isEqualTo("org.postgresql.Driver")
        assertThat(prod.getProperty("spring.datasource.url")).isEqualTo("\${TOMODACHI_DATABASE_URL}")
        assertThat(prod.getProperty("spring.datasource.username")).isEqualTo("\${TOMODACHI_DATABASE_USER}")
        assertThat(prod.getProperty("spring.datasource.password")).isEqualTo("\${TOMODACHI_DATABASE_PASSWORD}")
        assertThat(prod.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate")
        assertThat(prod.getProperty("spring.flyway.enabled")).isEqualTo(false)
    }

    private fun propertySourceWithoutProfile(): PropertySource<*> =
        propertySources.first {
            it.getProperty("spring.config.activate.on-profile") == null
        }

    private fun propertySourceForProfile(profile: String): PropertySource<*> =
        propertySources.first {
            it.getProperty("spring.config.activate.on-profile") == profile
        }
}
