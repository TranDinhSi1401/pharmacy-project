package com.iuh.pharmacy_project.service;

import com.iuh.pharmacy_project.dto.EmployeeDto;
import com.iuh.pharmacy_project.entity.Employee;
import com.iuh.pharmacy_project.mapper.EmployeeMapper;
import com.iuh.pharmacy_project.repository.EmployeeRepository;
import lombok.AllArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.util.List;

@AllArgsConstructor
@Service
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
public class EmployeeService {
    final EmployeeRepository employeeRepository;
    final EmployeeMapper employeeMapper;

    public List<EmployeeDto> getAllEmployee() {
        return employeeRepository.findAll().stream().map(employeeMapper::toDto).toList();
    }
}
