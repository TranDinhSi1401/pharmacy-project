package com.iuh.pharmacy_project.controller;

import com.iuh.pharmacy_project.dto.ApiResponse;
import com.iuh.pharmacy_project.dto.EmployeeDto;
import com.iuh.pharmacy_project.entity.Employee;
import com.iuh.pharmacy_project.service.EmployeeService;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
@AllArgsConstructor
@RestController
@RequestMapping("/employees")
public class EmployeeController {
    private final EmployeeService employeeService;

    @GetMapping
    public ApiResponse<List<EmployeeDto>> getAllEmployee() {
        return ApiResponse.<List<EmployeeDto>>builder()
                .result(employeeService.getAllEmployee())
                .message("Fetched all employees successfully")
                .build();
    }
}
