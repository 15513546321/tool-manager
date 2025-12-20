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
        if (request.getExcelStyle() != null) {
            System.out.println("Excel Style - rowHeight: " + request.getExcelStyle().getRowHeight() + 
                             ", columnWidth: " + request.getExcelStyle().getColumnWidth() + 
                             ", headerRowHeight: " + request.getExcelStyle().getHeaderRowHeight());
        }
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
            
            // 获取样式配置，如果没有则使用默认值
            ExcelStyle excelStyle = request.getExcelStyle();
            double rowHeight = excelStyle != null && excelStyle.getRowHeight() != null ? excelStyle.getRowHeight() : 18;
            double headerRowHeight = excelStyle != null && excelStyle.getHeaderRowHeight() != null ? excelStyle.getHeaderRowHeight() : 22;
            int columnWidthChars = excelStyle != null && excelStyle.getColumnWidth() != null ? excelStyle.getColumnWidth() : 20;
            
            System.out.println("=== Excel Style Config ===");
            System.out.println("Raw rowHeight: " + rowHeight + " pt");
            System.out.println("Raw headerRowHeight: " + headerRowHeight + " pt");
            System.out.println("Raw columnWidth: " + columnWidthChars + " chars");
            
            // 行高最小值为 0.75 点（Excel 最小值），最大值为 400 点
            rowHeight = Math.max(0.75, Math.min(rowHeight, 400));
            headerRowHeight = Math.max(0.75, Math.min(headerRowHeight, 400));
            
            System.out.println("Adjusted rowHeight: " + rowHeight + " pt");
            System.out.println("Adjusted headerRowHeight: " + headerRowHeight + " pt");
            System.out.println("==========================");
            
            // Create header row style
            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setWrapText(true);
            
            // Create data cell style with wrapping enabled
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setWrapText(true);
            dataStyle.setVerticalAlignment(VerticalAlignment.TOP);
            
            // Create header row
            Row headerRow = sheet.createRow(0);
            // 设置表头行高 - 使用 setHeightInPoints (单位为点)
            headerRow.setHeightInPoints((float) headerRowHeight);
            for (int i = 0; i < request.getHeaders().size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(request.getHeaders().get(i));
                cell.setCellStyle(headerStyle);
            }
            
            // 设置列宽 - 将字符数转换为Excel列宽单位（1字符 = 256 twips）
            int excelColumnWidth = columnWidthChars * 256;
            for (int i = 0; i < request.getHeaders().size(); i++) {
                sheet.setColumnWidth(i, excelColumnWidth);
            }
            
            // Create data rows
            if (request.getData() != null) {
                int rowNum = 1;
                for (Map<String, Object> rowData : request.getData()) {
                    Row row = sheet.createRow(rowNum++);
                    // 设置数据行高 - 严格按照用户设置，不自适应调整
                    row.setHeightInPoints((float) rowHeight);
                    for (int colNum = 0; colNum < request.getHeaders().size(); colNum++) {
                        String header = request.getHeaders().get(colNum);
                        Object value = rowData.get(header);
                        Cell cell = row.createCell(colNum);
                        
                        if (value != null) {
                            String cellValue = value.toString();
                            cell.setCellValue(cellValue);
                        }
                        cell.setCellStyle(dataStyle);
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
        private ExcelStyle excelStyle;  // 新增：Excel样式配置
    }

    @Data
    public static class ExcelStyle {
        private Integer rowHeight;              // 数据行高（单位：点）
        private Integer columnWidth;            // 列宽（单位：字符数）
        private Integer headerRowHeight;        // 表头行高（单位：点）
    }

    @Data
    public static class ValidationRule {
        private int columnIndex;
        private String columnName;
        private List<String> options;
    }
}
