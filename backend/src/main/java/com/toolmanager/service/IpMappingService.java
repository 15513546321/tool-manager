package com.toolmanager.service;

import com.toolmanager.dto.IpMappingDto;
import com.toolmanager.entity.IpMapping;
import com.toolmanager.repository.IpMappingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IpMappingService {
    private final IpMappingRepository ipMappingRepository;

    /**
     * Get or create an IP mapping.
     * If mapping exists, return it. Otherwise, create a new one with "Unknown Device" as name.
     */
    @Transactional
    public IpMapping getOrCreateIpMapping(String ip) {
        return ipMappingRepository.findByIp(ip)
                .orElseGet(() -> {
                    IpMapping newMapping = new IpMapping();
                    newMapping.setIp(ip);
                    newMapping.setName("Unknown Device"); // Default name
                    newMapping.setLastAnnouncementVersionSeen(null); // Default to null
                    IpMapping saved = ipMappingRepository.save(newMapping);
                    ipMappingRepository.flush();
                    return saved;
                });
    }

    /**
     * Get the last announcement version seen by a given IP.
     * Returns null if not seen or IP not mapped.
     */
    public String getLastAnnouncementVersionSeen(String ip) {
        return ipMappingRepository.findByIp(ip)
                .map(IpMapping::getLastAnnouncementVersionSeen)
                .orElse(null);
    }

    /**
     * Record that a given IP has seen a specific announcement version.
     * If the IP mapping doesn't exist, it will be created.
     */
    @Transactional
    public void recordAnnouncementView(String ip, String announcementVersion) {
        IpMapping mapping = getOrCreateIpMapping(ip);
        mapping.setLastAnnouncementVersionSeen(announcementVersion);
        ipMappingRepository.save(mapping);
        ipMappingRepository.flush();
    }

    /**
     * Get name/description for a given IP
     */
    public String getNameByIp(String ip) {
        return ipMappingRepository.findByIp(ip)
                .map(IpMapping::getName)
                .orElse("Unknown Device");
    }

    /**
     * Get all IP mappings
     */
    public List<IpMappingDto> getAllMappings() {
        return ipMappingRepository.findAll()
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Create a new IP mapping
     */
    @Transactional
    public IpMappingDto createMapping(String ip, String name) {
        // Check if IP already exists
        if (ipMappingRepository.findByIp(ip).isPresent()) {
            throw new IllegalArgumentException("IP " + ip + " already mapped");
        }

        IpMapping mapping = new IpMapping();
        mapping.setIp(ip);
        mapping.setName(name);

        IpMapping saved = ipMappingRepository.save(mapping);
        ipMappingRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Update an existing IP mapping
     */
    @Transactional
    public IpMappingDto updateMapping(String ip, String newName) {
        IpMapping mapping = ipMappingRepository.findByIp(ip)
                .orElseThrow(() -> new IllegalArgumentException("IP not found: " + ip));

        mapping.setName(newName);
        IpMapping saved = ipMappingRepository.save(mapping);
        ipMappingRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Delete an IP mapping
     */
    @Transactional
    public void deleteMapping(String ip) {
        IpMapping mapping = ipMappingRepository.findByIp(ip)
                .orElseThrow(() -> new IllegalArgumentException("IP not found: " + ip));
        ipMappingRepository.delete(mapping);
        ipMappingRepository.flush();
    }

    private IpMappingDto convertToDto(IpMapping mapping) {
        return new IpMappingDto(mapping.getId(), mapping.getIp(), mapping.getName(), mapping.getLastAnnouncementVersionSeen());
    }
}
