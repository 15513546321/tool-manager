package com.toolmanager.util;

import com.toolmanager.dto.DiffRowDTO;
import com.toolmanager.dto.DetailedDiffResultDTO;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 配置文件差异对比工具
 * 模拟Beyond Compare的双栏对比效果
 * 支持行级差异识别和智能配置块匹配
 */
public class NacosDiffTool {

    /**
     * 对比两个配置内容
     * @param dataId 配置ID
     * @param group 配置分组
     * @param original 源环境配置内容
     * @param revised 目标环境配置内容
     * @return 详细的差异结果（包含所有行，前端根据 tag 判断显示）
     */
    public static DetailedDiffResultDTO compareConfigs(String dataId, String group, String original, String revised) {
        DetailedDiffResultDTO result = new DetailedDiffResultDTO();
        result.setDataId(dataId);
        result.setGroup(group);

        // 处理null值
        original = original == null ? "" : original;
        revised = revised == null ? "" : revised;

        // 检查是否相同
        if (original.equals(revised)) {
            result.setStatus("same");
            result.setDiffRows(new ArrayList<>());
            result.setTotalLines(0);
            result.setChangedLines(0);
            result.setInsertedLines(0);
            result.setDeletedLines(0);
            result.setMovedLines(0); // Initialize new field
            return result;
        }

        // 检查只在源环境或只在目标环境
        if (original.isEmpty()) {
            result.setStatus("target-only");
            result.setDiffRows(generateTargetOnlyRows(revised));
            result.setTotalLines(result.getDiffRows().size());
            result.setInsertedLines(result.getDiffRows().size()); // all are inserts
            result.setMovedLines(0);
            return result;
        }

        if (revised.isEmpty()) {
            result.setStatus("source-only");
            result.setDiffRows(generateSourceOnlyRows(original));
            result.setTotalLines(result.getDiffRows().size());
            result.setDeletedLines(result.getDiffRows().size()); // all are deletes
            result.setMovedLines(0);
            return result;
        }

        // 两个都有内容，进行详细对比
        List<DiffRowDTO> allDiffRows = computeLineByLineDiff(
            original.split("\n", -1),
            revised.split("\n", -1)
        );
        
        // --- 新增：后处理以识别移动的行 ---
        allDiffRows = postProcessDiffRows(allDiffRows);
        // --- 结束新增 ---

        boolean hasRealDifference = allDiffRows.stream().anyMatch(r -> 
            !"EQUAL".equals(r.getTag()) && !"MOVED".equals(r.getTag()) // MOVED也不算作“实际差异” for 'same' status
        );

        if (!hasRealDifference && allDiffRows.stream().noneMatch(r -> "CHANGE".equals(r.getTag()) || "INSERT".equals(r.getTag()) || "DELETE".equals(r.getTag()))) {
            result.setStatus("same"); // If only MOVED or EQUAL, it's considered 'same' for overall status
            result.setDiffRows(new ArrayList<>()); // Clear diffRows if status is 'same' and no real changes
            result.setTotalLines(0);
            result.setChangedLines(0);
            result.setInsertedLines(0);
            result.setDeletedLines(0);
            result.setMovedLines(0);
            return result;
        }
        
        result.setStatus("different");
        result.setDiffRows(allDiffRows);

        // 统计信息 - 仅统计差异行，不统计EQUAL行
        long changedLines = allDiffRows.stream().filter(r -> "CHANGE".equals(r.getTag())).count();
        long insertedLines = allDiffRows.stream().filter(r -> "INSERT".equals(r.getTag())).count();
        long deletedLines = allDiffRows.stream().filter(r -> "DELETE".equals(r.getTag())).count();
        long movedLines = allDiffRows.stream().filter(r -> "MOVED".equals(r.getTag())).count(); // 统计MOVED行

        // 总差异行数 (不包括EQUAL和MOVED，因为MOVED行在用户看来不应该算作新增或删除的“差异”统计)
        long totalDiffLines = changedLines + insertedLines + deletedLines + movedLines;

        result.setTotalLines((int) allDiffRows.size()); // Total visible lines including EQUAL, CHANGE, INSERT, DELETE, MOVED
        result.setChangedLines((int) changedLines);
        result.setInsertedLines((int) insertedLines);
        result.setDeletedLines((int) deletedLines);
        result.setMovedLines((int) movedLines);

        return result;
    }

    /**
     * 使用 Myers 差异算法进行逐行对比
     * 返回完整的差异序列，包括相同行、修改行、删除行、插入行
     */
    private static List<DiffRowDTO> computeLineByLineDiff(String[] original, String[] revised) {
        int m = original.length;
        int n = revised.length;
        
        // 构建edit distance矩阵和回溯路径
        int[][] dp = new int[m + 1][n + 1];
        // direction: 0:match, 1:delete from original, 2:insert to revised, 3:change both
        int[][] direction = new int[m + 1][n + 1]; 
        
        // 初始化第一行和第一列
        for (int i = 0; i <= m; i++) {
            dp[i][0] = i;
            if (i > 0) direction[i][0] = 1; // delete
        }
        
        for (int j = 0; j <= n; j++) {
            dp[0][j] = j;
            if (j > 0) direction[0][j] = 2; // insert
        }
        
        // 填充dp矩阵
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (original[i - 1].equals(revised[j - 1])) {
                    // 行相同，不增加距离
                    dp[i][j] = dp[i - 1][j - 1];
                    direction[i][j] = 0; // match
                } else {
                    // 选择最小代价的操作
                    int delete = dp[i - 1][j] + 1;
                    int insert = dp[i][j - 1] + 1;
                    int change = dp[i - 1][j - 1] + 1;
                    
                    // 优先匹配删除、插入、修改
                    if (delete <= insert && delete <= change) { // Prefer delete
                        dp[i][j] = delete;
                        direction[i][j] = 1; // delete
                    } else if (insert < change) { // Prefer insert over change if costs are equal
                        dp[i][j] = insert;
                        direction[i][j] = 2; // insert
                    } else { // Fallback to change
                        dp[i][j] = change;
                        direction[i][j] = 3; // change
                    }
                }
            }
        }
        
        // 回溯生成差异行列表
        List<DiffRowDTO> diffRows = new ArrayList<>();
        int i = m;
        int j = n;
        
        while (i > 0 || j > 0) {
            if (i == 0) { // Only inserts left
                DiffRowDTO row = new DiffRowDTO();
                row.setTag("INSERT");
                row.setOldLine("");
                row.setNewLine(revised[j - 1]);
                row.setOldLineNumber(-1); // Indicates no old line
                row.setNewLineNumber(j);
                diffRows.add(0, row);
                j--;
            } else if (j == 0) { // Only deletes left
                DiffRowDTO row = new DiffRowDTO();
                row.setTag("DELETE");
                row.setOldLine(original[i - 1]);
                row.setNewLine("");
                row.setOldLineNumber(i);
                row.setNewLineNumber(-1); // Indicates no new line
                diffRows.add(0, row);
                i--;
            } else {
                int dir = direction[i][j];
                
                if (dir == 0) { // Match
                    DiffRowDTO row = new DiffRowDTO();
                    row.setTag("EQUAL");
                    row.setOldLine(original[i - 1]);
                    row.setNewLine(revised[j - 1]);
                    row.setOldLineNumber(i);
                    row.setNewLineNumber(j);
                    diffRows.add(0, row);
                    i--;
                    j--;
                } else if (dir == 1) { // Delete
                    DiffRowDTO row = new DiffRowDTO();
                    row.setTag("DELETE");
                    row.setOldLine(original[i - 1]);
                    row.setNewLine("");
                    row.setOldLineNumber(i);
                    row.setNewLineNumber(-1);
                    diffRows.add(0, row);
                    i--;
                } else if (dir == 2) { // Insert
                    DiffRowDTO row = new DiffRowDTO();
                    row.setTag("INSERT");
                    row.setOldLine("");
                    row.setNewLine(revised[j - 1]);
                    row.setOldLineNumber(-1);
                    row.setNewLineNumber(j);
                    diffRows.add(0, row);
                    j--;
                } else { // Change
                    DiffRowDTO row = new DiffRowDTO();
                    row.setTag("CHANGE");
                    row.setOldLine(original[i - 1]);
                    row.setNewLine(revised[j - 1]);
                    row.setOldLineNumber(i);
                    row.setNewLineNumber(j);
                    diffRows.add(0, row);
                    i--;
                    j--;
                }
            }
        }
        
        return diffRows;
    }

    /**
     * 后处理差异行，识别并标记移动的行。
     * 将内容相同的 DELETE 和 INSERT 对标记为 MOVED。
     *
     * 该方法旨在将 Myers 算法生成的基础 DELETE/INSERT 对（内容相同但位置不同）
     * 转换为更语义化的 MOVED 标记，并保持差异的原始相对顺序。
     */
    private static List<DiffRowDTO> postProcessDiffRows(List<DiffRowDTO> initialDiffRows) {
        // Step 1: Collect all DELETE and INSERT rows into queues for content-based matching
        Map<String, LinkedList<DiffRowDTO>> deleteQueues = new HashMap<>(); // content -> queue of DELETE rows
        Map<String, LinkedList<DiffRowDTO>> insertQueues = new HashMap<>(); // content -> queue of INSERT rows

        for (DiffRowDTO row : initialDiffRows) {
            if ("DELETE".equals(row.getTag())) {
                deleteQueues.computeIfAbsent(row.getOldLine().trim(), k -> new LinkedList<>()).add(row);
            } else if ("INSERT".equals(row.getTag())) {
                insertQueues.computeIfAbsent(row.getNewLine().trim(), k -> new LinkedList<>()).add(row);
            }
        }


        // Step 2: Match DELETEs and INSERTs to create MOVED rows and track original rows used
        // Maps to link original DELETE/INSERT DiffRowDTO objects to their new MOVED DiffRowDTO
        Map<DiffRowDTO, DiffRowDTO> originalDeleteToMovedMap = new HashMap<>();
        Map<DiffRowDTO, DiffRowDTO> originalInsertToMovedMap = new HashMap<>(); // Used to mark inserts as consumed

        // Iterate through all collected DELETE queues to find matches
        for (LinkedList<DiffRowDTO> deletesForContent : deleteQueues.values()) {
            Iterator<DiffRowDTO> deleteIterator = deletesForContent.iterator();
            while (deleteIterator.hasNext()) {
                DiffRowDTO deleteRow = deleteIterator.next();
                LinkedList<DiffRowDTO> insertsForContent = insertQueues.get(deleteRow.getOldLine().trim()); // Use oldLine for content

                if (insertsForContent != null && !insertsForContent.isEmpty()) {
                    DiffRowDTO insertRow = insertsForContent.poll(); // Get and remove a matching INSERT
                    
                    if (insertRow != null) {
                        DiffRowDTO movedRow = new DiffRowDTO();
                        movedRow.setTag("MOVED");
                        movedRow.setOldLine(deleteRow.getOldLine());
                        movedRow.setNewLine(insertRow.getNewLine());
                        movedRow.setOldLineNumber(deleteRow.getOldLineNumber());
                        movedRow.setNewLineNumber(insertRow.getNewLineNumber());
                        
                        originalDeleteToMovedMap.put(deleteRow, movedRow);
                        originalInsertToMovedMap.put(insertRow, movedRow); // Mark this insert as consumed by a move
                        
                        deleteIterator.remove(); // Remove this delete from its queue (it's now part of a MOVED)
                    }
                }
            }
        }

        // Step 3: Reconstruct the final list, substituting MOVED rows and maintaining original relative order
        List<DiffRowDTO> finalProcessedRows = new ArrayList<>();
        // This set ensures that a MOVED row (which corresponds to both a DELETE and an INSERT) is added only once
        Set<DiffRowDTO> addedMovedRows = new HashSet<>(); 

        for (DiffRowDTO row : initialDiffRows) {
            if (originalDeleteToMovedMap.containsKey(row)) {
                // This 'row' is an original DELETE that was part of a MOVED operation
                DiffRowDTO movedRow = originalDeleteToMovedMap.get(row);
                if (!addedMovedRows.contains(movedRow)) {
                    finalProcessedRows.add(movedRow);
                    addedMovedRows.add(movedRow);
                }
            } else if (originalInsertToMovedMap.containsKey(row)) {
                // This 'row' is an original INSERT that was part of a MOVED operation
                // Since the MOVED row was already added when its corresponding DELETE was processed, skip this INSERT.
                continue;
            } else {
                // This is an EQUAL, CHANGE, or an unmatched DELETE/INSERT
                finalProcessedRows.add(row);
            }
        }

        // Step 4: Re-calculate line numbers for the final list to ensure continuity and correctness
        int currentOriginalLineNum = 1;
        int currentNewLineNum = 1;
        for (DiffRowDTO row : finalProcessedRows) {
            if ("EQUAL".equals(row.getTag()) || "CHANGE".equals(row.getTag()) || "MOVED".equals(row.getTag())) {
                row.setOldLineNumber(currentOriginalLineNum++);
                row.setNewLineNumber(currentNewLineNum++);
            } else if ("DELETE".equals(row.getTag())) {
                row.setOldLineNumber(currentOriginalLineNum++);
                row.setNewLineNumber(-1); // Target has no corresponding line
            } else if ("INSERT".equals(row.getTag())) {
                row.setOldLineNumber(-1); // Original has no corresponding line
                row.setNewLineNumber(currentNewLineNum++);
            }
        }
        
        return finalProcessedRows;
    }



    /**
     * 生成源独有的行（未被匹配的删除行）
     */
    private static List<DiffRowDTO> generateSourceOnlyRows(String original) {
        String[] lines = original.split("\n", -1);
        List<DiffRowDTO> rows = new ArrayList<>();

        for (int i = 0; i < lines.length; i++) {
            DiffRowDTO row = new DiffRowDTO();
            row.setTag("DELETE");
            row.setOldLine(lines[i]);
            row.setNewLine("");
            row.setOldLineNumber(i + 1);
            row.setNewLineNumber(-1);
            rows.add(row);
        }

        return rows;
    }

    /**
     * 生成目标独有的行（未被匹配的插入行）
     */
    private static List<DiffRowDTO> generateTargetOnlyRows(String revised) {
        String[] lines = revised.split("\n", -1);
        List<DiffRowDTO> rows = new ArrayList<>();

        for (int i = 0; i < lines.length; i++) {
            DiffRowDTO row = new DiffRowDTO();
            row.setTag("INSERT");
            row.setOldLine("");
            row.setNewLine(lines[i]);
            row.setOldLineNumber(-1);
            row.setNewLineNumber(i + 1);
            rows.add(row);
        }

        return rows;
    }

    /**
     * 从diffRows生成建议源→目标同步的配置
     */
    public static String generateSyncToTargetConfig(List<DiffRowDTO> diffRows) {
        StringBuilder sb = new StringBuilder();
        boolean hasChanges = false;

        for (DiffRowDTO row : diffRows) {
            if ("INSERT".equals(row.getTag()) || "CHANGE".equals(row.getTag()) || "MOVED".equals(row.getTag())) {
                // 这些是需要同步到目标的内容
                sb.append(row.getNewLine()).append("\n");
                hasChanges = true;
            } else if ("EQUAL".equals(row.getTag())) {
                // 相同行也应该包含在同步后的内容中
                sb.append(row.getNewLine()).append("\n");
            }
        }

        if (!hasChanges) {
            return "# 无需同步到目标环境";
        }

        return sb.toString().trim();
    }

    /**
     * 从diffRows生成建议从目标删除的配置
     */
    public static String generateDeleteFromTargetConfig(List<DiffRowDTO> diffRows) {
        StringBuilder sb = new StringBuilder();
        boolean hasDeletes = false;

        for (DiffRowDTO row : diffRows) {
            if ("DELETE".equals(row.getTag())) {
                // 这些是需要从目标删除的内容
                sb.append(row.getOldLine()).append("\n");
                hasDeletes = true;
            }
        }

        if (!hasDeletes) {
            return "# 目标环境无需删除";
        }

        return sb.toString().trim();
    }
}