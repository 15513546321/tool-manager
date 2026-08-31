package com.toolmanager.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.toolmanager.dto.ChangeStepCheckDtos.ScannerConfigDto;
import com.toolmanager.dto.ChangeStepCheckDtos.UpdateScannerConfigRequest;
import com.toolmanager.entity.SystemParameter;
import com.toolmanager.repository.SystemParameterRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeStepCheckConfigServiceTest {
    @Mock
    private SystemParameterRepository repository;

    private final Map<String, SystemParameter> storedParameters = new HashMap<>();
    private ChangeStepCheckConfigService service;

    @BeforeEach
    void setUp() {
        when(repository.findByParamKey(anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(storedParameters.get(invocation.getArgument(0))));
        when(repository.save(any(SystemParameter.class))).thenAnswer(invocation -> {
            SystemParameter parameter = invocation.getArgument(0);
            storedParameters.put(parameter.getParamKey(), parameter);
            return parameter;
        });
        service = new ChangeStepCheckConfigService(repository, new ObjectMapper());
    }

    @Test
    void storesOnlyPasswordFingerprintAndReturnsMaskedValue() {
        String password = "srcb-Prod-9876!";
        UpdateScannerConfigRequest request = new UpdateScannerConfigRequest(
                Arrays.asList("password", "key"),
                Arrays.asList("(?i)\\bsrcb\\d{4,}\\b"),
                new ArrayList<>(),
                Arrays.asList(password)
        );

        ScannerConfigDto saved = service.updateConfig(request, "reviewer");

        assertThat(saved.getKnownPasswords()).singleElement().satisfies(item -> {
            assertThat(item.getMaskedValue()).startsWith("s").endsWith("!");
            assertThat(item.getMaskedValue()).doesNotContain(password);
        });
        assertThat(storedParameters.values())
                .extracting(SystemParameter::getParamValue)
                .noneMatch(value -> value.contains(password));
        assertThat(storedParameters.get(ChangeStepCheckConfigService.PASSWORDS_KEY).getParamValue())
                .contains(ChangeStepCheckConfigService.sha256(password));
    }
}
