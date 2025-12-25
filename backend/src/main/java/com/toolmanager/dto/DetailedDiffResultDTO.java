package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * 详细差异对比结果
 * 包含所有行级差异，用于前端展示
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DetailedDiffResultDTO {
    /**
     * 配置ID
     */
    private String dataId;
    
    /**
     * 配置分组
     */
    private String group;
    
    /**
     * 差异行列表（按顺序）
     */
    private List<DiffRowDTO> diffRows;
    
    /**
     * 总行数（两个版本中较多的行数）
     */
    private int totalLines;
    
    /**
     * 差异行数
     */
    private int changedLines;
    
    /**
     * 新增行数
     */
    private int insertedLines;
    
    /**
     * 删除行数
     */
    private int deletedLines;

    /**
     * 移动行数
     */
    private int movedLines;
    
    /**
     * 状态: 'same' | 'different' | 'source-only' | 'target-only'
     */
    private String status;
}
