package com.iuh.pharmacy_project.entity;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Document(collection = "invoices")
@TypeAlias("Invoice")
public class Invoice {
    @Id
    String id;
    String employeeId;
    String customerId;
    LocalDateTime createdDate;
    Boolean isBankTransfer;
    double totalAmount;
    List<InvoiceDetail> details;
}
