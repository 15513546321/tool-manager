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
     * @return 详细的差异结果
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
            return result;
        }

        // 检查只在源环境或只在目标环境
        if (original.isEmpty()) {
            result.setStatus("target-only");
            result.setDiffRows(generateTargetOnlyRows(revised));
            result.setTotalLines(result.getDiffRows().size());
            return result;
        }

        if (revised.isEmpty()) {
            result.setStatus("source-only");
            result.setDiffRows(generateSourceOnlyRows(original));
            result.setTotalLines(result.getDiffRows().size());
            return result;
        }

        // 两个都有内容，进行详细对比（仅显示差异）
        List<DiffRowDTO> diffRows = computeDifferencesWithSmartMatching(original, revised);
        
        // 关键优化：如果经过全局匹配后没有差异行，说明两个配置内容完全相同（即使顺序不同）
        if (diffRows.isEmpty()) {
            result.setStatus("same");
            result.setDiffRows(new ArrayList<>());
            result.setTotalLines(0);
            result.setChangedLines(0);
            result.setInsertedLines(0);
            result.setDeletedLines(0);
            return result;
        }
        
        result.setStatus("different");
        result.setDiffRows(diffRows);

        // 统计信息
        int totalDiffLines = diffRows.size();
        int changedLines = (int) diffRows.stream().filter(r -> "CHANGE".equals(r.getTag())).count();
        int insertedLines = (int) diffRows.stream().filter(r -> "INSERT".equals(r.getTag())).count();
        int deletedLines = (int) diffRows.stream().filter(r -> "DELETE".equals(r.getTag())).count();

        result.setTotalLines(totalDiffLines);
        result.setChangedLines(changedLines);
        result.setInsertedLines(insertedLines);
        result.setDeletedLines(deletedLines);

        return result;
    }

    /**
     * 计算详细的行级差异 - 使用改进的匹配算法处理交叉配置块
     * 关键优化：先进行全局行匹配（不考虑顺序），再处理实际的插入/删除
     */
    private static List<DiffRowDTO> computeDifferencesWithSmartMatching(String original, String revised) {
        String[] originalLines = original.split("\n", -1);
        String[] revisedLines = revised.split("\n", -1);

        // 第一步：构建所有可能的行匹配关系（不考虑顺序）
        // 这样可以识别交叉配置块中的相同行
        Set<Integer> matchedOriginalLines = new HashSet<>();
        Set<Integer> matchedRevisedLines = new HashSet<>();
        
        // 贪心匹配：找出所有相同的行对（优先处理唯一性强的行）
        performGlobalLineMatching(originalLines, revisedLines, matchedOriginalLines, matchedRevisedLines);

        // 第二步：构建差异行列表 - 只包含不在匹配集合中的行
        List<DiffRowDTO> diffRows = new ArrayList<>();
        
        // 添加源环境中未匹配的行（删除行）
        for (int i = 0; i < originalLines.length; i++) {
            if (!matchedOriginalLines.contains(i)) {
                DiffRowDTO row = new DiffRowDTO();
                row.setTag("DELETE");
                row.setOldLine(originalLines[i]);
                row.setNewLine("");
                row.setOldLineNumber(i + 1);
                row.setNewLineNumber(-1);
                diffRows.add(row);
            }
        }
        
        // 添加目标环境中未匹配的行（插入行）
        for (int i = 0; i < revisedLines.length; i++) {
            if (!matchedRevisedLines.contains(i)) {
                DiffRowDTO row = new DiffRowDTO();
                row.setTag("INSERT");
                row.setOldLine("");
                row.setNewLine(revisedLines[i]);
                row.setOldLineNumber(-1);
                row.setNewLineNumber(i + 1);
                diffRows.add(row);
            }
        }

        return diffRows;
    }

    /**
     * 全局行匹配 - 找出所有相同的行（不考虑顺序）
     * 这个方法处理交叉配置块的关键在于：
     * 1. 首先识别完全相同的行
     * 2. 使用贪心算法进行一对一匹配
     * 3. 避免重复匹配
     */
    private static void performGlobalLineMatching(String[] original, String[] revised,
                                                   Set<Integer> matchedOriginal, 
                                                   Set<Integer> matchedRevised) {
        // 统计每行的出现频率
        Map<String, Integer> originalFreq = new HashMap<>();
        Map<String, Integer> revisedFreq = new HashMap<>();
        
        for (String line : original) {
            originalFreq.put(line, originalFreq.getOrDefault(line, 0) + 1);
        }
        
        for (String line : revised) {
            revisedFreq.put(line, revisedFreq.getOrDefault(line, 0) + 1);
        }

        // 第一阶段：处理出现频率相同且都只出现一次或少数次的行
        // 优先级：频率越低，优先级越高（唯一行最优先）
        for (String line : originalFreq.keySet()) {
            if (!revisedFreq.containsKey(line)) continue;
            
            int origCount = originalFreq.get(line);
            int revCount = revisedFreq.get(line);
            int matchCount = Math.min(origCount, revCount);
            
            // 找出这行在original中的所有位置
            List<Integer> origIndices = new ArrayList<>();
            for (int i = 0; i < original.length; i++) {
                if (original[i].equals(line) && !matchedOriginal.contains(i)) {
                    origIndices.add(i);
                }
            }
            
            // 找出这行在revised中的所有位置
            List<Integer> revIndices = new ArrayList<>();
            for (int i = 0; i < revised.length; i++) {
                if (revised[i].equals(line) && !matchedRevised.contains(i)) {
                    revIndices.add(i);
                }
            }
            
            // 进行一对一匹配（贪心策略：按顺序匹配）
            int matches = Math.min(origIndices.size(), revIndices.size());
            for (int k = 0; k < matches; k++) {
                matchedOriginal.add(origIndices.get(k));
                matchedRevised.add(revIndices.get(k));
            }
        }
    }

    /**
     * 计算最长公共子序列 (LCS) - 使用动态规划算法
     * 返回LCS中对应的原始数组下标对列表
     * 这个算法可以正确识别配置文件中不同位置但内容相同的行
     */
    private static List<int[]> computeLCS(String[] original, String[] revised) {
        int m = original.length;
        int n = revised.length;
        
        // dp[i][j] 表示 original[0...i-1] 和 revised[0...j-1] 的LCS长度
        int[][] dp = new int[m + 1][n + 1];
        
        // 填充dp表
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (original[i - 1].equals(revised[j - 1])) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        // 回溯找出LCS的下标对
        List<int[]> result = new ArrayList<>();
        int i = m;
        int j = n;
        
        while (i > 0 && j > 0) {
            if (original[i - 1].equals(revised[j - 1])) {
                result.add(0, new int[]{i - 1, j - 1});
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
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
            if ("INSERT".equals(row.getTag()) || "CHANGE".equals(row.getTag())) {
                // 这些是需要同步到目标的内容
                if ("INSERT".equals(row.getTag())) {
                    sb.append(row.getNewLine()).append("\n");
                    hasChanges = true;
                } else if ("CHANGE".equals(row.getTag())) {
                    sb.append(row.getNewLine()).append("\n");
                    hasChanges = true;
                }
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
