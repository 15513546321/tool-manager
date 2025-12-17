package com.toolmanager.controller;

import com.toolmanager.dto.AnnouncementDto;
import com.toolmanager.service.AnnouncementService;
import com.toolmanager.service.IpMappingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcement")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class AnnouncementController {

    private final AnnouncementService announcementService;
    private final IpMappingService ipMappingService;
    private final ClientIpController clientIpController;

    /**
     * Create a new announcement
     * POST /api/announcement
     */
    @PostMapping
    public ResponseEntity<AnnouncementDto> createAnnouncement(@RequestBody AnnouncementDto dto) {
        AnnouncementDto created = announcementService.createAnnouncement(dto);
        return ResponseEntity.ok(created);
    }

    /**
     * Update an announcement
     * PUT /api/announcement/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<AnnouncementDto> updateAnnouncement(@PathVariable Long id, @RequestBody AnnouncementDto dto) {
        AnnouncementDto updated = announcementService.updateAnnouncement(id, dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete an announcement
     * DELETE /api/announcement/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable Long id) {
        announcementService.deleteAnnouncement(id);
        return ResponseEntity.ok().build();
    }

    /**
     * Get the latest published announcement
     * GET /api/announcement/latest
     */
    @GetMapping("/latest")
    public ResponseEntity<AnnouncementDto> getLatestAnnouncement() {
        AnnouncementDto announcement = announcementService.getLatestAnnouncement();
        if (announcement == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(announcement);
    }

    /**
     * Get all published announcements
     * GET /api/announcement/list/all
     */
    @GetMapping("/list/all")
    public ResponseEntity<List<AnnouncementDto>> getAllAnnouncements() {
        List<AnnouncementDto> announcements = announcementService.getAllPublishedAnnouncements();
        return ResponseEntity.ok(announcements);
    }

    /**
     * Check if the client IP has seen the current announcement version.
     * GET /api/announcement/status/check
     */
    @GetMapping("/status/check")
    public ResponseEntity<Map<String, Object>> getAnnouncementStatus(HttpServletRequest request) {
        String clientIp = request.getRemoteAddr();
        AnnouncementDto latestAnnouncement = announcementService.getLatestAnnouncement();
        
        if (latestAnnouncement == null) {
            Map<String, Object> response = new HashMap<>();
            response.put("clientIp", clientIp);
            response.put("needsDisplay", false);
            return ResponseEntity.ok(response);
        }

        String lastSeenVersion = ipMappingService.getLastAnnouncementVersionSeen(clientIp);

        Map<String, Object> response = new HashMap<>();
        response.put("clientIp", clientIp);
        response.put("currentAnnouncementVersion", latestAnnouncement.getVersion());
        response.put("lastSeenAnnouncementVersion", lastSeenVersion);
        response.put("needsDisplay", !latestAnnouncement.getVersion().equals(lastSeenVersion));
        response.put("announcement", latestAnnouncement);
        return ResponseEntity.ok(response);
    }

    /**
     * Record that the client IP has seen the current announcement version.
     * POST /api/announcement/record-view
     */
    @PostMapping("/record-view")
    public ResponseEntity<Map<String, String>> recordAnnouncementView(HttpServletRequest request) {
        String clientIp = request.getRemoteAddr();
        AnnouncementDto latestAnnouncement = announcementService.getLatestAnnouncement();
        
        if (latestAnnouncement != null) {
            ipMappingService.recordAnnouncementView(clientIp, latestAnnouncement.getVersion());
        }

        Map<String, String> response = new HashMap<>();
        response.put("message", "Announcement view recorded for IP: " + clientIp);
        response.put("recordedVersion", latestAnnouncement != null ? latestAnnouncement.getVersion() : "NONE");
        return ResponseEntity.ok(response);
    }

    /**
     * Get announcement by version (GENERIC PATH - MUST BE LAST)
     * GET /api/announcement/{version}
     */
    @GetMapping("/{version}")
    public ResponseEntity<AnnouncementDto> getAnnouncementByVersion(@PathVariable String version) {
        AnnouncementDto announcement = announcementService.getAnnouncementByVersion(version);
        if (announcement == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(announcement);
    }
}
