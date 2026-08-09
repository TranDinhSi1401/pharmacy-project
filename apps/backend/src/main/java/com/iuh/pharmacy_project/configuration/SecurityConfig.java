package com.iuh.pharmacy_project.configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

import javax.crypto.spec.SecretKeySpec;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final String[] PUBLIC_POST_ENDPOINTS = {"/auth/login", "/auth/introspect"};
    private final String[] PUBLIC_GET_ENDPOINTS = {"/products/**"};

    @Value("${jwt.signer.key}")
    private String signerKey;

    /**
     * Filter chain 1 (Order=1 - ưu tiên cao nhất):
     * Cho phép PUBLIC_ENDPOINTS đi thẳng qua mà không cần bất kỳ xác thực nào.
     * Không cấu hình oauth2ResourceServer → không có BearerTokenAuthenticationFilter
     * → tránh lỗi 401 cho login và introspect.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain publicFilterChain(HttpSecurity httpSecurity) throws Exception {
        httpSecurity
                .securityMatcher(PUBLIC_POST_ENDPOINTS)
                .authorizeHttpRequests(request -> request.anyRequest().permitAll())
                .csrf(AbstractHttpConfigurer::disable);

        return httpSecurity.build();
    }

    /**
     * Filter chain 2 (Order mặc định - thấp hơn):
     * Xử lý tất cả các request còn lại với JWT authentication.
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity httpSecurity) throws Exception {
        httpSecurity
                .authorizeHttpRequests(request ->
                        request.requestMatchers(HttpMethod.GET, PUBLIC_GET_ENDPOINTS).permitAll()
                                .anyRequest().authenticated()
                );

        httpSecurity.oauth2ResourceServer(oauth2 ->
                    oauth2.jwt(jwtConfigurer -> jwtConfigurer.decoder(jwtDecoder())
                            .jwtAuthenticationConverter(jwtAuthenticationConverter()))
                );
        httpSecurity.csrf(AbstractHttpConfigurer::disable);

        return httpSecurity.build();
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter jwtAuthenticationConverter = new JwtGrantedAuthoritiesConverter();
        jwtAuthenticationConverter.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(jwtAuthenticationConverter);

        return jwtConverter;
    }

    @Bean
    JwtDecoder jwtDecoder() {
        SecretKeySpec secretKeySpec = new SecretKeySpec(signerKey.getBytes(), "HS512");

        return NimbusJwtDecoder.withSecretKey(secretKeySpec).macAlgorithm(MacAlgorithm.HS512).build();
    }
}
