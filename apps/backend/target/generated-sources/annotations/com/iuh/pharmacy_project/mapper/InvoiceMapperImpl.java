package com.iuh.pharmacy_project.mapper;

import com.iuh.pharmacy_project.dto.InvoiceDto;
import com.iuh.pharmacy_project.entity.Invoice;
import com.iuh.pharmacy_project.entity.InvoiceDetail;
import java.util.ArrayList;
import java.util.List;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-08-09T10:04:13+0700",
    comments = "version: 1.6.3, compiler: javac, environment: Java 21.0.12 (Oracle Corporation)"
)
@Component
public class InvoiceMapperImpl implements InvoiceMapper {

    @Override
    public InvoiceDto toDto(Invoice invoice) {
        if ( invoice == null ) {
            return null;
        }

        InvoiceDto.InvoiceDtoBuilder invoiceDto = InvoiceDto.builder();

        invoiceDto.id( invoice.getId() );
        invoiceDto.employeeId( invoice.getEmployeeId() );
        invoiceDto.customerId( invoice.getCustomerId() );
        invoiceDto.createdDate( invoice.getCreatedDate() );
        invoiceDto.isBankTransfer( invoice.getIsBankTransfer() );
        invoiceDto.totalAmount( invoice.getTotalAmount() );
        List<InvoiceDetail> list = invoice.getDetails();
        if ( list != null ) {
            invoiceDto.details( new ArrayList<InvoiceDetail>( list ) );
        }

        return invoiceDto.build();
    }
}
