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
     */
    private static List<DiffRowDTO> postProcessDiffRows(List<DiffRowDTO> initialDiffRows) {
        List<DiffRowDTO> resultRows = new ArrayList<>();
        
        // 收集所有 DELETE 和 INSERT 行，并存储它们的原始引用，使用 LinkedList 作为队列
        Map<String, LinkedList<DiffRowDTO>> deleteCandidates = new HashMap<>(); // content -> queue of DELETE rows
        Map<String, LinkedList<DiffRowDTO>> insertCandidates = new HashMap<>(); // content -> queue of INSERT rows

        // 用于标记已经被 MOVED 逻辑处理过的原始行对象
        Set<DiffRowDTO> handledOriginalDiffRowObjects = new HashSet<>();

        // 第一遍：分类原始差异行
        // 同时将 EQUAL 和 CHANGE 行直接添加到结果列表
        for (DiffRowDTO row : initialDiffRows) {
            if ("DELETE".equals(row.getTag())) {
                deleteCandidates.computeIfAbsent(row.getOldLine(), k -> new LinkedList<>()).add(row);
            } else if ("INSERT".equals(row.getTag())) {
                insertCandidates.computeIfAbsent(row.getNewLine(), k -> new LinkedList<>()).add(row);
            } else {
                resultRows.add(row); // EQUAL and CHANGE rows are added directly and will be sorted later
            }
        }
        
        // 尝试匹配 DELETE 和 INSERT 为 MOVED
        // 遍历 deleteCandidates 的每个内容组
        for (Map.Entry<String, LinkedList<DiffRowDTO>> entry : deleteCandidates.entrySet()) {
            String content = entry.getKey();
            LinkedList<DiffRowDTO> deletes = entry.getValue(); // 某个内容的所有 DELETE 行队列
            LinkedList<DiffRowDTO> inserts = insertCandidates.get(content); // 某个内容的所有 INSERT 行队列

            if (inserts != null) {
                // 尽可能多地匹配当前内容的 DELETE 和 INSERT
                while (!deletes.isEmpty() && !inserts.isEmpty()) {
                    DiffRowDTO deleteRow = deletes.poll(); // 从队列中取出并移除
                    DiffRowDTO insertRow = inserts.poll(); // 从队列中取出并移除
                    
                    if (deleteRow != null && insertRow != null) {
                        DiffRowDTO movedRow = new DiffRowDTO();
                        movedRow.setTag("MOVED");
                        movedRow.setOldLine(deleteRow.getOldLine());
                        movedRow.setNewLine(insertRow.getNewLine());
                        movedRow.setOldLineNumber(deleteRow.getOldLineNumber());
                        movedRow.setNewLineNumber(insertRow.getNewLineNumber());
                        
                        resultRows.add(movedRow);
                        
                        // 标记这些原始行已由 MOVED 逻辑处理
                        handledOriginalDiffRowObjects.add(deleteRow);
                        handledOriginalDiffRowObjects.add(insertRow);
                    }
                }
            }
        }
        
        // 将剩余未被 MOVED 逻辑处理的 DELETE 和 INSERT 行添加回结果列表
        // 这些是真正的 DELETE 或 INSERT
        for (DiffRowDTO row : initialDiffRows) {
            if (!handledOriginalDiffRowObjects.contains(row) && ("DELETE".equals(row.getTag()) || "INSERT".equals(row.getTag()))) {
                resultRows.add(row);
            }
        }

        // 最后一步：根据原始行号对结果进行排序，以保持逻辑顺序
        // 排序逻辑需要考虑：
        // 1. 原始行号（oldLineNumber）和新行号（newLineNumber）
        // 2. 对于那些只有一边有行号的行（DELETE只有oldLineNumber，INSERT只有newLineNumber），
        //    需要有合理的默认值或特殊处理，确保它们不会被错误地排序到列表的开始或结束
        resultRows.sort((r1, r2) -> {
            // 计算一个综合的“起始”位置，优先考虑 oldLineNumber，其次是 newLineNumber
            // 负数行号表示该侧没有对应的行
            int r1StartPos = r1.getOldLineNumber() != -1 ? r1.getOldLineNumber() : (r1.getNewLineNumber() != -1 ? r1.getNewLineNumber() : Integer.MAX_VALUE);
            int r2StartPos = r2.getOldLineNumber() != -1 ? r2.getOldLineNumber() : (r2.getNewLineNumber() != -1 ? r2.getNewLineNumber() : Integer.MAX_VALUE);

            if (r1StartPos != r2StartPos) {
                return Integer.compare(r1StartPos, r2StartPos);
            }
            
            // 如果起始位置相同，进一步按 oldLineNumber 排序
            int r1OldLine = r1.getOldLineNumber() != -1 ? r1.getOldLineNumber() : Integer.MAX_VALUE;
            int r2OldLine = r2.getOldLineNumber() != -1 ? r2.getOldLineNumber() : Integer.MAX_VALUE;
            
            if (r1OldLine != r2OldLine) {
                 return Integer.compare(r1OldLine, r2OldLine);
            }

            // 如果 oldLineNumber 也相同，则按 newLineNumber 排序
            int r1NewLine = r1.getNewLineNumber() != -1 ? r1.getNewLineNumber() : Integer.MAX_VALUE;
            int r2NewLine = r2.getNewLineNumber() != -1 ? r2.getNewLineNumber() : Integer.MAX_VALUE;
            return Integer.compare(r1NewLine, r2NewLine);
        });

        // 重新计算行号，因为排序和MOVED处理可能导致行号不连续
        int currentOriginalLineNum = 1;
        int currentNewLineNum = 1;
        for (DiffRowDTO row : resultRows) {
            if ("EQUAL".equals(row.getTag()) || "CHANGE".equals(row.getTag()) || "MOVED".equals(row.getTag())) {
                // 对于相等、修改、移动的行，同时消耗两个流的行号
                row.setOldLineNumber(currentOriginalLineNum++);
                row.setNewLineNumber(currentNewLineNum++);
            } else if ("DELETE".equals(row.getTag())) {
                // 删除的行只消耗原始流的行号
                row.setOldLineNumber(currentOriginalLineNum++);
                row.setNewLineNumber(-1); // 目标无对应行
            } else if ("INSERT".equals(row.getTag())) {
                // 插入的行只消耗新流的行号
                row.setOldLineNumber(-1); // 源无对应行
                row.setNewLineNumber(currentNewLineNum++);
            }
        }
        
        return resultRows;
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