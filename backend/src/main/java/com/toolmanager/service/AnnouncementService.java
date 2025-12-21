package com.toolmanager.service;

import com.toolmanager.dto.AnnouncementDto;
import com.toolmanager.entity.Announcement;
import com.toolmanager.repository.AnnouncementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnnouncementService {
    private final AnnouncementRepository announcementRepository;

    /**
     * Get the latest published announcement
     */
    public AnnouncementDto getLatestAnnouncement() {
        return announcementRepository.findByStatusOrderByCreatedAtDesc("PUBLISHED")
                .stream()
                .findFirst()
                .map(this::convertToDto)
                .orElse(null);
    }

    /**
     * Get announcement by version
     */
    public AnnouncementDto getAnnouncementByVersion(String version) {
        return announcementRepository.findByVersion(version)
                .map(this::convertToDto)
                .orElse(null);
    }

    /**
     * Get all published announcements
     */
    public List<AnnouncementDto> getAllPublishedAnnouncements() {
        return announcementRepository.findByStatusOrderByCreatedAtDesc("PUBLISHED")
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Create a new announcement
     */
    @Transactional
    public AnnouncementDto createAnnouncement(AnnouncementDto dto) {
        Announcement announcement = new Announcement();
        announcement.setTitle(dto.getTitle());
        announcement.setDescription(dto.getDescription());
        announcement.setContent(dto.getContent());
        announcement.setVersion(dto.getVersion());
        announcement.setStatus(dto.getStatus() != null ? dto.getStatus() : "PUBLISHED");
        announcement.setCreatedBy(dto.getCreatedBy());
        announcement.setUpdatedBy(dto.getUpdatedBy());

        Announcement saved = announcementRepository.save(announcement);
        announcementRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Update an announcement
     */
    @Transactional
    public AnnouncementDto updateAnnouncement(Long id, AnnouncementDto dto) {
        Announcement announcement = announcementRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Announcement not found: " + id));

        announcement.setTitle(dto.getTitle());
        announcement.setDescription(dto.getDescription());
        announcement.setContent(dto.getContent());
        announcement.setStatus(dto.getStatus());
        announcement.setUpdatedBy(dto.getUpdatedBy());

        Announcement updated = announcementRepository.save(announcement);
        announcementRepository.flush();
        return convertToDto(updated);
    }

    /**
     * Delete an announcement
     */
    @Transactional
    public void deleteAnnouncement(Long id) {
        announcementRepository.deleteById(id);
        announcementRepository.flush();
    }

    private AnnouncementDto convertToDto(Announcement announcement) {
        AnnouncementDto dto = new AnnouncementDto(
                announcement.getId(),
                announcement.getTitle(),
                announcement.getDescription(),
                announcement.getContent(),
                announcement.getVersion(),
                announcement.getCreatedAt(),
                announcement.getUpdatedAt(),
                announcement.getCreatedBy(),
                announcement.getUpdatedBy(),
                announcement.getStatus(),
                announcement.getFileName(),
                announcement.getFileSize()
        );
        return dto;
    }
}
