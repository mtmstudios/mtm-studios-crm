import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZES } from '@/lib/list';
import { num } from '@/lib/format';

interface Props {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  onPageChange(page: number): void;
  onPageSizeChange(size: number): void;
}

export function TablePagination({
  page,
  pageSize,
  pageCount,
  total,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-sm">
      <div className="text-muted-foreground">
        {total === 0 ? (
          'Keine Einträge'
        ) : (
          <>
            <span className="font-medium text-foreground">
              {num(from)}–{num(to)}
            </span>{' '}
            von {num(total)}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-muted-foreground">Pro Seite</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Vorherige Seite"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-muted-foreground">
            {num(page)} / {num(pageCount)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Nächste Seite"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
