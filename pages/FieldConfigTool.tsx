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
        const ths = document.querySelectorAll(`.field-config-page table th:nth-child(${colIndex + 1})`);
        const tds = document.querySelectorAll(`.field-config-page table tr td:nth-child(${colIndex + 1})`);
        ths.forEach(el => el.classList.toggle('highlight-col', isShow));
        tds.forEach(el => el.classList.toggle('highlight-col', isShow));
    };

    const highlightRow = (btn: HTMLElement, isShow: boolean) => {
        const tr = btn.closest('tr');
        if (tr) tr.classList.toggle('highlight-row', isShow);
    };

    const highlightAll = (isShow: boolean) => {
        const table = document.querySelector('.field-config-page table');
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
            showTip(`暂无${type}内容可复制`);
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            showTip(`${type} 复制成功`);
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
            showTip(`${type} 复制成功`);
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
        <div className="field-config-page" style={{ width: '100%', minHeight: 'calc(100vh - 7rem)', display: 'flex', flexDirection: 'column' }}>
            <style>{`
        .field-config-page{padding:24px 32px;color:#172554;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .field-config-page .title{text-align:left;padding:0 0 18px;color:#172554;font-size:24px;font-weight:700;background:transparent;border:none;box-shadow:none;}
        .field-config-page .main{display:flex;flex:1;gap:18px;overflow:hidden;}
        .field-config-page .panel{width:600px;background:rgba(255,255,255,0.96);padding:18px;overflow-y:auto;border:1px solid #d7e4f6;border-radius:8px;position:relative;box-shadow:0 10px 28px rgba(30,64,175,0.07);}
        .field-config-page .scroll-to-top,.field-config-page .scroll-to-bottom{position:sticky;right:18px;margin-left:auto;width:36px;height:36px;border-radius:8px;background:#1d4ed8;color:#fff;display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 18px rgba(29,78,216,0.2);z-index:9;transition:all 0.2s ease;border:none;}
        .field-config-page .scroll-to-top{top:12px;margin-bottom:10px;}
        .field-config-page .scroll-to-bottom{bottom:12px;}
        .field-config-page .scroll-to-top:hover,.field-config-page .scroll-to-bottom:hover{background:#1e40af;}
        .field-config-page .scroll-icon-top{width:9px;height:9px;border-right:2px solid #fff;border-top:2px solid #fff;transform:rotate(-45deg);}
        .field-config-page .scroll-icon-bottom{width:9px;height:9px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg);}
        .field-config-page .tooltip{position:absolute;background:#172554;color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;white-space:nowrap;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.2s;}
        .field-config-page .tooltip.show{opacity:1;}
        .field-config-page .btns{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;position:relative;}
        .field-config-page .btn{padding:9px 16px;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 8px 18px rgba(30,64,175,0.1);transition:all 0.2s ease;position:relative;}
        .field-config-page .btn-primary{background:#1d4ed8;}
        .field-config-page .btn-primary:hover{background:#1e40af;}
        .field-config-page .btn-danger{background:#dc2626;}
        .field-config-page .btn-danger:hover{background:#b91c1c;}
        .field-config-page .table-box{border:1px solid #d7e4f6;border-radius:8px;overflow:hidden;margin-bottom:8px;background:#fff;}
        .field-config-page .add-row-tip{text-align:left;color:#64748b;font-size:13px;padding:8px 0 16px;}
        .field-config-page table{width:100%;border-collapse:collapse;}
        .field-config-page th{background:#edf4ff;padding:12px 10px;font-weight:700;color:#172554;font-size:13px;text-align:center;border-right:1px solid #d7e4f6;border-bottom:1px solid #d7e4f6;white-space:nowrap;position:relative;}
        .field-config-page th:last-child{border-right:none;}
        .field-config-page .clear-col-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);height:24px;border:none;background:transparent;color:#dc2626;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s ease;}
        .field-config-page .clear-col-btn:hover{color:#991b1b;}
        .field-config-page .clear-col-btn::after{content:"清空本列";position:absolute;top:28px;left:50%;transform:translateX(-50%);background:#172554;color:#fff;padding:4px 8px;border-radius:6px;font-size:12px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity 0.2s;z-index:999;}
        .field-config-page .clear-col-btn:hover::after{opacity:1;}
        .field-config-page td{padding:10px;text-align:center;background:#fff;border-right:1px solid #e6effc;border-bottom:1px solid #e6effc;}
        .field-config-page td:last-child{border-right:none;}
        .field-config-page tr:nth-child(even) td{background:#f8fbff;}
        .field-config-page td input{width:100%;padding:8px 10px;border:1px solid #cfe0f6;border-radius:6px;outline:none;font-size:14px;transition:all 0.2s ease;background:#fff;}
        .field-config-page td input:focus{border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(29,78,216,0.12);}
        .field-config-page td input::placeholder{color:#94a3b8;font-size:13px;}
        .field-config-page tr.highlight-row td,.field-config-page td.highlight-col,.field-config-page th.highlight-col,.field-config-page .highlight-all td,.field-config-page .highlight-all th{background:#fff7ed !important;box-shadow:inset 0 0 0 1px #f59e0b !important;}
        .field-config-page .del-row-btn{width:30px;height:30px;border:none;border-radius:6px;background:transparent;color:#dc2626;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;justify-content:center;position:relative;transition:all 0.2s ease;}
        .field-config-page .del-row-btn:hover{background:#fef2f2;}
        .field-config-page .tips{padding:14px;background:#f8fbff;border-radius:8px;color:#475569;font-size:13px;line-height:1.8;border:1px solid #d7e4f6;margin-bottom:20px;}
        .field-config-page .tips strong{font-size:14px;color:#172554;margin-bottom:8px;display:block;}
        .field-config-page .tips p{margin:4px 0;display:flex;align-items:center;}
        .field-config-page .tips span{color:#1d4ed8;font-weight:700;margin-right:8px;font-size:12px;width:18px;text-align:center;}
        .field-config-page .code-wrap{flex:1;display:flex;flex-direction:column;gap:18px;height:100%;overflow:hidden;}
        .field-config-page .code-card{height:calc(50% - 9px);background:rgba(255,255,255,0.96);padding:16px;border:1px solid #d7e4f6;border-radius:8px;box-shadow:0 10px 28px rgba(30,64,175,0.07);display:flex;flex-direction:column;overflow:hidden;}
        .field-config-page .code-card h4{margin-bottom:10px;color:#172554;font-size:15px;font-weight:700;flex-shrink:0;}
        .field-config-page .code-box{flex:1;width:100%;padding:15px;border:1px solid #d7e4f6;border-radius:8px;background:#f8fbff;font-family:Consolas,monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;overflow:auto;color:#334155;}
        .field-config-page .copy-btn{margin-top:10px;flex-shrink:0;width:fit-content;position:relative;overflow:hidden;}
        .field-config-page .copy-tip{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:8px 16px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:all 0.3s ease;box-shadow:0 10px 24px rgba(5,150,105,0.2);}
        .field-config-page .copy-tip.show{opacity:1;top:30px;}
      `}</style>

            <h2 className="title">字段配置 · XML / Java 自动生成</h2>
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
                                onMouseLeave={hideTooltip}>新增一行</button>
                        <button className="btn btn-primary" onClick={genCode}
                                onMouseEnter={(e) => showTooltip(e.currentTarget, '内容粘贴后会自动生成代码')}
                                onMouseLeave={hideTooltip}>生成代码</button>
                        <button className="btn btn-danger" onClick={clearAll}
                                onMouseEnter={(e) => showTooltip(e.currentTarget, '重置表格内容')}
                                onMouseLeave={hideTooltip}
                                onMouseOver={() => highlightAll(true)}
                                onMouseOut={() => highlightAll(false)}>清空所有内容</button>
                    </div>

                    <div className="table-box" ref={tableBoxRef}>
                        <table>
                            <thead>
                            <tr>
                                <th>字段名称
                                    <button className="clear-col-btn"
                                            onMouseOver={() => highlightCol(0, true)}
                                            onMouseOut={() => highlightCol(0, false)}
                                            onClick={() => clearCol('field')}>清</button>
                                </th>
                                <th>字段别名
                                    <button className="clear-col-btn"
                                            onMouseOver={() => highlightCol(1, true)}
                                            onMouseOut={() => highlightCol(1, false)}
                                            onClick={() => clearCol('alias')}>清</button>
                                </th>
                                <th>描述
                                    <button className="clear-col-btn"
                                            onMouseOver={() => highlightCol(2, true)}
                                            onMouseOut={() => highlightCol(2, false)}
                                            onClick={() => clearCol('desc')}>清</button>
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
                                                onMouseLeave={hideTooltip}>删</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 新增：表格下方提示用户可以继续新增 */}
                    <div className="add-row-tip">
                        可点击「新增一行」继续添加更多字段
                    </div>

                    <div className="tips">
                        <strong>使用说明</strong>
                        <p><span>1</span> 粘贴一整列：点击该列首行粘贴</p>
                        <p><span>2</span> 粘贴多行多列：点击左上角单元格粘贴</p>
                        <p><span>3</span> 清空本列：鼠标悬浮可预览，点击清空</p>
                        <p><span>4</span> 删除当前行：鼠标悬浮可预览，点击删除</p>
                        <p><span>5</span> 自动生成：填写完成自动生成 XML / Java 代码</p>
                    </div>

                    <button className="scroll-to-bottom" ref={scrollBottomBtnRef} onClick={scrollToPanelBottom}
                            onMouseEnter={(e) => showTooltip(e.currentTarget, '点击跳转到最后一行')}
                            onMouseLeave={hideTooltip}>
                        <div className="scroll-icon-bottom"></div>
                    </button>
                </div>

                <div className="code-wrap">
                    <div className="code-card">
                        <h4>XML 报文</h4>
                        <div className="code-box" ref={xmlResRef}>请填写左侧字段，代码将自动生成</div>
                        <button className="btn btn-primary copy-btn" onClick={() => copyCode(xmlResRef, 'XML')}>复制 XML</button>
                    </div>
                    <div className="code-card">
                        <h4>Java 实体代码</h4>
                        <div className="code-box" ref={javaResRef}>请填写左侧字段，代码将自动生成</div>
                        <button className="btn btn-primary copy-btn" onClick={() => copyCode(javaResRef, 'Java')}>复制 Java</button>
                    </div>
                </div>
            </div>

            <div className="tooltip" ref={tooltipRef}></div>
            <div className="copy-tip" ref={copyTipRef}></div>
        </div>
    );
};
