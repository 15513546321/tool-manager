package com.toolmanager.controller;

import com.toolmanager.dto.IpMappingDto;
import com.toolmanager.service.IpMappingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ip-mappings")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*"}, allowCredentials = "true")
public class IpMappingController {
    private final IpMappingService ipMappingService;

    /**
     * Get all IP mappings
     * GET /api/ip-mappings
     */
    @GetMapping
    public ResponseEntity<List<IpMappingDto>> getAllMappings() {
        List<IpMappingDto> mappings = ipMappingService.getAllMappings();
        return ResponseEntity.ok(mappings);
    }

    /**
     * Create a new IP mapping
     * POST /api/ip-mappings
     * Body: { "ip": "192.168.1.100", "name": "Admin" }
     */
    @PostMapping
    public ResponseEntity<IpMappingDto> createMapping(@RequestBody Map<String, String> payload) {
        String ip = payload.get("ip");
        String name = payload.get("name");

        if (ip == null || ip.isEmpty() || name == null || name.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        IpMappingDto mapping = ipMappingService.createMapping(ip, name);
        return ResponseEntity.ok(mapping);
    }

    /**
     * Update an IP mapping
     * PUT /api/ip-mappings/{ip}
     * Body: { "name": "New Name" }
     */
    @PutMapping("/{ip}")
    public ResponseEntity<IpMappingDto> updateMapping(
            @PathVariable String ip,
            @RequestBody Map<String, String> payload) {
        String newName = payload.get("name");

        if (newName == null || newName.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        IpMappingDto mapping = ipMappingService.updateMapping(ip, newName);
        return ResponseEntity.ok(mapping);
    }

    /**
     * Delete an IP mapping
     * DELETE /api/ip-mappings/{ip}
     */
    @DeleteMapping("/{ip}")
    public ResponseEntity<Void> deleteMapping(@PathVariable String ip) {
        ipMappingService.deleteMapping(ip);
        return ResponseEntity.noContent().build();
    }

    /**
     * Get name for a specific IP
     * GET /api/ip-mappings/lookup/{ip}
     */
    @GetMapping("/lookup/{ip}")
    public ResponseEntity<Map<String, String>> lookupIp(@PathVariable String ip) {
        String name = ipMappingService.getNameByIp(ip);
        return ResponseEntity.ok(Map.of("ip", ip, "name", name));
    }
}
