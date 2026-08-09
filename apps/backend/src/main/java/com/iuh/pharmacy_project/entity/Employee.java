package com.iuh.pharmacy_project.entity;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Document(collection = "employees")
public class Employee {
    @Id
    String id;

    String lastName;

    String firstName;

    String phone;

    String idCard;

    boolean gender;

    LocalDate birthDate;

    String address;

    Boolean isRetired;

    Account account;
}
