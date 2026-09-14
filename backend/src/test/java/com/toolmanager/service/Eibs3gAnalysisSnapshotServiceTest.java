package com.toolmanager.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.toolmanager.dto.Eibs3gAnalysisSnapshotDto;
import com.toolmanager.entity.Eibs3gAnalysisSnapshot;
import com.toolmanager.repository.Eibs3gAnalysisSnapshotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class Eibs3gAnalysisSnapshotServiceTest {
    @Mock
    private Eibs3gAnalysisSnapshotRepository repository;

    private ObjectMapper objectMapper;
    private Eibs3gAnalysisSnapshotService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new Eibs3gAnalysisSnapshotService(repository, objectMapper);
    }

    @Test
    void savesOneGlobalSnapshotWithoutSourceFiles() {
        ObjectNode snapshot = validSnapshot();
        when(repository.findByScopeKey("GLOBAL")).thenReturn(Optional.empty());
        when(repository.saveAndFlush(any(Eibs3gAnalysisSnapshot.class))).thenAnswer(invocation -> {
            Eibs3gAnalysisSnapshot entity = invocation.getArgument(0);
            entity.setId(1L);
            entity.setUpdatedAt(LocalDateTime.of(2026, 9, 11, 10, 30));
            return entity;
        });

        Eibs3gAnalysisSnapshotDto result = service.saveLatest(snapshot, "admin");

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getSavedBy()).isEqualTo("admin");
        assertThat(result.getSnapshot()).isEqualTo(snapshot);
        verify(repository).saveAndFlush(any(Eibs3gAnalysisSnapshot.class));
    }

    @Test
    void rejectsIncompleteSnapshotBeforeWritingDatabase() {
        ObjectNode invalid = objectMapper.createObjectNode()
                .put("schemaVersion", 1)
                .put("rootName", "src");

        assertThatThrownBy(() -> service.saveLatest(invalid, "admin"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("源码指纹");

        verify(repository, never()).saveAndFlush(any(Eibs3gAnalysisSnapshot.class));
    }

    @Test
    void returnsPreviouslySavedGlobalSnapshot() throws Exception {
        Eibs3gAnalysisSnapshot entity = new Eibs3gAnalysisSnapshot();
        entity.setId(7L);
        entity.setScopeKey("GLOBAL");
        entity.setUpdatedBy("tester");
        entity.setUpdatedAt(LocalDateTime.of(2026, 9, 11, 11, 0));
        entity.setSnapshotJson(objectMapper.writeValueAsString(validSnapshot()));
        when(repository.findByScopeKey("GLOBAL")).thenReturn(Optional.of(entity));

        Optional<Eibs3gAnalysisSnapshotDto> result = service.getLatest();

        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(7L);
        assertThat(result.get().getSavedBy()).isEqualTo("tester");
        assertThat(result.get().getSnapshot().path("routeRoots").isArray()).isTrue();
    }

    private ObjectNode validSnapshot() {
        ObjectNode snapshot = objectMapper.createObjectNode();
        snapshot.put("schemaVersion", 1);
        snapshot.put("rootName", "src");
        snapshot.put("sourceFingerprint", "v1-3-abcdef12");
        snapshot.put("analyzedAt", "2026-09-11T10:00:00.000Z");
        snapshot.set("summary", objectMapper.createObjectNode());
        snapshot.set("routeRoots", objectMapper.createArrayNode());
        snapshot.set("componentsByPath", objectMapper.createObjectNode());
        snapshot.set("diagnostics", objectMapper.createArrayNode());
        return snapshot;
    }
}
