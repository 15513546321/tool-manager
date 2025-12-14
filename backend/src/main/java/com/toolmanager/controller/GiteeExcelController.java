package com.toolmanager.controller;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.bind.annotation.*;
import lombok.Data;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.util.*;

@RestController
@RequestMapping("/api/gitee")
@CrossOrigin
public class GiteeExcelController {

    @PostMapping("/export-excel")
    public void exportExcel(@RequestBody ExportRequest request, HttpServletResponse response) throws IOException {
        System.out.println("=== Excel Export Request ===");
        System.out.println("Filename: " + request.getFilename());
        System.out.println("Headers: " + request.getHeaders());
        System.out.println("Data count: " + (request.getData() != null ? request.getData().size() : 0));
        if (request.getData() != null && !request.getData().isEmpty()) {
            System.out.println("First row: " + request.getData().get(0));
        }
        System.out.println("===========================");

        String filename = URLEncoder.encode(request.getFilename(), "UTF-8") + ".xlsx";
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment;filename=" + filename);

        ServletOutputStream outputStream = response.getOutputStream();

        try {
            // Create a new workbook
            XSSFWorkbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("Sheet1");
            
            // Create header row
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < request.getHeaders().size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(request.getHeaders().get(i));
            }
            
            // Create data rows
            if (request.getData() != null) {
                int rowNum = 1;
                for (Map<String, Object> rowData : request.getData()) {
                    Row row = sheet.createRow(rowNum++);
                    for (int colNum = 0; colNum < request.getHeaders().size(); colNum++) {
                        String header = request.getHeaders().get(colNum);
                        Object value = rowData.get(header);
                        Cell cell = row.createCell(colNum);
                        if (value != null) {
                            cell.setCellValue(value.toString());
                        }
                    }
                }
            }
            
            // Add data validation for single-choice fields
            if (request.getValidationRules() != null && !request.getValidationRules().isEmpty()) {
                DataValidationHelper validationHelper = sheet.getDataValidationHelper();
                for (ValidationRule rule : request.getValidationRules()) {
                    int colIndex = rule.getColumnIndex();
                    int lastRow = (request.getData() != null ? request.getData().size() : 0) + 1;
                    
                    if (lastRow > 1) {
                        DataValidationConstraint constraint = validationHelper.createExplicitListConstraint(
                            rule.getOptions().toArray(new String[0])
                        );
                        DataValidation dataValidation = validationHelper.createValidation(
                            constraint,
                            new CellRangeAddressList(1, lastRow - 1, colIndex, colIndex)
                        );
                        sheet.addValidationData(dataValidation);
                        System.out.println("Added validation for column " + colIndex);
                    }
                }
            }
            
            // Write to output stream
            workbook.write(outputStream);
            outputStream.flush();
            workbook.close();
            System.out.println("Excel export completed successfully");
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("Excel export failed: " + e.getMessage());
            throw new IOException("Excel导出失败: " + e.getMessage(), e);
        }
    }

    @Data
    public static class ExportRequest {
        private String filename;
        private List<String> headers;
        private List<Map<String, Object>> data;
        private List<ValidationRule> validationRules;
    }

    @Data
    public static class ValidationRule {
        private int columnIndex;
        private String columnName;
        private List<String> options;
    }
}
