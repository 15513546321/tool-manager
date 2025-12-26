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

        // 检查是否相同（需要处理换行符差异和空白字符）
        if (areContentsSame(original, revised)) {
            result.setStatus("same");
            List<DiffRowDTO> equalRows = new ArrayList<>();
            String[] lines = original.split("\n", -1);
            for (int i = 0; i < lines.length; i++) {
                DiffRowDTO row = new DiffRowDTO();
                row.setTag("EQUAL");
                row.setOldLine(lines[i]);
                row.setNewLine(lines[i]);
                row.setOldLineNumber(i + 1);
                row.setNewLineNumber(i + 1);
                equalRows.add(row);
            }
            result.setDiffRows(equalRows);
            result.setTotalLines(lines.length); // Set total lines to actual number of lines
            result.setChangedLines(0);
            result.setInsertedLines(0);
            result.setDeletedLines(0);
            result.setMovedLines(0);
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

        if (!hasRealDifference) {
            result.setStatus("same"); // If only MOVED or EQUAL, it's considered 'same' for overall status
            result.setDiffRows(allDiffRows); // Keep allDiffRows to display the content
            result.setTotalLines(allDiffRows.size()); // Set total lines to actual number of lines
            // Counts for changed, inserted, deleted, moved are already 0 for 'same' status in this case
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

    private static String normalizeLineContent(String line) {
        if (line == null) {
            return "";
        }
        // Remove carriage returns, then replace non-breaking spaces, then trim
        // This addresses common invisible whitespace issues.
        return line.replace("\r", "").replace("\u00A0", " ").trim();
    }

    /**
     * 激进的规范化：去除所有空白字符
     * 用于在后处理中匹配内容相同但格式（空格）稍有不同的行
     */
    private static String aggressiveNormalize(String line) {
        if (line == null) {
            return "";
        }
        // 移除所有空白字符（空格、制表符、换行符等）
        return line.replaceAll("\\s+", "");
    }

    /**
     * 后处理差异行，识别并标记移动的行。
     * 将内容相同的 DELETE 和 INSERT 对标记为 MOVED。
     *
     * 该方法旨在将 Myers 算法生成的基础 DELETE/INSERT 对（内容相同但位置不同）
     * 转换为更语义化的 MOVED 标记，并保持差异的原始相对顺序。
     */
    private static List<DiffRowDTO> postProcessDiffRows(List<DiffRowDTO> initialDiffRows) {
        // Step 0: Expand CHANGE rows into DELETE and INSERT for better move detection
        // This allows us to detect moves even if they were initially classified as CHANGEs
        List<DiffRowDTO> expandedRows = new ArrayList<>();
        for (DiffRowDTO row : initialDiffRows) {
            if ("CHANGE".equals(row.getTag())) {
                // Split CHANGE into DELETE and INSERT
                DiffRowDTO deleteRow = new DiffRowDTO();
                deleteRow.setTag("DELETE");
                deleteRow.setOldLine(row.getOldLine());
                deleteRow.setNewLine("");
                deleteRow.setOldLineNumber(row.getOldLineNumber());
                deleteRow.setNewLineNumber(-1);

                DiffRowDTO insertRow = new DiffRowDTO();
                insertRow.setTag("INSERT");
                insertRow.setOldLine("");
                insertRow.setNewLine(row.getNewLine());
                insertRow.setOldLineNumber(-1);
                insertRow.setNewLineNumber(row.getNewLineNumber());

                expandedRows.add(deleteRow);
                expandedRows.add(insertRow);
            } else {
                expandedRows.add(row);
            }
        }

        // Step 1: Collect all DELETE and INSERT rows into queues for content-based matching
        Map<String, LinkedList<DiffRowDTO>> deleteQueues = new HashMap<>(); // content -> queue of DELETE rows
        Map<String, LinkedList<DiffRowDTO>> insertQueues = new HashMap<>(); // content -> queue of INSERT rows

        for (DiffRowDTO row : expandedRows) {
            if ("DELETE".equals(row.getTag())) {
                // 使用激进规范化作为 Key，忽略空格差异
                deleteQueues.computeIfAbsent(aggressiveNormalize(row.getOldLine()), k -> new LinkedList<>()).add(row);
            } else if ("INSERT".equals(row.getTag())) {
                insertQueues.computeIfAbsent(aggressiveNormalize(row.getNewLine()), k -> new LinkedList<>()).add(row);
            }
        }

        // Step 2: Match DELETEs and INSERTs to create MOVED rows and track original rows used
        // Maps to link original DELETE/INSERT DiffRowDTO objects to their new MOVED DiffRowDTO
        Map<DiffRowDTO, DiffRowDTO> originalDeleteToMovedMap = new HashMap<>();
        Map<DiffRowDTO, DiffRowDTO> originalInsertToMovedMap = new HashMap<>(); // Used to mark inserts as consumed

        // Iterate through all collected DELETE queues to find matches
        for (Map.Entry<String, LinkedList<DiffRowDTO>> entry : deleteQueues.entrySet()) {
            String contentKey = entry.getKey();
            LinkedList<DiffRowDTO> deletesForContent = entry.getValue();
            
            Iterator<DiffRowDTO> deleteIterator = deletesForContent.iterator();
            while (deleteIterator.hasNext()) {
                DiffRowDTO deleteRow = deleteIterator.next();
                LinkedList<DiffRowDTO> insertsForContent = insertQueues.get(contentKey); // Use same key

                if (insertsForContent != null && !insertsForContent.isEmpty()) {
                    DiffRowDTO insertRow = insertsForContent.poll(); // Get and remove a matching INSERT
                    
                    if (insertRow != null) {
                        DiffRowDTO movedRow = new DiffRowDTO();
                        movedRow.setTag("MOVED");
                        movedRow.setOldLine(deleteRow.getOldLine()); // Keep original content for display
                        movedRow.setNewLine(insertRow.getNewLine()); // Keep original content for display
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
        List<DiffRowDTO> processedRows = new ArrayList<>();
        // This set ensures that a MOVED row (which corresponds to both a DELETE and an INSERT) is added only once
        Set<DiffRowDTO> addedMovedRows = new HashSet<>(); 

        for (DiffRowDTO row : expandedRows) {
            if (originalDeleteToMovedMap.containsKey(row)) {
                // This 'row' is an original DELETE that was part of a MOVED operation
                DiffRowDTO movedRow = originalDeleteToMovedMap.get(row);
                if (!addedMovedRows.contains(movedRow)) {
                    processedRows.add(movedRow);
                    addedMovedRows.add(movedRow);
                }
            } else if (originalInsertToMovedMap.containsKey(row)) {
                // This 'row' is an original INSERT that was part of a MOVED operation
                // Since the MOVED row was already added when its corresponding DELETE was processed, skip this INSERT.
                continue;
            } else {
                // This is an EQUAL, or an unmatched DELETE/INSERT
                processedRows.add(row);
            }
        }

        // Step 4: Merge remaining adjacent DELETE/INSERT pairs back to CHANGE if possible
        // This restores the UI for actual changes that were not identified as moves
        List<DiffRowDTO> mergedRows = mergeDeleteInsertToChange(processedRows);

        // Step 5: Re-calculate line numbers for the final list to ensure continuity and correctness
        int currentOriginalLineNum = 1;
        int currentNewLineNum = 1;
        for (DiffRowDTO row : mergedRows) {
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
        
        return mergedRows;
    }

    /**
     * 将相邻的 DELETE 和 INSERT 合并回 CHANGE
     */
    private static List<DiffRowDTO> mergeDeleteInsertToChange(List<DiffRowDTO> rows) {
        List<DiffRowDTO> result = new ArrayList<>();
        DiffRowDTO pendingDelete = null;
        
        for (DiffRowDTO row : rows) {
            if ("DELETE".equals(row.getTag())) {
                if (pendingDelete != null) {
                    result.add(pendingDelete);
                }
                pendingDelete = row;
            } else if ("INSERT".equals(row.getTag())) {
                if (pendingDelete != null) {
                    // Found a DELETE followed by an INSERT -> Merge to CHANGE
                    DiffRowDTO changeRow = new DiffRowDTO();
                    changeRow.setTag("CHANGE");
                    changeRow.setOldLine(pendingDelete.getOldLine());
                    changeRow.setNewLine(row.getNewLine());
                    // Use original line numbers if available, or calculate later
                    changeRow.setOldLineNumber(pendingDelete.getOldLineNumber());
                    changeRow.setNewLineNumber(row.getNewLineNumber());
                    
                    result.add(changeRow);
                    pendingDelete = null;
                } else {
                    result.add(row);
                }
            } else {
                if (pendingDelete != null) {
                    result.add(pendingDelete);
                    pendingDelete = null;
                }
                result.add(row);
            }
        }
        if (pendingDelete != null) {
            result.add(pendingDelete);
        }
        return result;
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
                // 相同行也应该包含在同步后的内容
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

    /**
     * 智能比较两个内容是否相同
     * 处理常见的编码和空白字符差异：
     * - 换行符差异 (CRLF vs LF)
     * - BOM 标记
     * - 不同行尾的空白字符
     */
    private static boolean areContentsSame(String original, String revised) {
        // 第一步：直接比较（最快）
        if (original.equals(revised)) {
            return true;
        }

        // 第二步：规范化并比较
        String normalizedOrig = normalizeContent(original);
        String normalizedRev = normalizeContent(revised);
        
        if (normalizedOrig.equals(normalizedRev)) {
            return true;
        }

        // 第三步：按行比较（更细致地处理行级差异）
        String[] origLines = original.split("\n", -1);
        String[] revLines = revised.split("\n", -1);

        if (origLines.length != revLines.length) {
            return false;
        }

        for (int i = 0; i < origLines.length; i++) {
            String origLine = normalizeLineContent(origLines[i]);
            String revLine = normalizeLineContent(revLines[i]);
            if (!origLine.equals(revLine)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 规范化内容：处理整个文本的空白和编码问题
     */
    private static String normalizeContent(String content) {
        if (content == null) {
            return "";
        }
        
        // 移除 BOM 标记
        if (content.startsWith("\uFEFF")) {
            content = content.substring(1);
        }
        
        // 统一换行符为 \n（处理 CRLF 和其他差异）
        content = content.replace("\r\n", "\n").replace("\r", "\n");
        
        // 移除尾部空白（包括空格、制表符和换行）
        content = content.replaceAll("\\s+$", "");
        
        return content;
    }
}
