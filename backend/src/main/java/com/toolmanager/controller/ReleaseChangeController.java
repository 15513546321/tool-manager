package com.toolmanager.controller;

import com.toolmanager.dto.ReleaseChangeDtos.ChangeFileDto;
import com.toolmanager.dto.ReleaseChangeDtos.ChangeSetDto;
import com.toolmanager.dto.ReleaseChangeDtos.ConfirmDiffRequest;
import com.toolmanager.dto.ReleaseChangeDtos.ImportTextRequest;
import com.toolmanager.dto.ReleaseChangeDtos.PackageDiffDto;
import com.toolmanager.dto.ReleaseChangeDtos.ReconcileResultDto;
import com.toolmanager.dto.ReleaseChangeDtos.VersionDto;
import com.toolmanager.service.ReleaseChangeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/release-change")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class ReleaseChangeController {
    private final ReleaseChangeService releaseChangeService;

    @GetMapping("/versions")
    public ResponseEntity<List<VersionDto>> getVersions() {
        return ResponseEntity.ok(releaseChangeService.getVersions());
    }

    @PostMapping("/versions")
    public ResponseEntity<VersionDto> saveVersion(@RequestBody VersionDto dto) {
        return ResponseEntity.ok(releaseChangeService.saveVersion(dto));
    }

    @DeleteMapping("/versions/{versionId}")
    public ResponseEntity<Void> deleteVersion(@PathVariable Long versionId) {
        releaseChangeService.deleteVersion(versionId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/versions/{versionId}/change-sets")
    public ResponseEntity<List<ChangeSetDto>> getChangeSets(@PathVariable Long versionId) {
        return ResponseEntity.ok(releaseChangeService.getChangeSets(versionId));
    }

    @PostMapping("/change-sets")
    public ResponseEntity<ChangeSetDto> saveChangeSet(@RequestBody ChangeSetDto dto) {
        return ResponseEntity.ok(releaseChangeService.saveChangeSet(dto));
    }

    @DeleteMapping("/change-sets/{changeSetId}")
    public ResponseEntity<Void> deleteChangeSet(@PathVariable Long changeSetId) {
        releaseChangeService.deleteChangeSet(changeSetId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/versions/{versionId}/diffs")
    public ResponseEntity<List<PackageDiffDto>> getPackageDiffs(@PathVariable Long versionId) {
        return ResponseEntity.ok(releaseChangeService.getPackageDiffs(versionId));
    }

    @PostMapping("/versions/{versionId}/diffs/import")
    public ResponseEntity<List<PackageDiffDto>> importPackageDiffs(@PathVariable Long versionId, @RequestBody ImportTextRequest request) {
        return ResponseEntity.ok(releaseChangeService.importPackageDiffs(versionId, request));
    }

    @PostMapping("/diffs/{diffId}/confirm")
    public ResponseEntity<PackageDiffDto> confirmPackageDiff(@PathVariable Long diffId, @RequestBody ConfirmDiffRequest request) {
        return ResponseEntity.ok(releaseChangeService.confirmPackageDiff(diffId, request));
    }

    @GetMapping("/versions/{versionId}/files/search")
    public ResponseEntity<List<ChangeFileDto>> searchDeclaredFiles(@PathVariable Long versionId, @RequestParam(defaultValue = "") String keyword) {
        return ResponseEntity.ok(releaseChangeService.searchDeclaredFiles(versionId, keyword));
    }

    @GetMapping("/versions/{versionId}/reconcile")
    public ResponseEntity<ReconcileResultDto> reconcile(@PathVariable Long versionId) {
        return ResponseEntity.ok(releaseChangeService.reconcile(versionId));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }
}
