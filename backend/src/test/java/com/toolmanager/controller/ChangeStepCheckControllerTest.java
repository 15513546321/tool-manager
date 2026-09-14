package com.toolmanager.controller;

import com.toolmanager.dto.ChangeStepCheckDtos.ScanResultDto;
import com.toolmanager.service.ChangeStepBusinessValidationService;
import com.toolmanager.service.ChangeStepCheckConfigService;
import com.toolmanager.service.ChangeStepCheckRecordService;
import com.toolmanager.service.ChangeStepCheckService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeStepCheckControllerTest {
    @Mock
    private ChangeStepCheckService checkService;
    @Mock
    private ChangeStepCheckConfigService configService;
    @Mock
    private ChangeStepCheckRecordService recordService;

    private ChangeStepCheckController controller;
    private MockMultipartFile file;

    @BeforeEach
    void setUp() {
        controller = new ChangeStepCheckController(checkService, configService, recordService);
        file = new MockMultipartFile("file", "变更单.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new byte[]{1});
    }

    @Test
    void returnsValidationResultWhenPublicRecordPersistenceFails() {
        ScanResultDto scanResult = new ScanResultDto();
        scanResult.setValidationEngineVersion(ChangeStepCheckService.VALIDATION_ENGINE_VERSION);
        when(checkService.scan(file, ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, null, null, null)).thenReturn(scanResult);
        when(recordService.recordSuccess(anyString(), anyLong(), any(ScanResultDto.class), isNull()))
                .thenThrow(new RuntimeException("database unavailable"));

        ResponseEntity<ScanResultDto> response = controller.scan(file,
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, null, null, null, null);

        assertThat(response.getStatusCodeValue()).isEqualTo(200);
        assertThat(response.getBody()).isSameAs(scanResult);
    }

    @Test
    void preservesOriginalValidationErrorWhenFailureRecordPersistenceAlsoFails() {
        IllegalArgumentException validationError = new IllegalArgumentException("文档解析失败");
        when(checkService.scan(file, ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, null, null, null)).thenThrow(validationError);
        when(recordService.recordFailure(anyString(), anyLong(), anyString(), isNull(),
                anyString(), anyString())).thenThrow(new RuntimeException("database unavailable"));

        assertThatThrownBy(() -> controller.scan(file,
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, null, null, null, null))
                .isSameAs(validationError);
    }
}
