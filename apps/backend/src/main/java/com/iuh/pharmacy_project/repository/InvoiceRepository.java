package com.iuh.pharmacy_project.repository;

import com.iuh.pharmacy_project.entity.Invoice;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface InvoiceRepository extends MongoRepository<Invoice, String> {
    long countByCreatedDateBetween(LocalDateTime start, LocalDateTime end);
}
