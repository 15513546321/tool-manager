package com.toolmanager.service;

import com.toolmanager.dto.IpMappingDto;
import com.toolmanager.entity.IpMapping;
import com.toolmanager.repository.IpMappingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IpMappingService {
    private final IpMappingRepository ipMappingRepository;

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
    public IpMappingDto createMapping(String ip, String name) {
        // Check if IP already exists
        if (ipMappingRepository.findByIp(ip).isPresent()) {
            throw new IllegalArgumentException("IP " + ip + " already mapped");
        }

        IpMapping mapping = new IpMapping();
        mapping.setIp(ip);
        mapping.setName(name);

        IpMapping saved = ipMappingRepository.save(mapping);
        return convertToDto(saved);
    }

    /**
     * Update an existing IP mapping
     */
    public IpMappingDto updateMapping(String ip, String newName) {
        IpMapping mapping = ipMappingRepository.findByIp(ip)
                .orElseThrow(() -> new IllegalArgumentException("IP not found: " + ip));

        mapping.setName(newName);
        IpMapping saved = ipMappingRepository.save(mapping);
        return convertToDto(saved);
    }

    /**
     * Delete an IP mapping
     */
    public void deleteMapping(String ip) {
        IpMapping mapping = ipMappingRepository.findByIp(ip)
                .orElseThrow(() -> new IllegalArgumentException("IP not found: " + ip));
        ipMappingRepository.delete(mapping);
    }

    private IpMappingDto convertToDto(IpMapping mapping) {
        return new IpMappingDto(mapping.getId(), mapping.getIp(), mapping.getName());
    }
}
