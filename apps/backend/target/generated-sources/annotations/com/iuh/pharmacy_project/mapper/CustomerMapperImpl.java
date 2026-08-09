package com.iuh.pharmacy_project.mapper;

import com.iuh.pharmacy_project.dto.CustomerDto;
import com.iuh.pharmacy_project.entity.Customer;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-08-09T10:04:13+0700",
    comments = "version: 1.6.3, compiler: javac, environment: Java 21.0.12 (Oracle Corporation)"
)
@Component
public class CustomerMapperImpl implements CustomerMapper {

    @Override
    public CustomerDto toDto(Customer customer) {
        if ( customer == null ) {
            return null;
        }

        CustomerDto.CustomerDtoBuilder customerDto = CustomerDto.builder();

        customerDto.id( customer.getId() );
        customerDto.lastName( customer.getLastName() );
        customerDto.firstName( customer.getFirstName() );
        customerDto.phone( customer.getPhone() );
        customerDto.points( customer.getPoints() );
        customerDto.isDeleted( customer.getIsDeleted() );

        return customerDto.build();
    }
}
