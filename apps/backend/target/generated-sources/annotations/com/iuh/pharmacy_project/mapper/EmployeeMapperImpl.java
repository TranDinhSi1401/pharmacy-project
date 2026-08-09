package com.iuh.pharmacy_project.mapper;

import com.iuh.pharmacy_project.dto.EmployeeDto;
import com.iuh.pharmacy_project.entity.Employee;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-08-09T10:04:13+0700",
    comments = "version: 1.6.3, compiler: javac, environment: Java 21.0.12 (Oracle Corporation)"
)
@Component
public class EmployeeMapperImpl implements EmployeeMapper {

    @Override
    public EmployeeDto toDto(Employee employee) {
        if ( employee == null ) {
            return null;
        }

        EmployeeDto.EmployeeDtoBuilder employeeDto = EmployeeDto.builder();

        employeeDto.id( employee.getId() );
        employeeDto.lastName( employee.getLastName() );
        employeeDto.firstName( employee.getFirstName() );
        employeeDto.phone( employee.getPhone() );
        employeeDto.idCard( employee.getIdCard() );
        employeeDto.gender( employee.isGender() );
        employeeDto.birthDate( employee.getBirthDate() );
        employeeDto.address( employee.getAddress() );
        employeeDto.isRetired( employee.getIsRetired() );

        return employeeDto.build();
    }
}
