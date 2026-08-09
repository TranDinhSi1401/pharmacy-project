package com.iuh.pharmacy_project.service;

import com.iuh.pharmacy_project.dto.InvoiceDto;
import com.iuh.pharmacy_project.dto.request.InvoiceCreationRequest;
import com.iuh.pharmacy_project.dto.request.InvoiceDetailRequest;
import com.iuh.pharmacy_project.entity.*;
import com.iuh.pharmacy_project.exception.CustomException;
import com.iuh.pharmacy_project.exception.ErrorCode;
import com.iuh.pharmacy_project.mapper.InvoiceMapper;
import com.iuh.pharmacy_project.repository.CustomerRepository;
import com.iuh.pharmacy_project.repository.InvoiceRepository;
import com.mongodb.client.result.UpdateResult;
import lombok.AllArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@AllArgsConstructor
@Service
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
public class InvoiceService {
    final InvoiceRepository invoiceRepository;
    final CustomerRepository customerRepository;
    final MongoTemplate mongoTemplate;
    final InvoiceMapper invoiceMapper;

    public List<InvoiceDto> getInvoices(LocalDate startDate, LocalDate endDate,
                                        String employeeId, String phone) {
        Query query = new Query();

        if (startDate != null && endDate != null) {
            query.addCriteria(Criteria.where("createdDate")
                    .gte(startDate.atStartOfDay())
                    .lte(endDate.atTime(23, 59, 59)));
        }

        if (employeeId != null && !employeeId.isBlank()) {
            query.addCriteria(Criteria.where("employeeId").is(employeeId));
        }

        if (phone != null && !phone.isBlank()) {
            // Tìm customerId từ phone
            Customer customer = customerRepository.findByPhone(phone)
                    .orElseThrow(() -> new CustomException(ErrorCode.CUSTOMER_NOT_FOUND));
            query.addCriteria(Criteria.where("customerId").is(customer.getId()));
        }

        return mongoTemplate.find(query, Invoice.class).stream()
                .map(invoiceMapper::toDto)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional // Chỉ áp dụng nếu mongo xài replica set
    public InvoiceDto createInvoice(InvoiceCreationRequest request) {
        double total = request.getDetails().stream()
                .mapToDouble(r -> r.getQuantity() * r.getPrice())
                .sum();

        if (Math.abs(total - request.getTotalAmount()) > 0.01) {
            throw new CustomException(ErrorCode.TOTAL_AMOUNT_MISMATCH);
        }

        List<InvoiceDetail> details = new ArrayList<>();

        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("ddMMyy"));
        int todayDetailCount = countDetailsToday();
        // Xử lý từng detail request
        for (int i = 0; i < request.getDetails().size(); i++) {
            InvoiceDetailRequest req = request.getDetails().get(i);
            // Tìm sản phẩm
            Product product = mongoTemplate.findById(req.getProductId(), Product.class);
            if (product == null) throw new CustomException(ErrorCode.PRODUCT_NOT_FOUND);

            // Tìm đơn vị tương ứng
            Unit unit = product.getUnits().stream()
                    .filter(u -> u.getUnitId().equals(req.getUnitId()))
                    .findFirst()
                    .orElseThrow(() -> new CustomException(ErrorCode.UNIT_NOT_FOUND));

            // Tính số lượng BASE cần trừ
            int baseQtyNeeded = req.getQuantity() * unit.getConversionFactor();

            // FIFO — sắp xếp batch theo expDate tăng dần (cận hạn xuất trước)
            List<Batch> sortedBatches = product.getBatches().stream()
                    .filter(b -> !b.isCancelled() && b.getQuantity() > 0 && b.getExpDate().isAfter(LocalDate.now()))
                    .sorted(Comparator.comparing(Batch::getExpDate))
                    .collect(Collectors.toList());

            // Trừ kho theo FIFO, ghi lại batchDeliveries
            List<BatchDelivery> batchDeliveries = deductStock(sortedBatches, baseQtyNeeded);

            // Cập nhật lại batches trong product object (chuẩn bị update DB)
            // (sortedBatches đã bị mutate bởi deductStock, merge lại vào product.getBatches())
            updateProductBatches(product, sortedBatches);

            // Lưu product đã cập nhật kho vào DB
            mongoTemplate.save(product);

            // Build detail
            details.add(InvoiceDetail.builder()
                    .detailId(generateDetailId(datePart, todayDetailCount, i + 1))
                    .unitId(req.getUnitId())
                    .quantity(req.getQuantity())
                    .price(req.getPrice())
                    .discount(0)
                    .batchDeliveries(batchDeliveries)
                    .build());
        }

        // Xử lý điểm khách hàng ─────────────────────────────
        // 1000đ được 1 điểm, làm tròn thành số nguyên
        int pointsEarned = (int) Math.floor(request.getTotalAmount() / 1000);

        if (!request.getCustomerId().equals("KH-00000")) {
            // Cập nhật điểm customer (dùng $inc để atomic);
            Query query = Query.query(Criteria.where("_id").is(request.getCustomerId()));
            Update update = new Update().inc("points", pointsEarned);
            UpdateResult result = mongoTemplate.updateFirst(query, update, Customer.class);
            if (result.getMatchedCount() == 0) {
                throw new CustomException(ErrorCode.CUSTOMER_NOT_FOUND);
            }
        }

        // Sinh invoiceId ──────────────────────────────────────
        String invoiceId = generateInvoiceId();

        // Lưu Invoice ─────────────────────────────────────────
        Invoice invoice = Invoice.builder()
                .id(invoiceId)
                .employeeId(request.getEmployeeId())
                .customerId(request.getCustomerId())
                .createdDate(LocalDateTime.now())
                .isBankTransfer(request.isBankTransfer())
                .totalAmount(request.getTotalAmount())
                .details(details)
                .build();

        return invoiceMapper.toDto(invoiceRepository.save(invoice));
    }

    // ── Helper: thuật toán FIFO ─────────────────────────────────────────
    private List<BatchDelivery> deductStock(List<Batch> sortedBatches, int baseQtyNeeded) {
        List<BatchDelivery> deliveries = new ArrayList<>();
        int remaining = baseQtyNeeded;

        for (Batch batch : sortedBatches) {
            if (remaining <= 0) break;

            int take = Math.min(batch.getQuantity(), remaining);
            batch.setQuantity(batch.getQuantity() - take);
            remaining -= take;

            deliveries.add(BatchDelivery.builder()
                    .batchId(batch.getBatchId())
                    .quantity(take)
                    .build());
        }

        if (remaining > 0) {
            throw new CustomException(ErrorCode.NOT_ENOUGH_QUANTITY);
        }

        return deliveries;
    }

    // ── Helper: sync batches đã FIFO vào product ───────────────────────
    private void updateProductBatches(Product product, List<Batch> updatedBatches) {
        // Tạo map từ batchId -> quantity mới
        Map<String, Integer> updatedQtyMap = updatedBatches.stream()
                .collect(Collectors.toMap(Batch::getBatchId, Batch::getQuantity));

        // Cập nhật lại quantity trong product.batches gốc
        product.getBatches().forEach(b -> {
            if (updatedQtyMap.containsKey(b.getBatchId())) {
                b.setQuantity(updatedQtyMap.get(b.getBatchId()));
            }
        });
    }

    // ── Helper: sinh invoiceId HD-DDMMYY-XXXX ──────────────────────────
    private String generateInvoiceId() {
        LocalDateTime now = LocalDateTime.now();
        String datePart = now.format(DateTimeFormatter.ofPattern("ddMMyy"));

        LocalDateTime startOfDay = now.toLocalDate().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        long count = invoiceRepository.countByCreatedDateBetween(startOfDay, endOfDay);

        return String.format("HD-%s-%04d", datePart, count + 1);
    }

    private String generateDetailId(String datePart, int todayDetailCount, int indexInCurrentInvoice) {
        int sequence = todayDetailCount + indexInCurrentInvoice;
        return String.format("CTHD-%s-%04d", datePart, sequence);
    }

    private int countDetailsToday() {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(
                        Criteria.where("createdDate").gte(startOfDay).lt(endOfDay)
                ),
                Aggregation.unwind("details"),
                Aggregation.count().as("total")
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(
                aggregation, "invoices", Document.class
        );

        Document result = results.getUniqueMappedResult();
        return result != null ? result.getInteger("total") : 0;
    }
}
