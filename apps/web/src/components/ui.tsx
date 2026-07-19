import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren } from 'react';

export function Shell({ children }: PropsWithChildren) {
  return <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">{children}</div>;
}

export function Card({ children }: PropsWithChildren) {
  return (
    <section className="rounded-xl border border-ink-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6 space-y-2">
      <p className="text-sm font-semibold tracking-[0.14em] text-accent-700 uppercase">
        ContractRadar
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">{title}</h1>
      {subtitle ? <p className="max-w-2xl text-ink-700">{subtitle}</p> : null}
    </header>
  );
}

export function ContextBanner({
  organization,
  project,
  role,
}: {
  organization?: string | null;
  project?: string | null;
  role?: string | null;
}) {
  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700"
      role="status"
      aria-live="polite"
    >
      <span>
        Organization: <strong className="text-ink-950">{organization ?? 'None selected'}</strong>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        Project: <strong className="text-ink-950">{project ?? 'None selected'}</strong>
      </span>
      {role ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            Role: <strong className="text-ink-950">{role}</strong>
          </span>
        </>
      ) : null}
    </div>
  );
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-900 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return (
    <input
      className={`w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 shadow-sm ${className}`}
      {...rest}
    />
  );
}

export function Label({ children, htmlFor }: PropsWithChildren<{ htmlFor: string }>) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink-900">
      {children}
    </label>
  );
}

export function ErrorText({ children }: PropsWithChildren) {
  if (!children) return null;
  return (
    <p className="mt-2 text-sm text-red-700" role="alert">
      {children}
    </p>
  );
}
