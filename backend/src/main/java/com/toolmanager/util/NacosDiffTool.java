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
        List<DiffRowDTO> processedDiffRows = new ArrayList<>();
        Map<String, List<Integer>> deletedLinesMap = new HashMap<>(); // content -> list of indices in initialDiffRows
        Map<String, List<Integer>> insertedLinesMap = new HashMap<>(); // content -> list of indices in initialDiffRows

        // 第一次遍历：收集所有 DELETE 和 INSERT 行
        for (int i = 0; i < initialDiffRows.size(); i++) {
            DiffRowDTO row = initialDiffRows.get(i);
            if ("DELETE".equals(row.getTag())) {
                deletedLinesMap.computeIfAbsent(row.getOldLine(), k -> new ArrayList<>()).add(i);
            } else if ("INSERT".equals(row.getTag())) {
                insertedLinesMap.computeIfAbsent(row.getNewLine(), k -> new ArrayList<>()).add(i);
            }
        }

        // 第二次遍历：尝试匹配 DELETE 和 INSERT 为 MOVED
        Set<Integer> handledIndices = new HashSet<>(); // 记录已被处理的行索引

        for (int i = 0; i < initialDiffRows.size(); i++) {
            if (handledIndices.contains(i)) {
                continue;
            }

            DiffRowDTO currentRow = initialDiffRows.get(i);

            if ("DELETE".equals(currentRow.getTag())) {
                String content = currentRow.getOldLine();
                List<Integer> matchingInserts = insertedLinesMap.get(content);

                if (matchingInserts != null && !matchingInserts.isEmpty()) {
                    // 找到一个匹配的 INSERT
                    int insertIndex = matchingInserts.remove(0); // 取出第一个匹配项
                    
                    // 确保这个 INSERT 还没有被其他 DELETE 匹配
                    if (!handledIndices.contains(insertIndex)) {
                        DiffRowDTO insertRow = initialDiffRows.get(insertIndex);

                        // 创建一个新的 MOVED 行
                        DiffRowDTO movedRow = new DiffRowDTO();
                        movedRow.setTag("MOVED");
                        movedRow.setOldLine(currentRow.getOldLine());
                        movedRow.setNewLine(insertRow.getNewLine());
                        movedRow.setOldLineNumber(currentRow.getOldLineNumber());
                        movedRow.setNewLineNumber(insertRow.getNewLineNumber());
                        
                        // 将 MOVED 行添加到最终列表
                        // 这里可以根据需要决定 MOVED 行的插入位置，
                        // 为了保持 diff 顺序，我们可能需要先收集所有 MOVED 行，然后重新排序
                        // 或者更简单的，直接将原来的 DELETE/INSERT 替换为 MOVED
                        // 对于BeyondCompare风格，通常是将MOVED行作为单独的类别，不直接替代原位置
                        // 但为了简化前端展示和保持行号对应，这里将其替换原始DELETE/INSERT
                        // 实际显示时，MOVED行在界面上可能需要特殊渲染
                        processedDiffRows.add(movedRow);
                        
                        // 标记这两个行已被处理
                        handledIndices.add(i);
                        handledIndices.add(insertIndex);
                        
                        continue; // 继续下一个未处理的行
                    }
                }
            } else if ("INSERT".equals(currentRow.getTag())) {
                 // 如果 INSERT 行在前面的 DELETE 匹配中已经被处理，则跳过
                 if (handledIndices.contains(i)) {
                     continue;
                 }
                 // 如果 INSERT 行没有被匹配为 MOVED，则它是一个真正的 INSERT
                 // 此时将其添加到 processedDiffRows (或者在下面的循环中统一添加未处理的行)
            }
            // 如果是 EQUAL, CHANGE, 或者未匹配的 DELETE/INSERT，暂时不处理
            // 它们将在下面的循环中统一添加
        }

        // 重新构建最终的差异行列表，将所有未处理的行以及识别出的 MOVED 行按原始顺序合并
        List<DiffRowDTO> finalDiffRows = new ArrayList<>();
        List<DiffRowDTO> movedRowsCollector = new ArrayList<>(); // 收集所有MOVED行

        for (int i = 0; i < initialDiffRows.size(); i++) {
            if (handledIndices.contains(i)) {
                DiffRowDTO row = initialDiffRows.get(i);
                if ("DELETE".equals(row.getTag())) { // 之前被标记为 DELETE 但实际上是 MOVED 的上半部分
                    // 找到对应的 MOVED 行
                    Optional<DiffRowDTO> movedMatch = processedDiffRows.stream()
                        .filter(mr -> "MOVED".equals(mr.getTag()) && mr.getOldLineNumber() == row.getOldLineNumber())
                        .findFirst();
                    movedMatch.ifPresent(movedRowsCollector::add);
                } else if ("INSERT".equals(row.getTag())) { // 之前被标记为 INSERT 但实际上是 MOVED 的下半部分
                    // 确保不重复添加，因为 movedRowsCollector 已经在 DELETE 处添加了一次
                } else {
                     finalDiffRows.add(initialDiffRows.get(i)); // Add EQUAL or CHANGE rows directly
                }
            } else {
                finalDiffRows.add(initialDiffRows.get(i)); // Add all unhandled rows
            }
        }
        
        // 合并 MOVED 行到最终列表，MOVED 行通常会显示在原 DELETE/INSERT 的位置
        // 为了简单起见，这里将 MOVED 行插入到它最接近的 DELETE 或 INSERT 原始位置，并移除原DELETE/INSERT
        // 实际上，更复杂的 diff 工具会智能地将 MOVED 放在中间或者作为特殊标记
        // 这里我们选择将 DELETE/INSERT 替换为 MOVED，这样统计数据会更准确
        
        List<DiffRowDTO> resultRows = new ArrayList<>();
        // 用来存储待处理的 DELETE/INSERT 行的索引，以便进行 MOVED 检测
        List<Integer> deleteIndices = new ArrayList<>();
        List<Integer> insertIndices = new ArrayList<>();

        for (int idx = 0; idx < initialDiffRows.size(); idx++) {
            DiffRowDTO row = initialDiffRows.get(idx);
            if ("DELETE".equals(row.getTag())) {
                deleteIndices.add(idx);
            } else if ("INSERT".equals(row.getTag())) {
                insertIndices.add(idx);
            } else {
                // 对于非 DELETE/INSERT 行，直接添加到结果
                resultRows.add(row);
            }
        }

        // 尝试将 DELETE 和 INSERT 匹配为 MOVED
        for (int i = 0; i < deleteIndices.size(); i++) {
            int deleteIdx = deleteIndices.get(i);
            DiffRowDTO deleteRow = initialDiffRows.get(deleteIdx);
            
            for (int j = 0; j < insertIndices.size(); j++) {
                int insertIdx = insertIndices.get(j);
                DiffRowDTO insertRow = initialDiffRows.get(insertIdx);
                
                // 如果内容相同，则认为是 MOVED
                if (deleteRow.getOldLine().equals(insertRow.getNewLine())) {
                    DiffRowDTO movedRow = new DiffRowDTO();
                    movedRow.setTag("MOVED");
                    movedRow.setOldLine(deleteRow.getOldLine());
                    movedRow.setNewLine(insertRow.getNewLine());
                    movedRow.setOldLineNumber(deleteRow.getOldLineNumber());
                    movedRow.setNewLineNumber(insertRow.getNewLineNumber());
                    
                    // 将 MOVED 行添加到结果，并移除已匹配的 DELETE 和 INSERT
                    // 这里的插入位置需要考虑。为了保持接近原始位置，我们可以插入到原始 DELETE 的位置
                    // 但是，直接替换原始 DELETE 和 INSERT 会导致行数变化，这不是我们想要的
                    // 最好的方法是先收集所有差异，再统一处理
                    // 暂时将 movedRow 标记，并将其添加到最终列表，但原 DELETE/INSERT 要被移除
                    
                    // 标记这些索引已经被处理
                    initialDiffRows.set(deleteIdx, null); // 标记为已处理
                    initialDiffRows.set(insertIdx, null); // 标记为已处理
                    
                    resultRows.add(movedRow);
                    break; // 找到一个匹配，继续下一个 DELETE
                }
            }
        }

        // 将所有非null的原始行添加回来（未被MOVED处理的DELETE/INSERT）
        for (DiffRowDTO row : initialDiffRows) {
            if (row != null && !"MOVED".equals(row.getTag())) { // 排除已经添加到resultRows的MOVED行
                resultRows.add(row);
            }
        }
        
        // 最终的 diffRows 列表需要按行号排序，或者按原始 diff 的顺序
        // 这里简单地将所有 MOVED 行添加到所有其他行的后面，这可能不是最佳视觉效果，但确保逻辑正确
        // 更好的做法是，MOVED行替换掉对应的DELETE和INSERT位置
        List<DiffRowDTO> finalResult = new ArrayList<>();
        List<DiffRowDTO> unhandledDeletes = new ArrayList<>();
        List<DiffRowDTO> unhandledInserts = new ArrayList<>();
        
        // 先收集所有 EQUAL, CHANGE
        for(DiffRowDTO row : initialDiffRows) {
            if(row != null && ("EQUAL".equals(row.getTag()) || "CHANGE".equals(row.getTag()))) {
                finalResult.add(row);
            } else if (row != null && "DELETE".equals(row.getTag())) {
                unhandledDeletes.add(row);
            } else if (row != null && "INSERT".equals(row.getTag())) {
                unhandledInserts.add(row);
            }
        }
        
        // 尝试匹配 unhandledDeletes 和 unhandledInserts
        List<DiffRowDTO> tempMoved = new ArrayList<>();
        Set<DiffRowDTO> usedDeletes = new HashSet<>();
        Set<DiffRowDTO> usedInserts = new HashSet<>();

        for (DiffRowDTO deleteRow : unhandledDeletes) {
            for (DiffRowDTO insertRow : unhandledInserts) {
                if (!usedInserts.contains(insertRow) && deleteRow.getOldLine().equals(insertRow.getNewLine())) {
                    DiffRowDTO movedRow = new DiffRowDTO();
                    movedRow.setTag("MOVED");
                    movedRow.setOldLine(deleteRow.getOldLine());
                    movedRow.setNewLine(insertRow.getNewLine());
                    movedRow.setOldLineNumber(deleteRow.getOldLineNumber());
                    movedRow.setNewLineNumber(insertRow.getNewLineNumber());
                    tempMoved.add(movedRow);
                    usedDeletes.add(deleteRow);
                    usedInserts.add(insertRow);
                    break;
                }
            }
        }
        
        // 添加未匹配的 DELETE 和 INSERT
        for (DiffRowDTO deleteRow : unhandledDeletes) {
            if (!usedDeletes.contains(deleteRow)) {
                finalResult.add(deleteRow);
            }
        }
        for (DiffRowDTO insertRow : unhandledInserts) {
            if (!usedInserts.contains(insertRow)) {
                finalResult.add(insertRow);
            }
        }
        
        // 将 MOVED 行添加到结果列表
        finalResult.addAll(tempMoved);

        // 重新排序（可选，但通常有助于显示）
        // 这里的排序逻辑需要确保：
        // 1. 原始行号小的在前
        // 2. 对于 DELETE/INSERT/MOVED 混合的情况，保持它们的相对顺序
        // 暂时不进行复杂排序，依赖原始 diff 的顺序
        
        // 重新计算行号，因为现在可能存在 MOVED 行
        int currentOriginalLineNum = 1;
        int currentNewLineNum = 1;
        for (DiffRowDTO row : finalResult) {
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
        
        return finalResult;
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