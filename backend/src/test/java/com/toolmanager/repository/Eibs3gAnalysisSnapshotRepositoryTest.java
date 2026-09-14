package com.toolmanager.repository;

import com.toolmanager.entity.Eibs3gAnalysisSnapshot;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:eibs3g-snapshot-test;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never"
})
class Eibs3gAnalysisSnapshotRepositoryTest {
    @Autowired
    private Eibs3gAnalysisSnapshotRepository repository;

    @Test
    void persistsAndReplacesTheGlobalClobSnapshot() {
        Eibs3gAnalysisSnapshot entity = new Eibs3gAnalysisSnapshot();
        entity.setScopeKey("GLOBAL");
        entity.setSchemaVersion(1);
        entity.setProjectName("src");
        entity.setSourceFingerprint("v1-3-abcdef12");
        entity.setSnapshotJson("{\"schemaVersion\":1,\"componentsByPath\":{}}");
        entity.setSnapshotSize((long) entity.getSnapshotJson().length());
        entity.setUpdatedBy("admin");

        Eibs3gAnalysisSnapshot saved = repository.saveAndFlush(entity);
        saved.setSnapshotJson("{\"schemaVersion\":1,\"componentsByPath\":{\"views/a.vue\":{}}}");
        saved.setSnapshotSize((long) saved.getSnapshotJson().length());
        repository.saveAndFlush(saved);

        Eibs3gAnalysisSnapshot restored = repository.findByScopeKey("GLOBAL").orElseThrow();
        assertThat(restored.getId()).isEqualTo(saved.getId());
        assertThat(restored.getSnapshotJson()).contains("views/a.vue");
        assertThat(restored.getUpdatedAt()).isNotNull();
    }
}
