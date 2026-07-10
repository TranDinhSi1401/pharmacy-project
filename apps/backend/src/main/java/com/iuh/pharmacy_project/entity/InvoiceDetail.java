package com.iuh.pharmacy_project.entity;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class InvoiceDetail {
    String detailId;
    String unitId;
    int quantity;
    double price;
    double discount;
    List<BatchDelivery> batchDeliveries;
}
