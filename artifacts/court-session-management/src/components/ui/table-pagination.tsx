import React from 'react';
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className,
}: TablePaginationProps) {
  if (totalItems <= 0) return null;

  const from = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const to = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to display with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('ellipsis');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-card/60 text-xs text-muted-foreground select-none mt-4',
        className,
      )}
      dir="rtl"
    >
      {/* Items range summary */}
      <div className="flex items-center gap-2">
        <span>
          عرض <strong className="text-foreground font-mono">{from}</strong> إلى{' '}
          <strong className="text-foreground font-mono">{to}</strong> من أصل{' '}
          <strong className="text-foreground font-mono">{totalItems}</strong> سجل
        </span>

        {/* Page size picker */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-border/60">
            <span className="text-[11px] text-muted-foreground/80">لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 px-2 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            title="الصفحة الأولى"
            aria-label="الصفحة الأولى"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>

          {/* Previous page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="الصفحة السابقة"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          {/* Numbered page buttons */}
          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-1.5 text-muted-foreground/60 select-none">
                  •••
                </span>
              ) : (
                <Button
                  key={`page-${p}`}
                  variant={p === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(p)}
                  className={cn(
                    'h-8 min-w-[32px] px-2 rounded-lg font-mono text-xs font-semibold',
                    p === currentPage
                      ? 'bg-[#3F4A2C] hover:bg-[#353E24] text-white shadow-xs dark:bg-[#C9A449] dark:text-stone-900'
                      : 'hover:bg-muted text-foreground',
                  )}
                >
                  {p}
                </Button>
              ),
            )}
          </div>

          {/* Next page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="الصفحة التالية"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {/* Last page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title="الصفحة الأخيرة"
            aria-label="الصفحة الأخيرة"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

