import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ title, value, change, icon: Icon, trend = 'neutral' }: StatCardProps) {
  return (
    <Card className="border border-[#1A1E22] p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-2xl font-bold">{value}</span>
          {change && (
            <span className="text-xs font-medium text-muted-foreground">
              {change}
            </span>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
