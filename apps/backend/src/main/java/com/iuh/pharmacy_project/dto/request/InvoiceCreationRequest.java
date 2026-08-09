package com.iuh.pharmacy_project.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Setter
@Getter
@ToString
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class InvoiceCreationRequest {
    @NotBlank(message = "Employee ID is required")
    @Pattern(regexp = "^NV-\\d{4}$", message = "Employee ID must be in the format NV-XXXX")
    String employeeId;

    @NotBlank(message = "Customer ID is required")
    @Pattern(regexp = "^KH-\\d{5}$", message = "Customer ID must be in the format KH-XXXX")
    String customerId;

    boolean isBankTransfer;

    @Min(value = 0, message = "Total amount must be a positive number")
    double totalAmount;

    @NotEmpty
    @Valid
    List<InvoiceDetailRequest> details;
}
