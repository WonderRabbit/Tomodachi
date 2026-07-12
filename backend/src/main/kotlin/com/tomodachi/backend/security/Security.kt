package com.tomodachi.backend.security

import com.tomodachi.backend.domain.Role
import com.tomodachi.backend.repo.UserRepository
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.stereotype.Component
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import org.springframework.web.filter.OncePerRequestFilter
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

data class PrincipalUser(val id: String, val email: String, val role: Role)

class TokenAuthentication(private val user: PrincipalUser) : AbstractAuthenticationToken(
    listOf(SimpleGrantedAuthority("ROLE_${user.role.name}")),
) {
    init {
        isAuthenticated = true
    }

    override fun getCredentials(): Any = ""
    override fun getPrincipal(): PrincipalUser = user
}

@Component
class TokenService(
    private val users: UserRepository,
    private val passwordEncoder: PasswordEncoder,
) {
    private val tokens = ConcurrentHashMap<String, PrincipalUser>()

    fun issue(email: String, password: String): String {
        val user = users.findByEmail(email) ?: throw IllegalArgumentException("Bad credentials")
        if (!passwordEncoder.matches(password, user.password)) throw IllegalArgumentException("Bad credentials")
        val token = "test-token-${UUID.randomUUID()}"
        tokens[token] = PrincipalUser(user.id, user.email, user.role)
        return token
    }

    fun resolve(token: String): PrincipalUser? = tokens[token]
}

@Component
class BearerFilter(private val tokens: TokenService) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val header = request.getHeader("Authorization")
        if (header != null && header.startsWith("Bearer ")) {
            tokens.resolve(header.removePrefix("Bearer "))?.let {
                SecurityContextHolder.getContext().authentication = TokenAuthentication(it)
            }
        }
        filterChain.doFilter(request, response)
    }
}

@Configuration
class PasswordConfig {
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()
}

@Configuration
@EnableMethodSecurity
class SecurityConfig(private val bearerFilter: BearerFilter) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain =
        http
            .cors { }
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                it.requestMatchers("/api/auth/login", "/actuator/health", "/v3/api-docs/**", "/swagger-ui/**").permitAll()
                it.anyRequest().authenticated()
            }
            .exceptionHandling {
                it.authenticationEntryPoint { _, response, _ ->
                    response.status = HttpServletResponse.SC_UNAUTHORIZED
                    response.contentType = "application/json"
                    response.writer.write("""{"code":"UNAUTHORIZED","message":"Authentication required"}""")
                }
            }
            .addFilterBefore(bearerFilter, UsernamePasswordAuthenticationFilter::class.java)
            .build()

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        configuration.allowedOrigins = listOf("http://127.0.0.1:5173", "http://localhost:5173")
        configuration.allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        configuration.allowedHeaders = listOf("Authorization", "Content-Type", "Idempotency-Key")
        configuration.exposedHeaders = listOf("Location")
        configuration.allowCredentials = false

        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/api/**", configuration)
        return source
    }
}
