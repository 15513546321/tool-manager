package com.toolmanager.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.toolmanager.dto.Eibs3gAnalysisSnapshotDto;
import com.toolmanager.entity.Eibs3gAnalysisSnapshot;
import com.toolmanager.repository.Eibs3gAnalysisSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class Eibs3gAnalysisSnapshotService {
    private static final String GLOBAL_SCOPE = "GLOBAL";
    private static final int SUPPORTED_SCHEMA_VERSION = 1;
    private static final int MAX_SNAPSHOT_BYTES = 50 * 1024 * 1024;

    private final Eibs3gAnalysisSnapshotRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public Optional<Eibs3gAnalysisSnapshotDto> getLatest() {
        return repository.findByScopeKey(GLOBAL_SCOPE).map(this::toDto);
    }

    @Transactional
    public Eibs3gAnalysisSnapshotDto saveLatest(JsonNode snapshot, String username) {
        validateSnapshot(snapshot);

        final String snapshotJson;
        try {
            snapshotJson = objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("分析结果无法序列化，请重新分析后再试", ex);
        }

        int snapshotBytes = snapshotJson.getBytes(StandardCharsets.UTF_8).length;
        if (snapshotBytes > MAX_SNAPSHOT_BYTES) {
            throw new IllegalArgumentException("分析结果超过 50 MB，暂时无法保存，请联系管理员调整容量限制");
        }

        Eibs3gAnalysisSnapshot entity = repository.findByScopeKey(GLOBAL_SCOPE)
                .orElseGet(Eibs3gAnalysisSnapshot::new);
        entity.setScopeKey(GLOBAL_SCOPE);
        entity.setSchemaVersion(snapshot.path("schemaVersion").asInt());
        entity.setProjectName(snapshot.path("rootName").asText());
        entity.setSourceFingerprint(snapshot.path("sourceFingerprint").asText());
        entity.setSnapshotJson(snapshotJson);
        entity.setSnapshotSize((long) snapshotBytes);
        entity.setUpdatedBy(username == null || username.trim().isEmpty() ? "未知用户" : username.trim());

        Eibs3gAnalysisSnapshot saved = repository.saveAndFlush(entity);
        log.info(
                "已保存全平台网银接口分析快照: id={}, project={}, size={} bytes, user={}",
                saved.getId(),
                saved.getProjectName(),
                saved.getSnapshotSize(),
                saved.getUpdatedBy()
        );
        return toDto(saved);
    }

    private void validateSnapshot(JsonNode snapshot) {
        if (snapshot == null || !snapshot.isObject()) {
            throw new IllegalArgumentException("分析结果不能为空");
        }
        if (snapshot.path("schemaVersion").asInt(-1) != SUPPORTED_SCHEMA_VERSION) {
            throw new IllegalArgumentException("不支持的分析结果版本，请刷新页面后重新分析");
        }
        String rootName = snapshot.path("rootName").asText("").trim();
        if (rootName.isEmpty() || rootName.length() > 255) {
            throw new IllegalArgumentException("分析结果中的项目名称无效");
        }
        String fingerprint = snapshot.path("sourceFingerprint").asText("").trim();
        if (fingerprint.isEmpty() || fingerprint.length() > 128) {
            throw new IllegalArgumentException("分析结果中的源码指纹无效");
        }
        if (!snapshot.path("summary").isObject()) {
            throw new IllegalArgumentException("分析结果缺少统计信息");
        }
        if (!snapshot.path("routeRoots").isArray()) {
            throw new IllegalArgumentException("分析结果缺少路由顶点");
        }
        if (!snapshot.path("componentsByPath").isObject()) {
            throw new IllegalArgumentException("分析结果缺少组件关系");
        }
        if (!snapshot.path("diagnostics").isArray()) {
            throw new IllegalArgumentException("分析结果缺少诊断信息");
        }
    }

    private Eibs3gAnalysisSnapshotDto toDto(Eibs3gAnalysisSnapshot entity) {
        try {
            return new Eibs3gAnalysisSnapshotDto(
                    entity.getId(),
                    entity.getUpdatedBy(),
                    entity.getUpdatedAt(),
                    objectMapper.readTree(entity.getSnapshotJson())
            );
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("已保存的网银接口分析结果损坏，请重新上传 src", ex);
        }
    }
}
