package com.iuh.pharmacy_project.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CustomerDto {
    String id;
    String lastName;
    String firstName;
    String phone;
    Long points;
    Boolean isDeleted;
}
