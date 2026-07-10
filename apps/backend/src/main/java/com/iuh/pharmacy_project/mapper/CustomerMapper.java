package com.iuh.pharmacy_project.mapper;

import com.iuh.pharmacy_project.dto.CustomerDto;
import com.iuh.pharmacy_project.entity.Customer;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CustomerMapper {
    CustomerDto toDto(Customer customer);
}
