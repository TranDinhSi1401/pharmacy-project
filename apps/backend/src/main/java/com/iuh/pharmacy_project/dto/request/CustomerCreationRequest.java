package com.iuh.pharmacy_project.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CustomerCreationRequest {
    @NotBlank(message = "Last name must not be blank")
    @Pattern(regexp = "^[\\p{L} ]+$", message = "Last name must not contain special characters")
    String lastName;

    @NotBlank(message = "First name must not be blank")
    @Pattern(regexp = "^[\\p{L} ]+$", message = "Last name must not contain special characters")
    String firstName;

    @NotBlank(message = "Phone number must not be blank")
    @Pattern(regexp = "^\\d{10}$",message = "Phone number must be exactly 10 digits")
    String phone;
}
