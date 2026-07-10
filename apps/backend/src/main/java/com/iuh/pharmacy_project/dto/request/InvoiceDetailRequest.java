package com.iuh.pharmacy_project.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class InvoiceDetailRequest {
    @NotBlank(message = "Product ID is required")
    @Pattern(regexp = "^SP-\\d{4}$", message = "Product ID must be in the format SP-XXXX")
    String productId;

    @NotBlank(message = "Unit ID is required")
    @Pattern(regexp = "^DVT-\\d{4}-.+$", message = "Unit ID must start with the format DV-XXXX-")
    String unitId;

    @Min(value = 1, message = "Quantity must be at least 1")
    int quantity;

    @Min(value = 0, message = "Price must be a positive number")
    double price;
}
