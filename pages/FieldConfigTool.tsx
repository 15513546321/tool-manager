import React, { useState, useEffect, useRef, useCallback } from 'react';

// 定义行数据类型
interface FieldRow {
    field: string;   // 字段名
    alias: string;   // 字段别名
    desc: string;    // 描述
}

export const FieldConfigTool: React.FC = () => {
    // 初始显示 4 行数据
    const [rows, setRows] = useState<FieldRow[]>([
        { field: '', alias: '', desc: '' },
        { field: '', alias: '', desc: '' },
        { field: '', alias: '', desc: '' }
    ]);

    // DOM Ref
    const leftPanelRef = useRef<HTMLDivElement>(null);
    const scrollTopBtnRef = useRef<HTMLButtonElement>(null);
    const scrollBottomBtnRef = useRef<HTMLButtonElement>(null);
    const tableBoxRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const copyTipRef = useRef<HTMLDivElement>(null);
    const xmlResRef = useRef<HTMLDivElement>(null);
    const javaResRef = useRef<HTMLDivElement>(null);

    // ====================== 核心工具方法 ======================
    // 保证最后一行永远是空行
    const keepEmptyRow = useCallback(() => {
        setRows(prev => {
            const last = prev[prev.length - 1];
            if (!last) return [{ field: '', alias: '', desc: '' }];
            // 最后一行非空，则新增空行
            if (last.field.trim() || last.alias.trim() || last.desc.trim()) {
                return [...prev, { field: '', alias: '', desc: '' }];
            }
            return prev;
        });
    }, []);

    // 更新滚动按钮显示隐藏
    const updateScrollButtons = useCallback(() => {
        const panel = leftPanelRef.current;
        const table = tableBoxRef.current;
        const topBtn = scrollTopBtnRef.current;
        const bottomBtn = scrollBottomBtnRef.current;
        if (!panel || !table || !topBtn || !bottomBtn) return;
        const show = table.scrollHeight > panel.clientHeight - 100;
        topBtn.style.display = show ? 'flex' : 'none';
        bottomBtn.style.display = show ? 'flex' : 'none';
    }, []);

    // 生成 XML 和 Java 代码
    const genCode = useCallback(() => {
        let xml = '';
        let java = '';
        rows.forEach(item => {
            const { field, alias, desc } = item;
            if (!field.trim()) return;
            xml += `<elementAlias name="${field}" alias="${alias}"/><!-- ${desc} -->\n`;
            java += `@ApiModelProperty(value = "${desc}")\nprivate String ${field};\n\n`;
        });

        if (xmlResRef.current) {
            xmlResRef.current.textContent = xml || '请填写左侧字段，代码将自动生成';
        }
        if (javaResRef.current) {
            javaResRef.current.textContent = java || '请填写左侧字段，代码将自动生成';
        }
    }, [rows]);

    // 数据变化自动生成代码
    useEffect(() => {
        genCode();
        // 布局变化更新滚动按钮
        setTimeout(updateScrollButtons, 0);
    }, [rows, genCode, updateScrollButtons]);

    // 初始化
    useEffect(() => {
        keepEmptyRow();
        updateScrollButtons();

        window.addEventListener('resize', updateScrollButtons);
        return () => window.removeEventListener('resize', updateScrollButtons);
    }, [keepEmptyRow, updateScrollButtons]);

    // ====================== tooltip 悬浮提示 ======================
    const showTooltip = (el: HTMLElement, text: string) => {
        const tip = tooltipRef.current;
        if (!tip) return;
        tip.textContent = text;
        const rect = el.getBoundingClientRect();
        tip.style.left = rect.left + rect.width / 2 - tip.offsetWidth / 2 + 'px';
        tip.style.top = rect.top - 30 + 'px';
        tip.classList.add('show');
    };

    const showTooltipLeft = (el: HTMLElement, text: string) => {
        const tip = tooltipRef.current;
        if (!tip) return;
        tip.textContent = text;
        const rect = el.getBoundingClientRect();
        tip.style.left = rect.left - tip.offsetWidth - 6 + 'px';
        tip.style.top = rect.top + rect.height / 2 - tip.offsetHeight / 2 + 'px';
        tip.classList.add('show');
    };

    const hideTooltip = () => {
        tooltipRef.current?.classList.remove('show');
    };

    // ====================== 行列高亮 ======================
    const highlightCol = (colIndex: number, isShow: boolean) => {
        const ths = document.querySelectorAll(`table th:nth-child(${colIndex + 1})`);
        const tds = document.querySelectorAll(`table tr td:nth-child(${colIndex + 1})`);
        ths.forEach(el => el.classList.toggle('highlight-col', isShow));
        tds.forEach(el => el.classList.toggle('highlight-col', isShow));
    };

    const highlightRow = (btn: HTMLElement, isShow: boolean) => {
        const tr = btn.closest('tr');
        if (tr) tr.classList.toggle('highlight-row', isShow);
    };

    const highlightAll = (isShow: boolean) => {
        const table = document.querySelector('table');
        if (table) table.classList.toggle('highlight-all', isShow);
    };

    // ====================== 表格操作 ======================
    // 新增空行
    const addRow = () => {
        setRows(prev => [...prev, { field: '', alias: '', desc: '' }]);
    };

    // 删除指定行
    const delRow = (index: number) => {
        setRows(prev => {
            if (prev.length <= 1) {
                // 只剩一行则清空
                return [{ field: '', alias: '', desc: '' }];
            }
            const newRows = prev.filter((_, idx) => idx !== index);
            return newRows;
        });
        setTimeout(keepEmptyRow, 0);
    };

    // 单行单元格输入变更
    const handleCellChange = (index: number, key: keyof FieldRow, value: string) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], [key]: value };
            return newRows;
        });
        setTimeout(keepEmptyRow, 0);
    };

    // 清空某一列
    const clearCol = (colKey: keyof FieldRow) => {
        setRows(prev => prev.map(item => ({ ...item, [colKey]: '' })));
    };

    // 清空所有
    const clearAll = () => {
        setRows([
            { field: '', alias: '', desc: '' },
            { field: '', alias: '', desc: '' },
            { field: '', alias: '', desc: '' },
            { field: '', alias: '', desc: '' }
        ]);
        if (xmlResRef.current) xmlResRef.current.textContent = '请填写左侧字段，代码将自动生成';
        if (javaResRef.current) javaResRef.current.textContent = '请填写左侧字段，代码将自动生成';
    };

    // 粘贴多行数据
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, colKey: keyof FieldRow) => {
        e.preventDefault();
        const clipText = e.clipboardData.getData('text');
        if (!clipText) return;

        const rowsData = clipText.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
        const grid = rowsData.map(r => r.split(/\t/).map(c => c.trim()));

        setRows(prev => {
            const newRows = [...prev];
            grid.forEach((rowCells, rIdx) => {
                const currRowIdx = rowIndex + rIdx;
                // 行不足则补空行
                while (newRows.length <= currRowIdx) {
                    newRows.push({ field: '', alias: '', desc: '' });
                }
                // 当前列开始赋值
                const colMap: (keyof FieldRow)[] = ['field', 'alias', 'desc'];
                rowCells.forEach((cellVal, cIdx) => {
                    const colIdx = colMap.findIndex(k => k === colKey);
                    const targetCol = colMap[colIdx + cIdx];
                    if (targetCol) {
                        newRows[currRowIdx][targetCol] = cellVal;
                    }
                });
            });
            return newRows;
        });
        setTimeout(keepEmptyRow, 0);
    };

    // ====================== 复制代码 ======================
    const showTip = (text: string) => {
        const tip = copyTipRef.current;
        if (!tip) return;
        tip.textContent = text;
        tip.classList.add('show');
        setTimeout(() => tip.classList.remove('show'), 1500);
    };

    const copyCode = async (ref: React.RefObject<HTMLDivElement>, type: 'XML' | 'Java') => {
        const dom = ref.current;
        if (!dom) return;
        const text = dom.textContent?.trim() || '';
        if (!text || text.includes('请填写左侧字段')) {
            showTip(`⚠️ 暂无${type}内容可复制`);
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            showTip(`✅ ${type} 复制成功`);
        } catch {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showTip(`✅ ${type} 复制成功`);
        }
    };

    // ====================== 滚动控制 ======================
    const scrollToPanelTop = () => {
        leftPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const scrollToPanelBottom = () => {
        const panel = leftPanelRef.current;
        if (panel) panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
    };

    // 列key映射
    const colKeyList: (keyof FieldRow)[] = ['field', 'alias', 'desc'];

    return (
        <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <style>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family: 'Microsoft YaHei', sans-serif;}
        .container{width:100%;height:100%;display:flex;flex-direction:column;}
        .title{text-align:center;padding:16px 0;color:#2d3748;font-size:20px;font-weight:600;background:#fff;border-bottom:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,0.05);}
        .main{display:flex;flex:1;overflow:hidden;}
        .panel{width:600px;background:#fff;padding:20px;overflow-y:auto;border-right:1px solid #e2e8f0;position:relative;}
        .scroll-to-top,.scroll-to-bottom{position:sticky;right:24px;margin-left:auto;width:44px;height:44px;border-radius:50%;background:#1d4ed8;color:#fff;display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 16px rgba(29,78,216,0.35);z-index:999;transition:all 0.2s ease;border:none;}
        .scroll-to-top{top:24px;margin-bottom:10px;}
        .scroll-to-bottom{bottom:24px;}
        .scroll-to-top:hover,.scroll-to-bottom:hover{background:#1e40af;transform:scale(1.1);box-shadow:0 8px 20px rgba(29,78,216,0.45);}
        .scroll-icon-top{width:10px;height:10px;border-right:2px solid #fff;border-top:2px solid #fff;transform:rotate(-45deg);transition:all 0.2s;}
        .scroll-to-top:hover .scroll-icon-top{transform:rotate(-45deg) translateY(-2px);}
        .scroll-icon-bottom{width:10px;height:10px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg);transition:all 0.2s;}
        .scroll-to-bottom:hover .scroll-icon-bottom{transform:rotate(45deg) translateY(2px);}
        .tooltip{position:absolute;background:#1f2937;color:#fff;padding:5px 10px;border-radius:4px;font-size:12px;white-space:nowrap;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.2s;}
        .tooltip.show{opacity:1;}
        .btns{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;position:relative;}
        .btn{padding:10px 20px;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:14px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 4px rgba(0,0,0,0.1);transition:all 0.2s ease;position:relative;}
        /* 主按钮改为 #2563EB */
        .btn-primary{background:#2563EB;}
        .btn-primary:hover{background:#1d4ed8;transform:translateY(-1px);}
        .btn-danger{background:#dc2626;}
        .btn-danger:hover{background:#b91c1c;transform:translateY(-1px);}
        .auto-tip{color:#38a169;font-size:14px;padding:10px 15px;background:#f0fff4;border-radius:6px;display:none;border:1px solid #c6f6d5;text-align:center;margin-bottom:20px;}
        .table-box{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:8px;box-shadow:0 2px 4px rgba(0,0,0,0.05);}
        .add-row-tip{text-align:center;color:#64748b;font-size:13px;padding:8px 0 16px 0;}
        table{width:100%;border-collapse:collapse;}
        th{background:#f8f9fa;padding:12px 10px;font-weight:600;color:#2d3748;font-size:14px;text-align:center;border-right:1px solid #e2e8f0;border-bottom:2px solid #e2e8f0;white-space:nowrap;position:relative;}
        th:last-child{border-right:none;}
        .clear-col-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:none;background:transparent;color:#e53e3e;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s ease;}
        .clear-col-btn:hover{transform:translateY(-50%) scale(1.1);}
        .clear-col-btn::after{content:"清空本列";position:absolute;top:28px;left:50%;transform:translateX(-50%);background:#1f2937;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity 0.2s;z-index:999;}
        td{padding:10px;text-align:center;background:#fff;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;}
        td:last-child{border-right:none;}
        tr:nth-child(even) td{background:#f8f9fa;}
        td input{width:100%;padding:8px 10px;border:1px solid #cbd5e0;border-radius:4px;outline:none;font-size:14px;transition:all 0.2s ease;}
        td input:focus{border-color:#2563EB;box-shadow:0 0 0 2px rgba(37,99,235,0.2);}
        td input::placeholder{color:#a0aec0;font-size:13px;font-style:italic;}
        tr.highlight-row td, td.highlight-col, th.highlight-col, .highlight-all td, .highlight-all th{background:#fff5f5 !important;box-shadow:inset 0 0 0 1px #fc8181 !important;}
        .del-row-btn{width:30px;height:30px;border:none;border-radius:4px;background:transparent;color:#e53e3e;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center;position:relative;transition:all 0.2s ease;}
        .del-row-btn:hover{transform:scale(1.1);background:#fff5f5;}
        .tips{padding:15px;background:#f8f9fa;border-radius:8px;color:#4a5568;font-size:14px;line-height:1.8;border:1px solid #e2e8f0;margin-bottom:20px;}
        .tips strong{font-size:15px;color:#2d3748;margin-bottom:8px;display:block;}
        .tips p{margin:4px 0;display:flex;align-items:center;}
        .tips span{color:#2563EB;font-weight:600;margin-right:8px;font-size:14px;width:20px;text-align:center;}
        .code-wrap{flex:1;display:flex;flex-direction:column;gap:15px;padding:20px;height:100%;overflow:hidden;background:#f5f7fa;}
        .code-card{height:calc(50% - 7.5px);background:#fff;padding:15px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.05);display:flex;flex-direction:column;overflow:hidden;}
        .code-card h4{margin-bottom:10px;color:#2d3748;font-size:15px;font-weight:600;flex-shrink:0;}
        .code-box{flex:1;width:100%;padding:15px;border:1px solid #e2e8f0;border-radius:6px;background:#f8f9fa;font-family:Consolas,monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;overflow:auto;color:#2d3748;}
        .copy-btn{margin-top:10px;flex-shrink:0;width:fit-content;position:relative;overflow:hidden;}
        .copy-tip{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#38a169;color:#fff;padding:8px 16px;border-radius:4px;font-size:14px;z-index:9999;opacity:0;transition:all 0.3s ease;box-shadow:0 2px 8px rgba(0,0,0,0.15);}
        .copy-tip.show{opacity:1;top:30px;}
      `}</style>

            <h2 className="title">⚙️ 字段配置 → XML & Java 自动生成工具</h2>
            <div className="main">
                <div className="panel" ref={leftPanelRef}>
                    <button className="scroll-to-top" ref={scrollTopBtnRef} onClick={scrollToPanelTop}
                            onMouseEnter={(e) => showTooltip(e.currentTarget, '点击跳转到第一行')}
                            onMouseLeave={hideTooltip}>
                        <div className="scroll-icon-top"></div>
                    </button>

                    <div className="btns">
                        <button className="btn btn-primary" onClick={addRow}
                                onMouseEnter={(e) => showTooltip(e.currentTarget, '内容粘贴后会自动新增一行')}
                                onMouseLeave={hideTooltip}>✨ 新增一行</button>
                        <button className="btn btn-primary" onClick={genCode}
                                onMouseEnter={(e) => showTooltip(e.currentTarget, '内容粘贴后会自动生成代码')}
                                onMouseLeave={hideTooltip}>🚀 生成代码</button>
                        <button className="btn btn-danger" onClick={clearAll}
                                onMouseEnter={(e) => showTooltip(e.currentTarget, '重置表格内容')}
                                onMouseLeave={hideTooltip}
                                onMouseOver={() => highlightAll(true)}
                                onMouseOut={() => highlightAll(false)}>🧹 清空所有内容</button>
                    </div>

                    <div className="table-box" ref={tableBoxRef}>
                        <table>
                            <thead>
                            <tr>
                                <th>字段名称
                                    <button className="clear-col-btn"
                                            onMouseOver={() => highlightCol(0, true)}
                                            onMouseOut={() => highlightCol(0, false)}
                                            onClick={() => clearCol('field')}>🗑️</button>
                                </th>
                                <th>字段别名
                                    <button className="clear-col-btn"
                                            onMouseOver={() => highlightCol(1, true)}
                                            onMouseOut={() => highlightCol(1, false)}
                                            onClick={() => clearCol('alias')}>🗑️</button>
                                </th>
                                <th>描述
                                    <button className="clear-col-btn"
                                            onMouseOver={() => highlightCol(2, true)}
                                            onMouseOut={() => highlightCol(2, false)}
                                            onClick={() => clearCol('desc')}>🗑️</button>
                                </th>
                                <th>操作</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                    {colKeyList.map((colKey, colIdx) => (
                                        <td key={colKey}>
                                            <input
                                                type="text"
                                                placeholder={
                                                    colKey === 'field' ? '例：userName' :
                                                        colKey === 'alias' ? '例：USERNAME' : '例：用户登录账号'
                                                }
                                                value={row[colKey]}
                                                onChange={(e) => handleCellChange(rowIdx, colKey, e.target.value)}
                                                onPaste={(e) => handlePaste(e, rowIdx, colKey)}
                                            />
                                        </td>
                                    ))}
                                    <td>
                                        <button className="del-row-btn"
                                                onMouseOver={(e) => highlightRow(e.currentTarget, true)}
                                                onMouseOut={(e) => highlightRow(e.currentTarget, false)}
                                                onClick={() => delRow(rowIdx)}
                                                onMouseEnter={(e) => showTooltipLeft(e.currentTarget, '删除此行')}
                                                onMouseLeave={hideTooltip}>❌</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 新增：表格下方提示用户可以继续新增 */}
                    <div className="add-row-tip">
                        💡 可点击「✨ 新增一行」按钮，继续添加更多字段
                    </div>

                    <div className="tips">
                        <strong>📋 使用说明</strong>
                        <p><span>📌</span> 粘贴一整列 → 点击该列首行粘贴</p>
                        <p><span>📌</span> 粘贴多行多列 → 点击左上角单元格粘贴</p>
                        <p><span>🗑️</span> 清空本列 → 鼠标悬浮可预览，点击清空</p>
                        <p><span>❌</span> 删除当前行 → 鼠标悬浮可预览，点击删除</p>
                        <p><span>🧹</span> 清空所有数据 → 点击顶部清空所有按钮</p>
                        <p><span>✅</span> 自动生成 → 填写完成自动生成XML/Java代码</p>
                        <p><span>⬆️</span> 蓝色上箭头 → 点击快速跳转到第一行</p>
                        <p><span>⬇️</span> 蓝色下箭头 → 点击快速跳转到最后一行</p>
                    </div>

                    <button className="scroll-to-bottom" ref={scrollBottomBtnRef} onClick={scrollToPanelBottom}
                            onMouseEnter={(e) => showTooltip(e.currentTarget, '点击跳转到最后一行')}
                            onMouseLeave={hideTooltip}>
                        <div className="scroll-icon-bottom"></div>
                    </button>
                </div>

                <div className="code-wrap">
                    <div className="code-card">
                        <h4>📄 XML 报文</h4>
                        <div className="code-box" ref={xmlResRef}>请填写左侧字段，代码将自动生成</div>
                        <button className="btn btn-primary copy-btn" onClick={() => copyCode(xmlResRef, 'XML')}>📋 复制XML</button>
                    </div>
                    <div className="code-card">
                        <h4>☕ Java 实体代码</h4>
                        <div className="code-box" ref={javaResRef}>请填写左侧字段，代码将自动生成</div>
                        <button className="btn btn-primary copy-btn" onClick={() => copyCode(javaResRef, 'Java')}>📋 复制Java</button>
                    </div>
                </div>
            </div>

            <div className="tooltip" ref={tooltipRef}></div>
            <div className="copy-tip" ref={copyTipRef}></div>
        </div>
    );
};