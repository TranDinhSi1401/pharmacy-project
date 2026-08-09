package com.iuh.pharmacy_project.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EmployeeDto {
    String id;
    String lastName;
    String firstName;
    String phone;
    String idCard;
    boolean gender;
    LocalDate birthDate;
    String address;
    Boolean isRetired;
}
