package com.toolmanager.service;

import com.toolmanager.dto.DocumentCategoryDto;
import com.toolmanager.entity.DocumentCategory;
import com.toolmanager.repository.DocumentCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.TypeFactory;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentCategoryService {
    private final DocumentCategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;

    /**
     * Get all categories with their sub-categories
     */
    public List<DocumentCategoryDto> getAllCategories() {
        return categoryRepository.findAll()
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get a specific category by name
     */
    public DocumentCategoryDto getCategoryByName(String categoryName) {
        return categoryRepository.findByCategoryName(categoryName)
                .map(this::convertToDto)
                .orElse(null);
    }

    /**
     * Create or update category with sub-categories
     */
    @Transactional
    public DocumentCategoryDto createOrUpdateCategory(DocumentCategoryDto dto, String userName) {
        DocumentCategory entity = categoryRepository.findByCategoryName(dto.getCategoryName())
                .orElse(new DocumentCategory());

        entity.setCategoryName(dto.getCategoryName());
        entity.setSubCategories(convertListToJson(dto.getSubCategories()));
        
        if (entity.getId() == null) {
            entity.setCreatedAt(LocalDateTime.now());
            entity.setCreatedBy(userName);
        }
        
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setUpdatedBy(userName);

        DocumentCategory saved = categoryRepository.save(entity);
        categoryRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Delete a category
     */
    @Transactional
    public void deleteCategory(String categoryName) {
        categoryRepository.findByCategoryName(categoryName).ifPresent(cat -> {
            categoryRepository.delete(cat);
            categoryRepository.flush();
        });
    }

    /**
     * Rename a category (update key and all associated documents)
     */
    @Transactional
    public DocumentCategoryDto renameCategory(String oldName, String newName, String userName) {
        DocumentCategory entity = categoryRepository.findByCategoryName(oldName)
                .orElseThrow(() -> new RuntimeException("Category not found: " + oldName));

        // Check if new name already exists
        if (categoryRepository.findByCategoryName(newName).isPresent()) {
            throw new RuntimeException("Category already exists: " + newName);
        }

        entity.setCategoryName(newName);
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setUpdatedBy(userName);

        DocumentCategory saved = categoryRepository.save(entity);
        categoryRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Add a sub-category to an existing category
     */
    @Transactional
    public DocumentCategoryDto addSubCategory(String categoryName, String subCategoryName, String userName) {
        DocumentCategory entity = categoryRepository.findByCategoryName(categoryName)
                .orElseThrow(() -> new RuntimeException("Category not found: " + categoryName));

        List<String> subCategories = convertJsonToList(entity.getSubCategories());
        if (!subCategories.contains(subCategoryName)) {
            subCategories.add(subCategoryName);
            entity.setSubCategories(convertListToJson(subCategories));
            entity.setUpdatedAt(LocalDateTime.now());
            entity.setUpdatedBy(userName);
        }

        DocumentCategory saved = categoryRepository.save(entity);
        categoryRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Delete a sub-category
     */
    @Transactional
    public DocumentCategoryDto deleteSubCategory(String categoryName, String subCategoryName, String userName) {
        DocumentCategory entity = categoryRepository.findByCategoryName(categoryName)
                .orElseThrow(() -> new RuntimeException("Category not found: " + categoryName));

        List<String> subCategories = convertJsonToList(entity.getSubCategories());
        subCategories.remove(subCategoryName);
        entity.setSubCategories(convertListToJson(subCategories));
        entity.setUpdatedAt(LocalDateTime.now());
        entity.setUpdatedBy(userName);

        DocumentCategory saved = categoryRepository.save(entity);
        categoryRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Rename a sub-category
     */
    @Transactional
    public DocumentCategoryDto renameSubCategory(String categoryName, String oldSubName, String newSubName, String userName) {
        DocumentCategory entity = categoryRepository.findByCategoryName(categoryName)
                .orElseThrow(() -> new RuntimeException("Category not found: " + categoryName));

        List<String> subCategories = convertJsonToList(entity.getSubCategories());
        int index = subCategories.indexOf(oldSubName);
        if (index >= 0) {
            subCategories.set(index, newSubName);
            entity.setSubCategories(convertListToJson(subCategories));
            entity.setUpdatedAt(LocalDateTime.now());
            entity.setUpdatedBy(userName);
        }

        DocumentCategory saved = categoryRepository.save(entity);
        categoryRepository.flush();
        return convertToDto(saved);
    }

    private DocumentCategoryDto convertToDto(DocumentCategory entity) {
        DocumentCategoryDto dto = new DocumentCategoryDto();
        dto.setId(entity.getId());
        dto.setCategoryName(entity.getCategoryName());
        dto.setSubCategories(convertJsonToList(entity.getSubCategories()));
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        dto.setCreatedBy(entity.getCreatedBy());
        dto.setUpdatedBy(entity.getUpdatedBy());
        return dto;
    }

    private String convertListToJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<String> convertJsonToList(String json) {
        try {
            if (json == null || json.isEmpty()) {
                return List.of();
            }
            return objectMapper.readValue(json, TypeFactory.defaultInstance()
                    .constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            return List.of();
        }
    }
}
