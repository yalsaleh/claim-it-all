import Link from 'next/link';
import type { Route } from 'next';

const LINKS = [
  ['', 'Overview'],
  ['/documents', 'Documents'],
  ['/structure', 'Structure'],
  ['/clauses', 'Clauses'],
  ['/obligations', 'Obligations'],
  ['/notice-rules', 'Notice rules'],
  ['/issues', 'Issues'],
  ['/review', 'Review'],
] as const;

export function ContractPackageNav(props: { projectId: string; contractPackageId: string }) {
  const base = `/projects/${props.projectId}/contracts/${props.contractPackageId}`;
  return (
    <nav className="mb-4 flex flex-wrap gap-3 text-sm">
      {LINKS.map(([suffix, label]) => (
        <Link key={suffix} className="text-accent-700 underline" href={`${base}${suffix}` as Route}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
