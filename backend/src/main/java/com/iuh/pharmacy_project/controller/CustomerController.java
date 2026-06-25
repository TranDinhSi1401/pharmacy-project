package com.iuh.pharmacy_project.controller;

import com.iuh.pharmacy_project.dto.ApiResponse;
import com.iuh.pharmacy_project.dto.CustomerDto;
import com.iuh.pharmacy_project.dto.request.CustomerCreationRequest;
import com.iuh.pharmacy_project.service.CustomerService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@AllArgsConstructor
@RestController
@RequestMapping("/customers")
@Validated
public class CustomerController {
    private final CustomerService customerService;

    @GetMapping
    public ApiResponse<List<CustomerDto>> getAllCustomers() {
        ApiResponse<List<CustomerDto>> response = new ApiResponse<>();
        response.setResult(customerService.getAllCustomers());
        response.setMessage("Fetched customers successfully");
        return response;
    }

    @GetMapping("/search")
    public ApiResponse<CustomerDto> getCustomerByPhone(@RequestParam
                @NotBlank(message = "Phone number must not be blank")
                @Pattern(regexp = "^\\d{10}$", message = "Phone number must be 10 digits")
                                                           String phone) {
        ApiResponse<CustomerDto> response = new ApiResponse<>();
        response.setResult(customerService.getCustomerByPhone(phone));
        response.setMessage("Fetched customer successfully");
        return response;
    }

    @PostMapping
    public ApiResponse<CustomerDto> createCustomer(@RequestBody @Valid CustomerCreationRequest request) {
        ApiResponse<CustomerDto> response = new ApiResponse<>();
        response.setCode(201);
        response.setResult(customerService.createCustomer(request));
        response.setMessage("Created customer successfully");
        return response;
    }
}
