package com.iuh.pharmacy_project.exception;

import com.iuh.pharmacy_project.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Objects;

@Slf4j
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(CustomException.class)
    public ResponseEntity<ApiResponse<Object>> handlingException(CustomException e) {
        ErrorCode errorCode = e.getErrorCode();
        ApiResponse<Object> apiResponse = new ApiResponse<>();

        apiResponse.setCode(errorCode.getCode());
        apiResponse.setMessage(errorCode.getMessage());

        return ResponseEntity.badRequest().body(apiResponse);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handlingException(MethodArgumentNotValidException e) {
        ApiResponse<Object> apiResponse = new ApiResponse<>();
        apiResponse.setCode(500);
        apiResponse.setMessage(Objects.requireNonNull(e.getBindingResult().getFieldError()).getDefaultMessage());
        return ResponseEntity.badRequest().body(apiResponse);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Object>> handlingException(MethodArgumentTypeMismatchException e) {
        ApiResponse<Object> apiResponse = new ApiResponse<>();
        apiResponse.setCode(500);
        apiResponse.setMessage("Type mismatch");
        return ResponseEntity.badRequest().body(apiResponse);
    }

    /**
     * Handle RuntimeException (ví dụ: lỗi JWT signing khi key quá ngắn).
     * Trước đây không có handler này → Spring trả về body rỗng hoặc HTML
     * → Frontend không đọc được message → hiện "Có lỗi xảy ra, vui lòng thử lại".
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Object>> handlingRuntimeException(RuntimeException e) {
        log.error("Unhandled RuntimeException: {}", e.getMessage(), e);
        ApiResponse<Object> apiResponse = new ApiResponse<>();
        apiResponse.setCode(500);
        apiResponse.setMessage("Lỗi hệ thống: " + e.getMessage());
        return ResponseEntity.internalServerError().body(apiResponse);
    }

    /**
     * Fallback handler cho mọi exception chưa được xử lý.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handlingGenericException(Exception e) {
        log.error("Unhandled Exception: {}", e.getMessage(), e);
        ApiResponse<Object> apiResponse = new ApiResponse<>();
        apiResponse.setCode(500);
        apiResponse.setMessage("Có lỗi xảy ra, vui lòng thử lại.");
        return ResponseEntity.internalServerError().body(apiResponse);
    }
}
