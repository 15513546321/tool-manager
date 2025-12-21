package com.toolmanager.service;

import com.toolmanager.dto.SuggestionDto;
import com.toolmanager.entity.Suggestion;
import com.toolmanager.repository.SuggestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SuggestionService {
    private final SuggestionRepository suggestionRepository;

    /**
     * Get all suggestions
     */
    public List<SuggestionDto> getAllSuggestions() {
        return suggestionRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get suggestions by status
     */
    public List<SuggestionDto> getSuggestionsByStatus(String status) {
        return suggestionRepository.findByStatus(status)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get suggestions by category
     */
    public List<SuggestionDto> getSuggestionsByCategory(String category) {
        return suggestionRepository.findByCategory(category)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Create a new suggestion with IP address
     */
    @Transactional
    public SuggestionDto createSuggestion(SuggestionDto dto, String ipAddress) {
        Suggestion suggestion = new Suggestion();
        suggestion.setTitle(dto.getTitle());
        suggestion.setContent(dto.getContent());
        suggestion.setCategory(dto.getCategory());
        suggestion.setPriority(dto.getPriority());
        suggestion.setStatus(dto.getStatus() != null ? dto.getStatus() : "NEW");
        suggestion.setCreatedBy(dto.getCreatedBy());
        suggestion.setIpAddress(ipAddress);

        Suggestion saved = suggestionRepository.save(suggestion);
        suggestionRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Create a new suggestion without IP (for backward compatibility)
     */
    @Transactional
    public SuggestionDto createSuggestion(SuggestionDto dto) {
        return createSuggestion(dto, "Unknown");
    }

    /**
     * Update a suggestion
     */
    @Transactional
    public SuggestionDto updateSuggestion(Long id, SuggestionDto dto) {
        Suggestion suggestion = suggestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Suggestion not found: " + id));

        suggestion.setTitle(dto.getTitle());
        suggestion.setContent(dto.getContent());
        suggestion.setCategory(dto.getCategory());
        suggestion.setPriority(dto.getPriority());
        suggestion.setStatus(dto.getStatus());

        Suggestion updated = suggestionRepository.save(suggestion);
        suggestionRepository.flush();
        return convertToDto(updated);
    }

    /**
     * Delete a suggestion
     */
    @Transactional
    public void deleteSuggestion(Long id) {
        suggestionRepository.deleteById(id);
        suggestionRepository.flush();
    }

    private SuggestionDto convertToDto(Suggestion suggestion) {
        return new SuggestionDto(
                suggestion.getId(),
                suggestion.getTitle(),
                suggestion.getContent(),
                suggestion.getCategory(),
                suggestion.getPriority(),
                suggestion.getStatus(),
                suggestion.getCreatedAt(),
                suggestion.getUpdatedAt(),
                suggestion.getCreatedBy(),
                suggestion.getIpAddress()
        );
    }
}
