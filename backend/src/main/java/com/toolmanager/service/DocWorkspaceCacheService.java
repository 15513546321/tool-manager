package com.toolmanager.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class DocWorkspaceCacheService {

    private static final Path SERVER_CACHE_ROOT = Path.of("/ecss/tool-manager/doc-cache");
    private static final Path LEGACY_USER_CACHE_ROOT = Path.of(System.getProperty("user.home"), ".tool-manager", "doc-cache");
    private static final String WORKSPACE_DIR_NAME = "shared-doc-workspace";
    private static final String MIDDLE_META_FILE = "middle-meta.json";
    private static final String MIDDLE_ENTRIES_FILE = "middle-entries.json";
    private static final String CHAIN_MAP_FILE = "chain-map.json";

    private final ObjectMapper objectMapper;
    private final Path workspaceDir;

    public DocWorkspaceCacheService(
            ObjectMapper objectMapper,
            @Value("${toolmanager.doc-cache.path:}") String cacheRoot) {
        this.objectMapper = objectMapper;
        Path cacheRootPath = resolveCacheRoot(cacheRoot);
        this.workspaceDir = cacheRootPath.resolve(WORKSPACE_DIR_NAME);
        log.info("Document workspace cache root resolved to {}", cacheRootPath);
    }

    public synchronized SharedWorkspaceState loadWorkspace() {
        MiddleWorkspaceMeta meta = readJson(metaPath(), MiddleWorkspaceMeta.class, null);
        Map<String, Object> chainMap = readJson(chainMapPath(), new TypeReference<Map<String, Object>>() {}, new LinkedHashMap<>());

        SharedWorkspaceState state = new SharedWorkspaceState();
        state.setMiddleReady(meta != null && meta.getEntryCount() > 0 && Files.exists(entriesPath()));
        state.setMiddleProjectName(meta != null ? meta.getProjectName() : "");
        state.setMiddleEntryCount(meta != null ? meta.getEntryCount() : 0);
        state.setMiddleCachedAt(meta != null ? meta.getCachedAt() : 0L);
        state.setMiddleEntriesAvailable(state.isMiddleReady());
        state.setChainMap(chainMap);
        state.setChainCount(chainMap.size());
        return state;
    }

    public synchronized MiddleEntriesPayload loadMiddleEntries() {
        MiddleWorkspaceMeta meta = readJson(metaPath(), MiddleWorkspaceMeta.class, null);
        List<MiddleFileEntry> entries = readJson(entriesPath(), new TypeReference<List<MiddleFileEntry>>() {}, new ArrayList<>());

        MiddleEntriesPayload payload = new MiddleEntriesPayload();
        payload.setProjectName(meta != null ? meta.getProjectName() : "");
        payload.setCachedAt(meta != null ? meta.getCachedAt() : 0L);
        payload.setEntryCount(entries.size());
        payload.setEntries(entries);
        return payload;
    }

    public synchronized SharedWorkspaceState saveMiddleEntries(String projectName, List<MiddleFileEntry> entries) throws IOException {
        Files.createDirectories(workspaceDir);

        List<MiddleFileEntry> safeEntries = entries != null ? entries : new ArrayList<>();
        long cachedAt = System.currentTimeMillis();

        MiddleWorkspaceMeta meta = new MiddleWorkspaceMeta();
        meta.setProjectName(projectName != null ? projectName : "");
        meta.setEntryCount(safeEntries.size());
        meta.setCachedAt(cachedAt);

        writeJson(metaPath(), meta);
        writeJson(entriesPath(), safeEntries);
        deleteIfExists(chainMapPath());

        return loadWorkspace();
    }

    public synchronized SharedWorkspaceState saveChainMap(Map<String, Object> chainMap) throws IOException {
        Files.createDirectories(workspaceDir);
        Map<String, Object> safeMap = chainMap != null ? chainMap : new LinkedHashMap<>();
        writeJson(chainMapPath(), safeMap);
        return loadWorkspace();
    }

    public synchronized void clearWorkspace() throws IOException {
        deleteIfExists(chainMapPath());
        deleteIfExists(entriesPath());
        deleteIfExists(metaPath());
    }

    private Path metaPath() {
        return workspaceDir.resolve(MIDDLE_META_FILE);
    }

    private Path entriesPath() {
        return workspaceDir.resolve(MIDDLE_ENTRIES_FILE);
    }

    private Path chainMapPath() {
        return workspaceDir.resolve(CHAIN_MAP_FILE);
    }

    private <T> T readJson(Path path, Class<T> type, T fallback) {
        if (!Files.exists(path)) {
            return fallback;
        }
        try {
            return objectMapper.readValue(path.toFile(), type);
        } catch (Exception e) {
            log.warn("Failed to read JSON from {}: {}", path, e.getMessage());
            return fallback;
        }
    }

    private <T> T readJson(Path path, TypeReference<T> typeReference, T fallback) {
        if (!Files.exists(path)) {
            return fallback;
        }
        try {
            return objectMapper.readValue(path.toFile(), typeReference);
        } catch (Exception e) {
            log.warn("Failed to read JSON from {}: {}", path, e.getMessage());
            return fallback;
        }
    }

    private void writeJson(Path path, Object value) throws IOException {
        Files.createDirectories(path.getParent());
        Path tempFile = Files.createTempFile(path.getParent(), path.getFileName().toString(), ".tmp");
        try {
            try (var writer = Files.newBufferedWriter(tempFile, StandardOpenOption.TRUNCATE_EXISTING)) {
                objectMapper.writerWithDefaultPrettyPrinter().writeValue(writer, value);
            }
            moveReplace(tempFile, path);
        } finally {
            deleteIfExists(tempFile);
        }
    }

    private void moveReplace(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private void deleteIfExists(Path path) throws IOException {
        if (path != null) {
            Files.deleteIfExists(path);
        }
    }

    private Path resolveCacheRoot(String configuredCacheRoot) {
        if (configuredCacheRoot != null && !configuredCacheRoot.trim().isEmpty()) {
            return Path.of(configuredCacheRoot.trim());
        }

        if (Files.exists(Path.of("/ecss"))) {
            return SERVER_CACHE_ROOT;
        }

        return LEGACY_USER_CACHE_ROOT;
    }

    public static class SharedWorkspaceState {
        private boolean middleReady;
        private boolean middleEntriesAvailable;
        private String middleProjectName;
        private int middleEntryCount;
        private long middleCachedAt;
        private int chainCount;
        private Map<String, Object> chainMap = new LinkedHashMap<>();

        public boolean isMiddleReady() {
            return middleReady;
        }

        public void setMiddleReady(boolean middleReady) {
            this.middleReady = middleReady;
        }

        public boolean isMiddleEntriesAvailable() {
            return middleEntriesAvailable;
        }

        public void setMiddleEntriesAvailable(boolean middleEntriesAvailable) {
            this.middleEntriesAvailable = middleEntriesAvailable;
        }

        public String getMiddleProjectName() {
            return middleProjectName;
        }

        public void setMiddleProjectName(String middleProjectName) {
            this.middleProjectName = middleProjectName;
        }

        public int getMiddleEntryCount() {
            return middleEntryCount;
        }

        public void setMiddleEntryCount(int middleEntryCount) {
            this.middleEntryCount = middleEntryCount;
        }

        public long getMiddleCachedAt() {
            return middleCachedAt;
        }

        public void setMiddleCachedAt(long middleCachedAt) {
            this.middleCachedAt = middleCachedAt;
        }

        public int getChainCount() {
            return chainCount;
        }

        public void setChainCount(int chainCount) {
            this.chainCount = chainCount;
        }

        public Map<String, Object> getChainMap() {
            return chainMap;
        }

        public void setChainMap(Map<String, Object> chainMap) {
            this.chainMap = chainMap != null ? chainMap : new LinkedHashMap<>();
        }
    }

    public static class MiddleEntriesPayload {
        private String projectName;
        private long cachedAt;
        private int entryCount;
        private List<MiddleFileEntry> entries = new ArrayList<>();

        public String getProjectName() {
            return projectName;
        }

        public void setProjectName(String projectName) {
            this.projectName = projectName;
        }

        public long getCachedAt() {
            return cachedAt;
        }

        public void setCachedAt(long cachedAt) {
            this.cachedAt = cachedAt;
        }

        public int getEntryCount() {
            return entryCount;
        }

        public void setEntryCount(int entryCount) {
            this.entryCount = entryCount;
        }

        public List<MiddleFileEntry> getEntries() {
            return entries;
        }

        public void setEntries(List<MiddleFileEntry> entries) {
            this.entries = entries != null ? entries : new ArrayList<>();
        }
    }

    public static class MiddleFileEntry {
        private String name;
        private String path;
        private String content;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getPath() {
            return path;
        }

        public void setPath(String path) {
            this.path = path;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }
    }

    private static class MiddleWorkspaceMeta {
        private String projectName;
        private int entryCount;
        private long cachedAt;

        public String getProjectName() {
            return projectName;
        }

        public void setProjectName(String projectName) {
            this.projectName = projectName;
        }

        public int getEntryCount() {
            return entryCount;
        }

        public void setEntryCount(int entryCount) {
            this.entryCount = entryCount;
        }

        public long getCachedAt() {
            return cachedAt;
        }

        public void setCachedAt(long cachedAt) {
            this.cachedAt = cachedAt;
        }
    }
}
