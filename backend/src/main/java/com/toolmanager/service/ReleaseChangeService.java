package com.toolmanager.service;

import com.toolmanager.dto.ReleaseChangeDtos.ChangeFileDto;
import com.toolmanager.dto.ReleaseChangeDtos.ChangeSetDto;
import com.toolmanager.dto.ReleaseChangeDtos.ConfirmDiffRequest;
import com.toolmanager.dto.ReleaseChangeDtos.ImportTextRequest;
import com.toolmanager.dto.ReleaseChangeDtos.PackageDiffDto;
import com.toolmanager.dto.ReleaseChangeDtos.ReconcileResultDto;
import com.toolmanager.dto.ReleaseChangeDtos.ReconcileSummaryDto;
import com.toolmanager.dto.ReleaseChangeDtos.VersionDto;
import com.toolmanager.entity.ReleaseChangeFile;
import com.toolmanager.entity.ReleaseChangeSet;
import com.toolmanager.entity.ReleasePackageDiff;
import com.toolmanager.entity.ReleaseVersion;
import com.toolmanager.repository.ReleaseChangeFileRepository;
import com.toolmanager.repository.ReleaseChangeSetRepository;
import com.toolmanager.repository.ReleasePackageDiffRepository;
import com.toolmanager.repository.ReleaseVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReleaseChangeService {
    private final ReleaseVersionRepository versionRepository;
    private final ReleaseChangeSetRepository changeSetRepository;
    private final ReleaseChangeFileRepository changeFileRepository;
    private final ReleasePackageDiffRepository packageDiffRepository;

    public List<VersionDto> getVersions() {
        return versionRepository.findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(this::toVersionDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public VersionDto saveVersion(VersionDto dto) {
        ReleaseVersion version = dto.getId() == null
                ? new ReleaseVersion()
                : versionRepository.findById(dto.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Release version not found: " + dto.getId()));

        if (dto.getVersionName() == null || dto.getVersionName().trim().isEmpty()) {
            throw new IllegalArgumentException("Version name is required");
        }

        version.setVersionName(dto.getVersionName().trim());
        version.setDescription(dto.getDescription());
        version.setStatus(dto.getStatus() == null ? "OPEN" : dto.getStatus());
        version.setCreatedBy(dto.getCreatedBy());
        return toVersionDto(versionRepository.save(version));
    }

    @Transactional
    public void deleteVersion(Long versionId) {
        changeFileRepository.deleteByVersionId(versionId);
        changeSetRepository.deleteByVersionId(versionId);
        packageDiffRepository.deleteByVersionId(versionId);
        versionRepository.deleteById(versionId);
    }

    public List<ChangeSetDto> getChangeSets(Long versionId) {
        return changeSetRepository.findByVersionIdOrderByUpdatedAtDesc(versionId)
                .stream()
                .map(this::toChangeSetDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ChangeSetDto saveChangeSet(ChangeSetDto dto) {
        ensureVersionExists(dto.getVersionId());
        ReleaseChangeSet changeSet = dto.getId() == null
                ? new ReleaseChangeSet()
                : changeSetRepository.findById(dto.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Change set not found: " + dto.getId()));

        changeSet.setVersionId(dto.getVersionId());
        changeSet.setRequirementCode(required(dto.getRequirementCode(), "Requirement code"));
        changeSet.setRequirementName(dto.getRequirementName());
        changeSet.setDeveloper(required(dto.getDeveloper(), "Developer"));
        changeSet.setReviewer(dto.getReviewer());
        changeSet.setReviewStatus(dto.getReviewStatus() == null ? "PENDING" : dto.getReviewStatus());
        changeSet.setReviewRemark(dto.getReviewRemark());

        List<String> parsedFiles = parseFiles(dto.getFiles());
        List<String> duplicates = findDuplicateFiles(
                dto.getVersionId(),
                changeSet.getRequirementCode(),
                changeSet.getDeveloper(),
                parsedFiles,
                changeSet.getId()
        );
        if (!duplicates.isEmpty()) {
            throw new IllegalArgumentException("文件已录入: " + String.join(", ", duplicates));
        }

        ReleaseChangeSet saved = changeSetRepository.save(changeSet);
        changeFileRepository.deleteByChangeSetId(saved.getId());
        parsedFiles.forEach(path -> saveChangeFile(saved, path));
        changeSetRepository.flush();
        changeFileRepository.flush();
        return toChangeSetDto(saved);
    }

    @Transactional
    public void deleteChangeSet(Long changeSetId) {
        changeFileRepository.deleteByChangeSetId(changeSetId);
        changeSetRepository.deleteById(changeSetId);
    }

    public List<PackageDiffDto> getPackageDiffs(Long versionId) {
        List<ChangeFileDto> declaredFiles = declaredFiles(versionId);
        return packageDiffRepository.findByVersionIdOrderByFilePathAsc(versionId)
                .stream()
                .map(diff -> toPackageDiffDto(diff, findOwners(declaredFiles, diff.getFileName())))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<PackageDiffDto> importPackageDiffs(Long versionId, ImportTextRequest request) {
        ensureVersionExists(versionId);
        if (Boolean.TRUE.equals(request.getReplaceExisting())) {
            packageDiffRepository.deleteByVersionId(versionId);
        }

        String serviceTag = normalizeServiceTag(request.getServiceTag());
        Set<String> existingKeys = packageDiffRepository.findByVersionIdOrderByFilePathAsc(versionId)
                .stream()
                .map(diff -> serviceDiffKey(diff.getServiceTag(), diff.getFilePath()))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        parseDiffLines(request.getRawText()).forEach(item -> {
            String key = serviceDiffKey(serviceTag, item.filePath);
            if (!existingKeys.contains(key)) {
                ReleasePackageDiff diff = new ReleasePackageDiff();
                diff.setVersionId(versionId);
                diff.setFilePath(item.filePath);
                diff.setFileName(normalizedFileName(item.filePath));
                diff.setServiceTag(serviceTag);
                diff.setDiffType(item.diffType);
                diff.setConfirmStatus("PENDING");
                packageDiffRepository.save(diff);
                existingKeys.add(key);
            }
        });
        packageDiffRepository.flush();
        return getPackageDiffs(versionId);
    }

    @Transactional
    public PackageDiffDto confirmPackageDiff(Long diffId, ConfirmDiffRequest request) {
        ReleasePackageDiff diff = packageDiffRepository.findById(diffId)
                .orElseThrow(() -> new IllegalArgumentException("Package diff not found: " + diffId));
        String confirmStatus = request.getConfirmStatus() == null ? "CONFIRMED" : request.getConfirmStatus();
        diff.setConfirmStatus(confirmStatus);
        diff.setConfirmRemark(request.getConfirmRemark());
        if ("PENDING".equals(confirmStatus)) {
            diff.setConfirmedBy(null);
            diff.setConfirmedAt(null);
        } else {
            diff.setConfirmedBy(request.getConfirmedBy());
            diff.setConfirmedAt(LocalDateTime.now());
        }
        ReleasePackageDiff saved = packageDiffRepository.save(diff);
        return toPackageDiffDto(saved, findOwners(declaredFiles(saved.getVersionId()), saved.getFileName()));
    }

    public List<ChangeFileDto> searchDeclaredFiles(Long versionId, String keyword) {
        String query = keyword == null ? "" : keyword.trim();
        if (query.isEmpty()) {
            return new ArrayList<>();
        }
        return declaredFiles(versionId)
                .stream()
                .filter(file -> fileMatchesSearch(file.getFilePath(), query))
                .collect(Collectors.toList());
    }

    public ReconcileResultDto reconcile(Long versionId) {
        List<ChangeFileDto> declaredFiles = declaredFiles(versionId);
        List<ReleasePackageDiff> diffs = packageDiffRepository.findByVersionIdOrderByFilePathAsc(versionId);

        List<PackageDiffDto> matched = new ArrayList<>();
        List<PackageDiffDto> undeclared = new ArrayList<>();
        for (ReleasePackageDiff diff : diffs) {
            List<ChangeFileDto> owners = findOwners(declaredFiles, diff.getFileName());
            PackageDiffDto dto = toPackageDiffDto(diff, owners);
            if (owners.isEmpty()) {
                undeclared.add(dto);
            } else {
                matched.add(dto);
            }
        }

        List<ChangeFileDto> declaredNotInPackage = declaredFiles
                .stream()
                .filter(file -> diffs.stream().noneMatch(diff -> fileMatches(file, diff.getFileName())))
                .collect(Collectors.toList());

        ReconcileSummaryDto summary = new ReconcileSummaryDto(
                declaredFiles.size(),
                diffs.size(),
                matched.size(),
                undeclared.size(),
                declaredNotInPackage.size(),
                packageDiffRepository.countByVersionIdAndConfirmStatus(versionId, "PENDING").intValue()
        );
        return new ReconcileResultDto(summary, matched, undeclared, declaredNotInPackage);
    }

    private VersionDto toVersionDto(ReleaseVersion version) {
        return new VersionDto(
                version.getId(),
                version.getVersionName(),
                version.getDescription(),
                version.getStatus(),
                version.getCreatedBy(),
                version.getCreatedAt(),
                version.getUpdatedAt(),
                changeSetRepository.countByVersionId(version.getId()),
                changeFileRepository.countByVersionId(version.getId()),
                packageDiffRepository.countByVersionId(version.getId())
        );
    }

    private ChangeSetDto toChangeSetDto(ReleaseChangeSet changeSet) {
        List<ReleaseChangeFile> changeFiles = changeFileRepository.findByChangeSetId(changeSet.getId());
        List<String> files = changeFiles
                .stream()
                .map(ReleaseChangeFile::getFilePath)
                .collect(Collectors.toList());
        List<ChangeFileDto> fileDetails = changeFiles
                .stream()
                .map(this::toChangeFileDto)
                .collect(Collectors.toList());
        return new ChangeSetDto(
                changeSet.getId(),
                changeSet.getVersionId(),
                changeSet.getRequirementCode(),
                changeSet.getRequirementName(),
                changeSet.getDeveloper(),
                changeSet.getReviewer(),
                changeSet.getReviewStatus(),
                changeSet.getReviewRemark(),
                changeSet.getCreatedAt(),
                changeSet.getUpdatedAt(),
                files,
                fileDetails,
                files.size()
        );
    }

    private ChangeFileDto toChangeFileDto(ReleaseChangeFile file) {
        ReleaseChangeSet changeSet = changeSetRepository.findById(file.getChangeSetId()).orElse(null);
        return new ChangeFileDto(
                file.getId(),
                file.getVersionId(),
                file.getChangeSetId(),
                file.getFilePath(),
                file.getFileName(),
                changeSet == null ? "" : changeSet.getRequirementCode(),
                changeSet == null ? "" : changeSet.getRequirementName(),
                changeSet == null ? "" : changeSet.getDeveloper(),
                changeSet == null ? "" : changeSet.getReviewStatus(),
                changeSet == null ? "" : changeSet.getReviewRemark()
        );
    }

    private PackageDiffDto toPackageDiffDto(ReleasePackageDiff diff, List<ChangeFileDto> owners) {
        return new PackageDiffDto(
                diff.getId(),
                diff.getVersionId(),
                diff.getFilePath(),
                diff.getFileName(),
                diff.getServiceTag(),
                diff.getDiffType(),
                diff.getConfirmStatus(),
                diff.getConfirmRemark(),
                diff.getConfirmedBy(),
                diff.getConfirmedAt(),
                diff.getCreatedAt(),
                diff.getUpdatedAt(),
                owners
        );
    }

    private void saveChangeFile(ReleaseChangeSet changeSet, String filePath) {
        ReleaseChangeFile file = new ReleaseChangeFile();
        file.setVersionId(changeSet.getVersionId());
        file.setChangeSetId(changeSet.getId());
        file.setFilePath(filePath);
        file.setFileName(normalizedFileName(filePath));
        changeFileRepository.save(file);
    }

    private List<ChangeFileDto> declaredFiles(Long versionId) {
        return changeFileRepository.findByVersionId(versionId)
                .stream()
                .map(this::toChangeFileDto)
                .collect(Collectors.toList());
    }

    private List<ChangeFileDto> findOwners(List<ChangeFileDto> declaredFiles, String diffFilePath) {
        return declaredFiles.stream()
                .filter(file -> fileMatches(file, diffFilePath))
                .collect(Collectors.toList());
    }

    private List<String> findDuplicateFiles(Long versionId, String requirementCode, String developer, List<String> files, Long currentChangeSetId) {
        Set<String> existingKeys = declaredFiles(versionId)
                .stream()
                .filter(file -> currentChangeSetId == null || !currentChangeSetId.equals(file.getChangeSetId()))
                .filter(file -> requirementCode.equalsIgnoreCase(file.getRequirementCode()))
                .filter(file -> developer.equalsIgnoreCase(file.getDeveloper()))
                .map(file -> fileKey(file.getFilePath()))
                .collect(Collectors.toSet());

        return files.stream()
                .filter(file -> existingKeys.contains(fileKey(file)))
                .collect(Collectors.toList());
    }

    private List<String> parseFiles(List<String> rawFiles) {
        if (rawFiles == null) {
            return new ArrayList<>();
        }
        return rawFiles.stream()
                .flatMap(raw -> normalizeLines(raw).stream())
                .map(this::normalizeDeclaredFilePath)
                .filter(file -> !file.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .collect(Collectors.toList());
    }

    private List<DiffLine> parseDiffLines(String rawText) {
        return normalizeLines(rawText).stream()
                .map(line -> {
                    String[] parts = line.split("[\\t,]", 2);
                    String filePath = normalizeBeyondCompareDiffFile(parts[0]);
                    String diffType = parts.length > 1 ? parts[1].trim() : "MODIFIED";
                    return new DiffLine(filePath, diffType.isEmpty() ? "MODIFIED" : diffType);
                })
                .filter(item -> !item.filePath.isEmpty())
                .collect(Collectors.toList());
    }

    private List<String> normalizeLines(String rawText) {
        if (rawText == null) {
            return new ArrayList<>();
        }
        return rawText.lines()
                .map(this::normalizePath)
                .filter(line -> !line.isEmpty())
                .filter(line -> !line.startsWith("#"))
                .collect(Collectors.toList());
    }

    private String normalizePath(String value) {
        String result = value == null ? "" : value.trim();
        result = result.replace("\\", "/");
        result = result.replaceAll("^[\\s\\-\\*\\d\\.、]+", "");
        result = result.replaceAll("^['\"]|['\"]$", "");
        return result.trim();
    }

    private String normalizeDeclaredFilePath(String value) {
        String path = normalizePath(stripGitStatus(value));
        return path;
    }

    private String normalizeBeyondCompareDiffFile(String value) {
        String path = normalizePath(value);
        return normalizedFileName(path);
    }

    private String stripGitStatus(String value) {
        String result = normalizePath(value);
        if (result.matches("^[AMDRCU?]{1,2}\\s+.+")) {
            return result.replaceFirst("^[AMDRCU?]{1,2}\\s+", "");
        }
        if (result.matches("^R\\d{3}\\s+.+\\s+.+")) {
            String[] parts = result.split("\\s+");
            return parts[parts.length - 1];
        }
        return result;
    }

    private String fileKey(String value) {
        return normalizePath(value).toLowerCase(Locale.ROOT);
    }

    private String serviceDiffKey(String serviceTag, String filePath) {
        return normalizeServiceTag(serviceTag).toLowerCase(Locale.ROOT) + "::" + fileKey(filePath);
    }

    private String normalizeServiceTag(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String searchableKey(String value) {
        return stripExtension(fileName(value)).toLowerCase(Locale.ROOT);
    }

    private boolean fileMatches(ChangeFileDto declaredFile, String diffFilePath) {
        String declaredExact = fileKey(declaredFile.getFilePath());
        String diffExact = fileKey(diffFilePath);
        if (declaredExact.equals(diffExact)) {
            return true;
        }

        String declaredName = fileKey(declaredFile.getFileName());
        String diffName = searchableKey(diffFilePath);
        return !declaredName.isEmpty() && declaredName.equals(diffName);
    }

    private boolean fileMatchesSearch(String declaredFilePath, String keyword) {
        String path = fileKey(declaredFilePath);
        String query = fileKey(keyword);
        String name = searchableKey(declaredFilePath);
        String queryName = searchableKey(keyword);
        return path.contains(query)
                || (!name.isEmpty() && name.contains(queryName))
                || (!queryName.isEmpty() && queryName.contains(name));
    }

    private String stripExtension(String value) {
        String result = value == null ? "" : value.trim();
        int index = result.lastIndexOf('.');
        return index > 0 ? result.substring(0, index) : result;
    }

    private String normalizedFileName(String filePath) {
        return stripExtension(fileName(filePath));
    }

    private String fileName(String filePath) {
        String normalized = normalizePath(filePath);
        int index = normalized.lastIndexOf('/');
        return index >= 0 ? normalized.substring(index + 1) : normalized;
    }

    private String required(String value, String label) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(label + " is required");
        }
        return value.trim();
    }

    private void ensureVersionExists(Long versionId) {
        if (versionId == null || !versionRepository.existsById(versionId)) {
            throw new IllegalArgumentException("Release version not found: " + versionId);
        }
    }

    private static class DiffLine {
        private final String filePath;
        private final String diffType;

        private DiffLine(String filePath, String diffType) {
            this.filePath = filePath;
            this.diffType = diffType;
        }
    }
}
