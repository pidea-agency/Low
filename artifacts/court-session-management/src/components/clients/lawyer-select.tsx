import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Shield } from 'lucide-react';
import { useGetCurrentUser } from '@workspace/api-client-react';

export interface LawyerOption {
  id: string;
  name: string;
  role: 'admin' | 'staff';
}

interface LawyerSelectProps {
  value?: string | null;
  onChange?: (lawyerId: string | null, lawyerName?: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  currentRole?: string;
  currentUserId?: string;
  currentUserName?: string;
}

export function LawyerSelect({
  value,
  onChange,
  label = 'المحامي المسؤول',
  placeholder = 'اختر المحامي...',
  disabled = false,
}: LawyerSelectProps) {
  const { data: currentUser } = useGetCurrentUser();
  const [lawyers, setLawyers] = useState<LawyerOption[]>([]);
  const [loading, setLoading] = useState(false);

  const isStaff = currentUser?.role === 'staff';

  useEffect(() => {
    if (isStaff) return;

    const fetchOfficeMembers = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/users', { credentials: 'include' });
        if (res.ok) {
          const staffUsers = await res.json();
          const list: LawyerOption[] = [];

          // Add current admin if available
          if (currentUser?.id) {
            list.push({
              id: currentUser.id,
              name: currentUser.displayName || currentUser.username || 'مشرف المكتب (أنت)',
              role: 'admin',
            });
          }

          if (Array.isArray(staffUsers)) {
            for (const u of staffUsers) {
              if (u.id !== currentUser?.id) {
                list.push({
                  id: u.id,
                  name: u.display_name || u.displayName || u.username,
                  role: 'staff',
                });
              }
            }
          }
          setLawyers(list);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchOfficeMembers();
  }, [isStaff, currentUser?.id, currentUser?.displayName, currentUser?.username]);

  // If staff: render read-only indicator
  if (isStaff) {
    const staffName = currentUser?.displayName || currentUser?.username || 'أنت';
    return (
      <div className="space-y-1.5" dir="rtl">
        {label && <Label className="text-sm font-medium">{label}</Label>}
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/30 text-sm">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            <span className="font-semibold">{staffName}</span>
          </div>
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
            مسند إليك تلقائياً
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5" dir="rtl">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <Select
        value={value || '__none__'}
        onValueChange={(val) => {
          if (!onChange) return;
          if (val === '__none__') {
            onChange(null, undefined);
          } else {
            const found = lawyers.find((l) => l.id === val);
            onChange(val, found?.name);
          }
        }}
        disabled={disabled || loading}
      >
        <SelectTrigger className="w-full text-right bg-background">
          <SelectValue placeholder={loading ? 'جاري التحميل...' : placeholder} />
        </SelectTrigger>
        <SelectContent dir="rtl">
          <SelectItem value="__none__">
            <span className="text-muted-foreground">— بدون تعيين محامٍ —</span>
          </SelectItem>
          {lawyers.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              <div className="flex items-center gap-2">
                {l.role === 'admin' ? (
                  <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                )}
                <span>{l.name}</span>
                {l.role === 'admin' && (
                  <span className="text-[11px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                    مشرف
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
