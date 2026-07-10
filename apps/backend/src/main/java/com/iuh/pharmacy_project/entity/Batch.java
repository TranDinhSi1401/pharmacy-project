package com.iuh.pharmacy_project.entity;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Batch {
    String batchId;
    int quantity;
    LocalDate mfgDate;
    LocalDate expDate;
    boolean isCancelled;
}
