package com.toolmanager.service;

import com.toolmanager.dto.ParameterCategoryDto;
import com.toolmanager.entity.ParameterCategory;
import com.toolmanager.repository.ParameterCategoryRepository;
import com.toolmanager.repository.SystemParameterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ParameterCategoryService {
    private final ParameterCategoryRepository parameterCategoryRepository;
    private final SystemParameterRepository systemParameterRepository;

    /**
     * Get all categories
     */
    public List<ParameterCategoryDto> getAllCategories() {
        return parameterCategoryRepository.findAll()
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get categories by big class
     */
    public List<ParameterCategoryDto> getCategoriesByBigClass(String bigClass) {
        return parameterCategoryRepository.findByBigClass(bigClass)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Add a new category
     */
    @Transactional
    public ParameterCategoryDto addCategory(String bigClass, String smallClass, String description, String updatedBy) {
        if (parameterCategoryRepository.existsByBigClassAndSmallClass(bigClass, smallClass)) {
            throw new RuntimeException("Category already exists");
        }

        ParameterCategory category = new ParameterCategory();
        category.setBigClass(bigClass);
        category.setSmallClass(smallClass);
        category.setDescription(description);
        category.setUpdatedBy(updatedBy);
        category.setCreatedAt(LocalDateTime.now());
        category.setUpdatedAt(LocalDateTime.now());

        ParameterCategory saved = parameterCategoryRepository.save(category);
        return convertToDto(saved);
    }

    /**
     * Delete a category - only if no parameters use it
     */
    @Transactional
    public void deleteCategory(String bigClass, String smallClass) {
        // Check if any parameters use this category
        long count = systemParameterRepository.findAll()
                .stream()
                .filter(p -> bigClass.equals(p.getCategory()) && smallClass.equals(p.getParamType()))
                .count();

        if (count > 0) {
            throw new RuntimeException("Cannot delete category: " + count + " parameters are using it");
        }

        List<ParameterCategory> categories = parameterCategoryRepository.findByBigClassAndSmallClass(bigClass, smallClass);
        parameterCategoryRepository.deleteAll(categories);
    }

    /**
     * Rename a big class
     */
    @Transactional
    public void renameBigClass(String oldName, String newName, String updatedBy) {
        List<ParameterCategory> categories = parameterCategoryRepository.findByBigClass(oldName);
        for (ParameterCategory category : categories) {
            category.setBigClass(newName);
            category.setUpdatedBy(updatedBy);
            category.setUpdatedAt(LocalDateTime.now());
            parameterCategoryRepository.save(category);
        }

        // Update all parameters with old category
        systemParameterRepository.findByCategory(oldName)
                .forEach(param -> {
                    param.setCategory(newName);
                    param.setUpdatedBy(updatedBy);
                    param.setUpdatedAt(LocalDateTime.now());
                    systemParameterRepository.save(param);
                });
    }

    /**
     * Rename a small class
     */
    @Transactional
    public void renameSmallClass(String bigClass, String oldSmallClass, String newSmallClass, String updatedBy) {
        List<ParameterCategory> categories = parameterCategoryRepository.findByBigClassAndSmallClass(bigClass, oldSmallClass);
        for (ParameterCategory category : categories) {
            category.setSmallClass(newSmallClass);
            category.setUpdatedBy(updatedBy);
            category.setUpdatedAt(LocalDateTime.now());
            parameterCategoryRepository.save(category);
        }

        // Update all parameters with old subcategory
        systemParameterRepository.findAll()
                .stream()
                .filter(p -> bigClass.equals(p.getCategory()) && oldSmallClass.equals(p.getParamType()))
                .forEach(param -> {
                    param.setParamType(newSmallClass);
                    param.setUpdatedBy(updatedBy);
                    param.setUpdatedAt(LocalDateTime.now());
                    systemParameterRepository.save(param);
                });
    }

    private ParameterCategoryDto convertToDto(ParameterCategory entity) {
        return new ParameterCategoryDto(
                entity.getId(),
                entity.getBigClass(),
                entity.getSmallClass(),
                entity.getDescription(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getUpdatedBy()
        );
    }
}
