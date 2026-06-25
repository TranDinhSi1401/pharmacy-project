package com.iuh.pharmacy_project.repository;

import com.iuh.pharmacy_project.entity.Customer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomerRepository extends MongoRepository<Customer, String> {
    public Optional<Customer> findByPhone(String phone);
}
