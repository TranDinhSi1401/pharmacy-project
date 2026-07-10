package com.iuh.pharmacy_project.controller;

import com.iuh.pharmacy_project.dto.ApiResponse;
import com.iuh.pharmacy_project.entity.Product;
import com.iuh.pharmacy_project.service.ProductService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@AllArgsConstructor
@RestController
@RequestMapping("/products")
@Validated
public class ProductController {
    private final ProductService productService;

    @GetMapping("/{id}")
    public ApiResponse<Product> getProductById(@PathVariable @NotBlank @Pattern(regexp = "^SP-\\d{4}$", message = "productId must be SP-XXXX") String id) {
        ApiResponse<Product> response = new ApiResponse<>();
        response.setResult(productService.getProductById(id));
        response.setMessage("Fetched product successfully");
        return response;
    }

    @GetMapping
    public ApiResponse<List<Product>> getProducts() {
        ApiResponse<List<Product>> response = new ApiResponse<>();
        response.setResult(productService.findAll());
        response.setMessage("Fetched products successfully");
        return response;
    }
}
