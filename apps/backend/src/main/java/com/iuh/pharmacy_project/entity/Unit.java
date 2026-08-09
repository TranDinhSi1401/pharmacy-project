package com.iuh.pharmacy_project.entity;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Unit {
    String unitId;
    String name;
    int conversionFactor;
    double price;
    boolean isBase;
}
