package com.iuh.pharmacy_project.service;

import com.iuh.pharmacy_project.entity.Product;
import com.iuh.pharmacy_project.repository.ProductRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@AllArgsConstructor
@Service
public class ProductService {
    private final ProductRepository productRepository;

    public List<Product> findAll() {
        return productRepository.findAll();
    }

    public Product getProductById(String productId) {

        return productRepository.findById(productId).orElse(null);
    }
}
