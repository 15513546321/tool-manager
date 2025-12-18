import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
      {/* Page Size Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">每页显示:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
          className="px-2 py-1 border border-slate-200 rounded text-sm bg-white hover:bg-slate-50 cursor-pointer"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <span className="text-sm text-slate-600 ml-2">
          共 {totalItems} 项，第 {currentPage} / {totalPages} 页
        </span>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-3 py-1 border border-slate-200 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="上一页"
        >
          <ChevronLeft size={16} />
          <span className="text-sm">上一页</span>
        </button>

        {/* Page Numbers */}
        <div className="flex gap-1">
          {(() => {
            const pageNumbers = new Set<number>();
            const pageCount = Math.min(5, totalPages);
            
            // Always include current page
            pageNumbers.add(currentPage);
            
            // Add pages around current page
            for (let i = 1; i <= pageCount; i++) {
              let pageNum = currentPage - Math.floor(pageCount / 2) + i - 1;
              if (pageNum >= 1 && pageNum <= totalPages) {
                pageNumbers.add(pageNum);
              }
            }
            
            // Sort and convert to array
            return Array.from(pageNumbers).sort((a, b) => a - b).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-2 py-1 text-sm rounded transition-colors ${
                  pageNum === currentPage
                    ? 'bg-blue-500 text-white font-bold'
                    : 'border border-slate-200 hover:bg-white'
                }`}
              >
                {pageNum}
              </button>
            ));
          })()}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-3 py-1 border border-slate-200 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="下一页"
        >
          <span className="text-sm">下一页</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
