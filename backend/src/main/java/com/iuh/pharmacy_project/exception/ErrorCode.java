package com.iuh.pharmacy_project.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@AllArgsConstructor
@Getter
public enum ErrorCode {
    // Authentication
    EMPLOYEE_NOT_FOUND(404, "employee not found"),
    UNAUTHENTICATED(400, "unauthenticated"),
    // Customer
    CUSTOMER_NOT_FOUND(404, "customer not found"),
    // Product
    PRODUCT_NOT_FOUND(404, "product not found"),
    UNIT_NOT_FOUND(404, "unit not found"),
    NOT_ENOUGH_QUANTITY(400, "not enough quantity"),
    // Invoice
    TOTAL_AMOUNT_MISMATCH(400, "total amount mismatch"),;

    private final int code;
    private final String message;
}
