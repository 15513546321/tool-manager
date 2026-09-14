package com.toolmanager.controller;

import com.toolmanager.dto.ChangeStepCheckDtos.ScanResultDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanRecordDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanRecordPageDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScannerConfigDto;
import com.toolmanager.dto.ChangeStepCheckDtos.UpdateReviewSummaryRequest;
import com.toolmanager.dto.ChangeStepCheckDtos.UpdateScannerConfigRequest;
import com.toolmanager.service.ChangeStepCheckConfigService;
import com.toolmanager.service.ChangeStepCheckRecordService;
import com.toolmanager.service.ChangeStepCheckService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/change-step-check")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
        allowCredentials = "true")
public class ChangeStepCheckController {
    private final ChangeStepCheckService checkService;
    private final ChangeStepCheckConfigService configService;
    private final ChangeStepCheckRecordService recordService;

    @PostMapping(value = "/scan", consumes = "multipart/form-data")
    public ResponseEntity<ScanResultDto> scan(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "MANUAL") String documentType,
            @RequestParam(defaultValue = "MIDDLE_PLATFORM") String systemCode,
            @RequestParam(required = false) String companionManualFileName,
            @RequestParam(required = false) String treasurySaasManualFileName,
            @RequestParam(required = false) String treasuryNtManualFileName,
            @RequestAttribute(value = "username", required = false) String username) {
        String fileName = file == null ? "未知文件" : file.getOriginalFilename();
        long fileSize = file == null ? 0 : file.getSize();
        ScanResultDto result;
        try {
            result = checkService.scan(file, documentType, systemCode, companionManualFileName,
                    treasurySaasManualFileName, treasuryNtManualFileName);
        } catch (RuntimeException ex) {
            recordFailureSafely(fileName, fileSize, ex, username, systemCode, documentType);
            throw ex;
        }
        recordSuccessSafely(fileName, fileSize, result, username);
        return ResponseEntity.ok(result);
    }

    /**
     * 原始文件流上传不经过 Servlet multipart 解析器，可兼容被部署环境固定为 1 MB 的场景。
     */
    @PostMapping(value = "/scan", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<ScanResultDto> scanRaw(
            @RequestParam("fileName") String fileName,
            @RequestParam("fileSize") long fileSize,
            @RequestParam(defaultValue = "MANUAL") String documentType,
            @RequestParam(defaultValue = "MIDDLE_PLATFORM") String systemCode,
            @RequestParam(required = false) String companionManualFileName,
            @RequestParam(required = false) String treasurySaasManualFileName,
            @RequestParam(required = false) String treasuryNtManualFileName,
            HttpServletRequest request,
            @RequestAttribute(value = "username", required = false) String username) throws IOException {
        ScanResultDto result;
        try {
            long contentLength = request.getContentLengthLong();
            if (contentLength >= 0 && contentLength != fileSize) {
                throw new IllegalArgumentException("上传文件大小校验失败，请重新选择文件后再试");
            }
            result = checkService.scan(fileName, fileSize, request.getInputStream(),
                    documentType, systemCode, companionManualFileName,
                    treasurySaasManualFileName, treasuryNtManualFileName);
        } catch (RuntimeException ex) {
            recordFailureSafely(fileName, fileSize, ex, username, systemCode, documentType);
            throw ex;
        }
        recordSuccessSafely(fileName, fileSize, result, username);
        return ResponseEntity.ok(result);
    }

    private void recordSuccessSafely(String fileName, long fileSize, ScanResultDto result, String username) {
        try {
            recordService.recordSuccess(fileName, fileSize, result, username);
        } catch (RuntimeException ex) {
            log.error("变更单校验已完成，但公共检查记录保存失败。fileName={}", fileName, ex);
        }
    }

    private void recordFailureSafely(String fileName, long fileSize, RuntimeException scanError,
                                     String username, String systemCode, String documentType) {
        try {
            recordService.recordFailure(fileName, fileSize, scanError.getMessage(), username, systemCode, documentType);
        } catch (RuntimeException recordError) {
            log.error("变更单校验失败，且失败记录保存失败。fileName={}", fileName, recordError);
        }
    }

    @GetMapping("/records")
    public ResponseEntity<ScanRecordPageDto> getRecords(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(recordService.search(keyword, page, size));
    }

    @PostMapping("/records/{recordId}/review")
    public ResponseEntity<ScanRecordDto> updateReview(
            @PathVariable Long recordId,
            @RequestBody UpdateReviewSummaryRequest request,
            @RequestAttribute(value = "username", required = false) String username) {
        return ResponseEntity.ok(recordService.updateReview(recordId, request, username));
    }

    @GetMapping("/config")
    public ResponseEntity<ScannerConfigDto> getConfig() {
        return ResponseEntity.ok(configService.getPublicConfig());
    }

    @PutMapping("/config")
    public ResponseEntity<ScannerConfigDto> updateConfig(
            @RequestBody UpdateScannerConfigRequest request,
            @RequestAttribute(value = "username", required = false) String username) {
        return ResponseEntity.ok(configService.updateConfig(request, username));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Collections.singletonMap("message", ex.getMessage()));
    }
}
