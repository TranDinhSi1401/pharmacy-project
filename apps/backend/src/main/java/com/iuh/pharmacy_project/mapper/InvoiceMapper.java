package com.iuh.pharmacy_project.mapper;

import com.iuh.pharmacy_project.dto.InvoiceDto;
import com.iuh.pharmacy_project.entity.Invoice;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface InvoiceMapper {
    InvoiceDto toDto(Invoice invoice);
}

