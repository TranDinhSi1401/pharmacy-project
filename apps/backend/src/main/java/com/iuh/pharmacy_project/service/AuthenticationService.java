package com.iuh.pharmacy_project.service;

import com.iuh.pharmacy_project.dto.request.AuthenticationRequest;
import com.iuh.pharmacy_project.dto.request.IntrospectRequest;
import com.iuh.pharmacy_project.dto.response.AuthenticationResponse;
import com.iuh.pharmacy_project.dto.response.IntrospectResponse;
import com.iuh.pharmacy_project.entity.Employee;
import com.iuh.pharmacy_project.exception.CustomException;
import com.iuh.pharmacy_project.exception.ErrorCode;
import com.iuh.pharmacy_project.mapper.EmployeeMapper;
import com.iuh.pharmacy_project.repository.EmployeeRepository;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
public class AuthenticationService {
    final EmployeeRepository employeeRepository;

    @NonFinal
    @Value("${jwt.signer.key}")
    String SIGNER_KEY;

    final EmployeeMapper employeeMapper;

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        Employee  employee = employeeRepository.findById(request.getEmployeeId().trim()).orElseThrow(() ->
                new CustomException(ErrorCode.UNAUTHENTICATED)
        );
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);
        boolean authenticated = passwordEncoder.matches(request.getPassword(), employee.getAccount().getPasswordHash());

        if(!authenticated) {
            throw new CustomException(ErrorCode.UNAUTHENTICATED);
        }

        return AuthenticationResponse.builder()
                .token(generateToken(employee))
                .employee(employeeMapper.toDto(employee))
                .build();
    }

    private String generateToken(Employee employee) {
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
                .subject(employee.getId())
                .issuer("duocankhang.com")
                .issueTime(new Date())
                .expirationTime(new Date(
                        Instant.now().plus(1, ChronoUnit.HOURS).toEpochMilli()
                ))
                .claim("scope", employee.getAccount().isAdmin() ? "ADMIN" : "USER")
                .build();

        Payload payload = new Payload(jwtClaimsSet.toJSONObject());

        JWSObject jwsObject = new JWSObject(header, payload);

        try {
            jwsObject.sign(new MACSigner(SIGNER_KEY.getBytes()));
            return jwsObject.serialize();
        } catch (Exception e) {
            log.error("Cannot sign JWS object", e);
            throw new RuntimeException(e.getMessage());
        }
    }

    public IntrospectResponse introspect(IntrospectRequest request) {
        String token = request.getToken();
        try {
            JWSVerifier verifier = new MACVerifier(SIGNER_KEY.getBytes());

            SignedJWT signedJWT = SignedJWT.parse(token);

            Date expirationTime = signedJWT.getJWTClaimsSet().getExpirationTime();

            boolean verified = signedJWT.verify(verifier);

            return IntrospectResponse.builder()
                    .valid(verified && expirationTime.after(new Date()))
                    .build();
        } catch (Exception e) {
            log.error("Cannot create JWS verifier", e);
            throw new RuntimeException(e.getMessage());
        }
    }
}
