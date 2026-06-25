package com.iuh.pharmacy_project.entity;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Account {
    String passwordHash;
    boolean isAdmin;
    boolean isLocked;
    boolean isBatchManager;
    String email;
    LocalDate createdAt;
}
