package com.toolmanager.service;

import com.toolmanager.dto.SystemParameterDto;
import com.toolmanager.entity.SystemParameter;
import com.toolmanager.repository.SystemParameterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
}
