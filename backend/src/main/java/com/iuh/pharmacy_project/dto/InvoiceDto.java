package com.iuh.pharmacy_project.dto;

import com.iuh.pharmacy_project.entity.InvoiceDetail;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class InvoiceDto {
    String id;
    String employeeId;
    String customerId;
    LocalDateTime createdDate;
    Boolean isBankTransfer;
    double totalAmount;
    List<InvoiceDetail> details;
}
