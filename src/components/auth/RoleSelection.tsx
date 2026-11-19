import { ArrowRight, Building2, GraduationCap } from 'lucide-react';
import type { UserRole } from '../../types/auth';

interface RoleSelectionProps {
  onSelectRole: (role: UserRole) => void;
}

export function RoleSelection({ onSelectRole }: RoleSelectionProps) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 pt-2">
      <button
        type="button"
        onClick={() => onSelectRole('ADMINISTRATION')}
        className="group flex min-h-[68px] w-full items-center justify-between gap-4 rounded-lg border border-[#ECFDF5]/22 bg-[#10201F]/70 px-6 py-4 text-left transition-colors duration-200 hover:border-[#10B981] hover:bg-[#10B981]/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981]"
      >
        <div className="flex items-center gap-4">
          <Building2
            className="h-5 w-5 shrink-0 text-[#34D399]"
            aria-hidden="true"
          />
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[#FFFFFF]">
            Administration Login
          </span>
        </div>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-[#34D399] transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        onClick={() => onSelectRole('HOD')}
        className="group flex min-h-[68px] w-full items-center justify-between gap-4 rounded-lg border border-[#ECFDF5]/22 bg-[#10201F]/70 px-6 py-4 text-left transition-colors duration-200 hover:border-[#10B981] hover:bg-[#10B981]/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981]"
      >
        <div className="flex items-center gap-4">
          <GraduationCap
            className="h-5 w-5 shrink-0 text-[#34D399]"
            aria-hidden="true"
          />
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[#FFFFFF]">
            HOD Login
          </span>
        </div>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-[#34D399] transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
