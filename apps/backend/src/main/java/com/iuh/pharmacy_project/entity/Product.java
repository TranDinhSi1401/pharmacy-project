package com.iuh.pharmacy_project.entity;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Document(collection = "products")
@TypeAlias("Product")
public class Product {
    @Id
    String id;

    String name;

    String description;

    String ingredients;

    ProductType type;

    int minStock;

    int maxStock;

    List<String> barcodes;

    List<Unit> units;

    List<Batch> batches;
}
