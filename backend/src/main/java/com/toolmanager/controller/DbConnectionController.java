package com.toolmanager.controller;

import com.toolmanager.dto.DbConnectionDto;
import com.toolmanager.service.DbConnectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/db-connection")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class DbConnectionController {

    private final DbConnectionService dbConnectionService;

    /**
     * Get all database connections
     * GET /api/db-connection/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<DbConnectionDto>> getAllConnections() {
        return ResponseEntity.ok(dbConnectionService.getAll());
    }

    /**
     * Get connections by type
     * GET /api/db-connection/type/{type}
     */
    @GetMapping("/type/{type}")
    public ResponseEntity<List<DbConnectionDto>> getByType(@PathVariable String type) {
        return ResponseEntity.ok(dbConnectionService.getByType(type));
    }

    /**
     * Get connection by ID
     * GET /api/db-connection/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<DbConnectionDto> getById(@PathVariable Long id) {
        DbConnectionDto connection = dbConnectionService.getById(id);
        if (connection == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(connection);
    }

    /**
     * Create or update a database connection
     * POST /api/db-connection
     * PUT /api/db-connection/{id}
     */
    @PostMapping
    public ResponseEntity<DbConnectionDto> createConnection(@RequestBody DbConnectionDto dto) {
        DbConnectionDto saved = dbConnectionService.save(dto);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DbConnectionDto> updateConnection(@PathVariable Long id, @RequestBody DbConnectionDto dto) {
        dto.setId(id);
        DbConnectionDto updated = dbConnectionService.save(dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete a database connection
     * DELETE /api/db-connection/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConnection(@PathVariable Long id) {
        dbConnectionService.delete(id);
        return ResponseEntity.ok().build();
    }
}
