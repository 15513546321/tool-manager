package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 单行差异信息
 * 对应Beyond Compare的差异行展示
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DiffRowDTO {
    /**
     * 差异行标签: EQUAL(相等), INSERT(新增), DELETE(删除), CHANGE(修改), MOVED(移动)
     */
    private String tag;
    
    /**
     * 原始行（左侧源环境）
     */
    private String oldLine;
    
    /**
     * 新行（右侧目标环境）
     */
    private String newLine;
    
    /**
     * 原始行号（源环境中的行号，从1开始）
     */
    private int oldLineNumber;
    
    /**
     * 新行号（目标环境中的行号，从1开始）
     */
    private int newLineNumber;
}
