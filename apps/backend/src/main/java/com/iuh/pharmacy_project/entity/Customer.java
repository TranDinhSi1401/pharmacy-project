package com.iuh.pharmacy_project.entity;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Document(collection = "customers")
@TypeAlias("Customer")
public class Customer {
    @Id
    String id;

    String lastName;

    String firstName;

    String phone;

    Long points;

    Boolean isDeleted;
}
