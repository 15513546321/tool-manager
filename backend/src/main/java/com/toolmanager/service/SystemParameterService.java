package com.toolmanager.service;

import com.toolmanager.dto.SystemParameterDto;
import com.toolmanager.entity.SystemParameter;
import com.toolmanager.repository.SystemParameterRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SystemParameterService {
    private final SystemParameterRepository systemParameterRepository;

    /**
     * Get parameter by key
     */
    public SystemParameterDto getParameterByKey(String paramKey) {
        return systemParameterRepository.findByParamKey(paramKey)
                .map(this::convertToDto)
                .orElse(null);
    }

    /**
     * Get all parameters by category
     */
    public List<SystemParameterDto> getParametersByCategory(String category) {
        return systemParameterRepository.findByCategory(category)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get all parameters
     */
    public List<SystemParameterDto> getAllParameters() {
        return systemParameterRepository.findAll()
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Create or update a parameter
     */
    @Transactional
    public SystemParameterDto saveParameter(SystemParameterDto dto) {
        SystemParameter param = systemParameterRepository.findByParamKey(dto.getParamKey())
                .orElse(new SystemParameter());

        param.setParamKey(dto.getParamKey());
        param.setParamValue(dto.getParamValue());
        param.setParamType(dto.getParamType());
        param.setDescription(dto.getDescription());
        param.setCategory(dto.getCategory());
        param.setUpdatedBy(dto.getUpdatedBy());

        SystemParameter saved = systemParameterRepository.save(param);
        systemParameterRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Delete a parameter
     */
    @Transactional
    public void deleteParameter(String paramKey) {
        SystemParameter param = systemParameterRepository.findByParamKey(paramKey)
                .orElseThrow(() -> new IllegalArgumentException("Parameter not found: " + paramKey));
        systemParameterRepository.delete(param);
        systemParameterRepository.flush();
    }

    private SystemParameterDto convertToDto(SystemParameter param) {
        return new SystemParameterDto(
                param.getId(),
                param.getParamKey(),
                param.getParamValue(),
                param.getParamType(),
                param.getDescription(),
                param.getCategory(),
                param.getCreatedAt(),
                param.getUpdatedAt(),
                param.getUpdatedBy()
        );
    }

    /**
     * Batch save parameters
     */
    @Transactional
    public List<SystemParameterDto> batchSaveParameters(List<SystemParameterDto> dtos) {
        return dtos.stream()
                .map(this::saveParameter)
                .collect(Collectors.toList());
    }

    /**
     * Export parameters to Excel
     */
    public byte[] exportParametersToExcel() {
        List<SystemParameterDto> parameters = getAllParameters();
        
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("System Parameters");
            
            // Create header row (删除描述和更新人字段)
            Row headerRow = sheet.createRow(0);
            String[] headers = {"参数键", "参数值", "参数类型", "分类"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
            }
            
            // Create data rows
            int rowNum = 1;
            for (SystemParameterDto param : parameters) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(param.getParamKey());
                row.createCell(1).setCellValue(param.getParamValue());
                row.createCell(2).setCellValue(param.getParamType() != null ? param.getParamType() : "STRING");
                row.createCell(3).setCellValue(param.getCategory() != null ? param.getCategory() : "");
            }
            
            // Auto-size columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }
            
            // Write to byte array
            try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
                workbook.write(outputStream);
                return outputStream.toByteArray();
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to export parameters to Excel", e);
        }
    }

    /**
     * Import parameters from Excel (增量导入)
     */
    @Transactional
    public List<SystemParameterDto> importParametersFromExcel(byte[] excelData) {
        try (Workbook workbook = new XSSFWorkbook(new java.io.ByteArrayInputStream(excelData))) {
            Sheet sheet = workbook.getSheetAt(0);
            List<SystemParameterDto> importedParams = new java.util.ArrayList<>();
            
            System.out.println("开始导入Excel数据，总行数: " + (sheet.getLastRowNum() + 1));
            
            // Skip header row (row 0)
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                
                SystemParameterDto dto = new SystemParameterDto();
                dto.setParamKey(getCellStringValue(row.getCell(0)));
                dto.setParamValue(getCellStringValue(row.getCell(1)));
                dto.setParamType(getCellStringValue(row.getCell(2)));
                dto.setCategory(getCellStringValue(row.getCell(3)));
                
                // 设置默认值，因为Excel中不再包含描述和更新人字段
                dto.setDescription("");
                dto.setUpdatedBy("admin");
                
                if (dto.getParamKey() != null && !dto.getParamKey().trim().isEmpty()) {
                    // 检查参数键是否已存在
                    SystemParameterDto existingParam = getParameterByKey(dto.getParamKey());
                    
                    if (existingParam != null) {
                        System.out.println("更新已存在参数: " + dto.getParamKey());
                        // 增量导入：只更新参数值、类型和分类，保留原有描述和更新人信息
                        dto.setDescription(existingParam.getDescription());
                        dto.setUpdatedBy(existingParam.getUpdatedBy());
                        SystemParameterDto updated = saveParameter(dto);
                        importedParams.add(updated);
                        System.out.println("参数更新成功: " + updated.getParamKey());
                    } else {
                        System.out.println("新增参数: " + dto.getParamKey());
                        // 新增参数
                        SystemParameterDto saved = saveParameter(dto);
                        importedParams.add(saved);
                        System.out.println("参数新增成功: " + saved.getParamKey());
                    }
                }
            }
            
            System.out.println("导入完成，成功导入 " + importedParams.size() + " 个参数");
            return importedParams;
        } catch (IOException e) {
            throw new RuntimeException("Failed to import parameters from Excel", e);
        }
    }
    
    private String getCellStringValue(Cell cell) {
        if (cell == null) return null;
        
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                return String.valueOf(cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                return cell.getCellFormula();
            default:
                return "";
        }
    }
}