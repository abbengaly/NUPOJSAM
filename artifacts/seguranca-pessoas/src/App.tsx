import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetDashboardQueryKey,
  getListAgentsQueryKey,
  getListHoursQueryKey,
  getListScheduleQueryKey,
  HoursEntryType,
  useCreateAgent,
  useCreateHoursEntry,
  useCreateScheduleEntry,
  useDeleteAgent,
  useGetDashboard,
  useListAgents,
  useListHours,
  useListSchedule,
  useUpdateAgent,
  type Agent,
  type AgentInput,
  type HoursInput,
  type ScheduleInput,
} from '@workspace/api-client-react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Command,
  FileClock,
  LayoutDashboard,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1 } },
});

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function dateLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="font-serif text-4xl font-bold tracking-[-0.035em] text-foreground md:text-[44px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function LoadingState({ label = 'Carregando dados operacionais' }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6" data-testid="status-loading">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl skeleton" />
        <div className="flex-1 space-y-2"><div className="h-3 w-1/3 rounded skeleton" /><div className="h-3 w-2/3 rounded skeleton" /></div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ErrorState({ onRetry, label = 'Não foi possível carregar estas informações.' }: { onRetry: () => void; label?: string }) {
  return (
    <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6" data-testid="status-error">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
        <div className="flex-1"><p className="font-semibold text-foreground">{label}</p><p className="mt-1 text-sm text-muted-foreground">Verifique a conexão com o servidor e tente novamente.</p></div>
        <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover-elevate" data-testid="button-retry"><RefreshCw className="h-3.5 w-3.5" /> Tentar novamente</button>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof UsersRound; title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center" data-testid="status-empty">
      <div className="mb-3 rounded-xl bg-muted p-3 text-muted-foreground"><Icon className="h-5 w-5" /></div>
      <p className="font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[hsl(221_28%_18%/0.45)] p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-enter-up max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h2 className="mt-1 font-serif text-2xl font-bold">{title}</h2></div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar" data-testid="button-close-modal"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: '/', label: 'Visão geral', icon: LayoutDashboard },
    { href: '/agentes', label: 'Agentes', icon: UsersRound },
    { href: '/agenda', label: 'Agenda de plantões', icon: CalendarDays },
    { href: '/banco-de-horas', label: 'Banco de horas', icon: FileClock },
  ];
  return (
    <div className="app-noise min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground shadow-2xl transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/15"><ShieldCheck className="h-5 w-5" /></div>
          <div><p className="font-serif text-lg font-bold text-sidebar-accent-foreground">Gestão de Segurança</p><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/60">Operação judicial</p></div>
        </div>
        <div className="my-8 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45"><span className="h-px flex-1 bg-sidebar-border" /> Menu <span className="h-px flex-1 bg-sidebar-border" /></div>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? location === '/' : location.startsWith(href);
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/10' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon className="h-[18px] w-[18px]" /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary-foreground" />}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" /> Sistema operacional</div>
          <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/55">Dados sincronizados com a central de escalas.</p>
          <p className="mt-3 font-mono text-[10px] text-sidebar-foreground/40">SGS · v2.4.1</p>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" data-testid="button-close-menu" />}
      <div className="md:pl-[264px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-muted md:hidden" aria-label="Abrir menu" data-testid="button-open-menu"><Menu className="h-5 w-5" /></button>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Command className="h-3.5 w-3.5" /><span>Central de operações</span><span className="text-border">/</span><span className="font-semibold text-foreground">{nav.find((item) => item.href === (location === '/' ? '/' : nav.find((n) => location.startsWith(n.href))?.href))?.label}</span></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notificações" data-testid="button-notifications"><Bell className="h-[18px] w-[18px]" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" /></button>
            <div className="hidden h-7 w-px bg-border sm:block" />
            <div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">CM</div><div className="hidden sm:block"><p className="text-xs font-semibold">Coordenação</p><p className="text-[10px] text-muted-foreground">Acesso administrativo</p></div></div>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100dvh-72px)] max-w-[1480px] px-4 py-7 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone = 'navy' }: { label: string; value: string | number; detail: string; icon: typeof UsersRound; tone?: 'navy' | 'yellow' | 'green' | 'red' }) {
  const tones = { navy: 'bg-primary text-primary-foreground', yellow: 'bg-accent text-accent-foreground', green: 'bg-[hsl(159_52%_39%)] text-white', red: 'bg-[hsl(1_72%_51%)] text-white' };
  return <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className={`mb-8 grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-[18px] w-[18px]" /></div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p><div className="absolute -right-6 -top-8 h-28 w-28 rounded-full border-[18px] border-muted/50 transition-transform group-hover:scale-110" /></div>;
}

function DashboardPage() {
  const dashboard = useGetDashboard();
  const agents = useListAgents();
  const month = monthKey(new Date());
  const schedule = useListSchedule({ month });
  const [showAll, setShowAll] = useState(false);
  if (dashboard.isLoading || agents.isLoading || schedule.isLoading) return <><PageHeading eyebrow="Relatório operacional" title="Visão geral" description="Acompanhe o efetivo, a escala e as horas em um único lugar." /><LoadingState /></>;
  if (dashboard.isError) return <><PageHeading eyebrow="Relatório operacional" title="Visão geral" description="Acompanhe o efetivo, a escala e as horas em um único lugar." /><ErrorState onRetry={() => dashboard.refetch()} /></>;
  const data = dashboard.data;
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = (schedule.data ?? []).filter((entry) => entry.date.slice(0, 10) === today);
  const visibleAgents = (agents.data ?? []).filter((agent) => showAll || agent.onDuty).slice(0, 6);
  return <div className="animate-enter-up">
    <PageHeading eyebrow="Relatório operacional · Hoje" title="Visão geral" description="Acompanhe o efetivo, a escala e as horas em um único lugar." action={<button onClick={() => { dashboard.refetch(); agents.refetch(); schedule.refetch(); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-sm hover-elevate" data-testid="button-refresh-dashboard"><RefreshCw className="h-4 w-4" /> Atualizar painel</button>} />
    <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Efetivo total" value={data?.totalAgents ?? 0} detail="agentes cadastrados" icon={UsersRound} />
      <StatCard label="Em serviço" value={data?.onDuty ?? 0} detail="na escala de hoje" icon={ShieldCheck} tone="yellow" />
      <StatCard label="Férias próximas" value={data?.vacationSoon ?? 0} detail="nos próximos 30 dias" icon={CalendarDays} />
      <StatCard label="Saldo positivo" value={`${data?.positiveHours ?? 0}h`} detail="banco de horas" icon={ArrowUpRight} tone="green" />
      <StatCard label="Saldo negativo" value={`${data?.negativeHours ?? 0}h`} detail="requer atenção" icon={ArrowDownLeft} tone="red" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_.85fr]">
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Efetivo disponível</p><h2 className="mt-1 font-serif text-2xl font-bold">Quem está em campo</h2></div><button onClick={() => setShowAll(!showAll)} className="text-xs font-semibold text-primary hover:underline" data-testid="button-toggle-agents">{showAll ? 'Mostrar só em serviço' : 'Ver todos os agentes'}</button></div>
        <div className="divide-y divide-border">
          {visibleAgents.length ? visibleAgents.map((agent, index) => <div key={agent.id} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40" data-testid={`row-agent-${agent.id}`}><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold ${index % 3 === 0 ? 'bg-[hsl(44_88%_62%/0.25)] text-[hsl(221_55%_28%)]' : index % 3 === 1 ? 'bg-primary/10 text-primary' : 'bg-[hsl(159_52%_39%/0.14)] text-[hsl(159_52%_32%)]'}`}>{initials(agent.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{agent.name}</p><p className="font-mono text-[10px] text-muted-foreground">{agent.registration} · {agent.dailyPost || 'Posto não definido'}</p></div><div className="text-right"><span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${agent.onDuty ? 'text-[hsl(159_52%_32%)]' : 'text-muted-foreground'}`}><span className={`h-1.5 w-1.5 rounded-full ${agent.onDuty ? 'bg-[hsl(159_52%_39%)]' : 'bg-muted-foreground/40'}`} />{agent.onDuty ? 'Em serviço' : 'Fora da escala'}</span><p className="mt-1 text-[10px] text-muted-foreground">{agent.startTime}–{agent.endTime}</p></div></div>) : <EmptyState icon={UsersRound} title="Nenhum agente cadastrado" description="Cadastre o primeiro agente para visualizar o efetivo." />}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/15"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary-foreground/60">Escala de hoje</p><h2 className="mt-2 font-serif text-3xl font-bold">{data?.todayPost || 'Posto central'}</h2><p className="mt-1 text-sm text-primary-foreground/65">{todayEntries.length} {todayEntries.length === 1 ? 'plantão registrado' : 'plantões registrados'}</p></div><div className="rounded-xl bg-primary-foreground/10 p-3"><Clock3 className="h-5 w-5 text-accent" /></div></div><div className="my-7 h-px bg-primary-foreground/15" /><div className="space-y-3">{todayEntries.slice(0, 4).map((entry) => <div key={entry.id} className="flex items-center gap-3" data-testid={`schedule-today-${entry.id}`}><div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-foreground/10 font-mono text-[10px]">{initials(entry.agentName)}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{entry.agentName}</p><p className="text-[10px] text-primary-foreground/55">{entry.post}</p></div><span className="font-mono text-[10px] text-accent">{entry.shift}</span></div>)}{!todayEntries.length && <p className="text-sm text-primary-foreground/65">Nenhum plantão lançado para hoje.</p>}</div><Link href="/agenda" className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline" data-testid="link-open-agenda">Abrir agenda <ChevronRight className="h-3.5 w-3.5" /></Link></section>
    </div>
  </div>;
}

type AgentFormProps = { initial?: Agent; onClose: () => void; onSaved: () => void };
function AgentForm({ initial, onClose, onSaved }: AgentFormProps) {
  const queryClient = useQueryClient();
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const [form, setForm] = useState<AgentInput>({
    name: initial?.name ?? '', registration: initial?.registration ?? '', startTime: initial?.startTime ?? '07:00', endTime: initial?.endTime ?? '19:00', onDuty: initial?.onDuty ?? true, birthDate: initial?.birthDate?.slice(0, 10) ?? '', vacation1: initial?.vacation1 ?? '', vacation2: initial?.vacation2 ?? '', vacation3: initial?.vacation3 ?? '', dailyPost: initial?.dailyPost ?? '',
  });
  const pending = create.isPending || update.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, vacation1: form.vacation1 || null, vacation2: form.vacation2 || null, vacation3: form.vacation3 || null };
    const finish = () => { queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); onSaved(); onClose(); };
    if (initial) update.mutate({ id: initial.id, data: payload }, { onSuccess: finish });
    else create.mutate({ data: payload }, { onSuccess: finish });
  };
  const set = (key: keyof AgentInput, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal eyebrow={initial ? 'Editar cadastro' : 'Novo cadastro'} title={initial ? 'Atualizar agente' : 'Adicionar agente'} onClose={onClose}><form onSubmit={submit} className="space-y-5 p-6">
    <div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="field-label">Nome completo</span><input required value={form.name} onChange={(e) => set('name', e.target.value)} className="field-input" data-testid="input-agent-name" placeholder="Ex.: Mariana Alves" /></label><label><span className="field-label">Matrícula</span><input required value={form.registration} onChange={(e) => set('registration', e.target.value)} className="field-input" data-testid="input-agent-registration" placeholder="SG-0428" /></label><label><span className="field-label">Posto diário</span><input required value={form.dailyPost} onChange={(e) => set('dailyPost', e.target.value)} className="field-input" data-testid="input-agent-post" placeholder="Portaria principal" /></label><label><span className="field-label">Início do turno</span><input type="time" required value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className="field-input" data-testid="input-agent-start" /></label><label><span className="field-label">Fim do turno</span><input type="time" required value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className="field-input" data-testid="input-agent-end" /></label><label><span className="field-label">Data de nascimento</span><input type="date" required value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className="field-input" data-testid="input-agent-birth" /></label><label className="flex items-end pb-2"><span className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.onDuty} onChange={(e) => set('onDuty', e.target.checked)} className="h-4 w-4 accent-[hsl(44_88%_52%)]" data-testid="input-agent-duty" /> Disponível para escala</span></label></div>
    <div className="rounded-xl bg-muted/70 p-4"><p className="mb-3 text-xs font-semibold">Períodos de férias programados</p><div className="grid gap-3 sm:grid-cols-3">{(['vacation1', 'vacation2', 'vacation3'] as const).map((key, index) => <label key={key}><span className="field-label">Período {index + 1}</span><input type="date" value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} className="field-input bg-card" data-testid={`input-agent-vacation-${index + 1}`} /></label>)}</div></div>
    {create.isError || update.isError ? <p className="text-sm text-destructive" data-testid="status-form-error">Não foi possível salvar o cadastro.</p> : null}
    <div className="flex justify-end gap-3 border-t border-border pt-5"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted" data-testid="button-cancel-agent">Cancelar</button><button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50" data-testid="button-save-agent">{pending ? 'Salvando...' : <><Check className="h-4 w-4" /> Salvar agente</>}</button></div>
  </form></Modal>;
}

function AgentsPage() {
  const queryClient = useQueryClient();
  const agents = useListAgents();
  const remove = useDeleteAgent();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Agent | null | undefined>(undefined);
  const filtered = useMemo(() => (agents.data ?? []).filter((agent) => `${agent.name} ${agent.registration} ${agent.dailyPost}`.toLowerCase().includes(search.toLowerCase())), [agents.data, search]);
  const deleteAgent = (agent: Agent) => { if (!window.confirm(`Remover ${agent.name} do cadastro?`)) return; remove.mutate({ id: agent.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  return <div className="animate-enter-up"><PageHeading eyebrow="Efetivo · Cadastro" title="Agentes" description="Consulte dados funcionais, disponibilidade e postos de todos os agentes." action={<button onClick={() => setEditing(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 hover:brightness-110" data-testid="button-add-agent"><Plus className="h-4 w-4" /> Novo agente</button>} />
    <div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="field-input pl-10" placeholder="Buscar por nome, matrícula ou posto..." data-testid="input-search-agents" /></div><div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs text-muted-foreground"><span className="font-mono font-semibold text-foreground">{filtered.length}</span> resultados</div></div>
    {agents.isLoading ? <LoadingState label="Carregando cadastro de agentes" /> : agents.isError ? <ErrorState onRetry={() => agents.refetch()} /> : filtered.length === 0 ? <EmptyState icon={UsersRound} title={search ? 'Nenhum agente encontrado' : 'Cadastro ainda vazio'} description={search ? 'Tente outro nome, matrícula ou posto.' : 'Adicione um agente para iniciar o controle do efetivo.'} /> : <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="hidden grid-cols-[1.7fr_1fr_1fr_1.1fr_auto] gap-4 border-b border-border bg-muted/60 px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid"><span>Agente</span><span>Jornada</span><span>Posto</span><span>Status</span><span /></div><div className="divide-y divide-border">{filtered.map((agent) => <div key={agent.id} className="grid gap-3 px-5 py-4 transition-colors hover:bg-muted/30 md:grid-cols-[1.7fr_1fr_1fr_1.1fr_auto] md:items-center md:gap-4" data-testid={`row-agent-${agent.id}`}><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">{initials(agent.name)}</div><div><p className="text-sm font-semibold">{agent.name}</p><p className="font-mono text-[10px] text-muted-foreground">{agent.registration} · Nasc. {dateLabel(agent.birthDate)}</p></div></div><div><span className="md:hidden field-label">Jornada</span><p className="font-mono text-xs">{agent.startTime} — {agent.endTime}</p></div><div><span className="md:hidden field-label">Posto</span><p className="text-xs font-medium">{agent.dailyPost || 'Não definido'}</p></div><div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${agent.onDuty ? 'bg-[hsl(159_52%_39%/0.12)] text-[hsl(159_52%_32%)]' : 'bg-muted text-muted-foreground'}`}><span className={`h-1.5 w-1.5 rounded-full ${agent.onDuty ? 'bg-[hsl(159_52%_39%)]' : 'bg-muted-foreground/50'}`} />{agent.onDuty ? 'Disponível' : 'Afastado'}</span></div><div className="flex items-center gap-1 md:justify-end"><button onClick={() => setEditing(agent)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" aria-label={`Editar ${agent.name}`} data-testid={`button-edit-agent-${agent.id}`}><Pencil className="h-4 w-4" /></button><button onClick={() => deleteAgent(agent)} disabled={remove.isPending} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Excluir ${agent.name}`} data-testid={`button-delete-agent-${agent.id}`}><Trash2 className="h-4 w-4" /></button></div></div>)}</div></div>}
    {editing !== undefined && <AgentForm initial={editing ?? undefined} onClose={() => setEditing(undefined)} onSaved={() => agents.refetch()} />}
  </div>;
}

function AgendaPage() {
  const queryClient = useQueryClient();
  const agents = useListAgents();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const schedule = useListSchedule({ month: monthKey(cursor) });
  const create = useCreateScheduleEntry();
  const [form, setForm] = useState<ScheduleInput>({ agentId: 0, date: '', shift: '07:00–19:00', post: '' });
  const days = useMemo(() => { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate(); const offset = (first.getDay() + 6) % 7; return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))]; }, [cursor]);
  const byDate = useMemo(() => (schedule.data ?? []).reduce<Record<string, typeof schedule.data>>((acc, entry) => { const key = entry.date.slice(0, 10); (acc[key] ??= []).push(entry); return acc; }, {}), [schedule.data]);
  const openDay = (date: Date) => { const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; setSelected(value); setForm({ agentId: agents.data?.[0]?.id ?? 0, date: value, shift: '07:00–19:00', post: agents.data?.[0]?.dailyPost ?? '' }); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.agentId) return; create.mutate({ data: form }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListScheduleQueryKey({ month: monthKey(cursor) }) }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setSelected(null); } }); };
  return <div className="animate-enter-up"><PageHeading eyebrow="Escalas · Mensal" title="Agenda de plantões" description="Visualize a cobertura por dia e registre novos plantões com rapidez." action={<button onClick={() => openDay(new Date())} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 hover:brightness-110" data-testid="button-add-schedule"><Plus className="h-4 w-4" /> Lançar plantão</button>} />
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6"><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg p-2 hover:bg-muted" aria-label="Mês anterior" data-testid="button-prev-month"><ChevronLeft className="h-5 w-5" /></button><div className="text-center"><p className="font-serif text-2xl font-bold">{MONTHS[cursor.getMonth()]}</p><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{cursor.getFullYear()} · {schedule.data?.length ?? 0} plantões</p></div><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg p-2 hover:bg-muted" aria-label="Próximo mês" data-testid="button-next-month"><ChevronRight className="h-5 w-5" /></button></div><div className="overflow-x-auto p-3 sm:p-5"><div className="min-w-[700px]"><div className="mb-2 grid grid-cols-7">{WEEKDAYS.map((day) => <div key={day} className="px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{day}</div>)}</div>{schedule.isLoading ? <LoadingState label="Carregando escala mensal" /> : schedule.isError ? <ErrorState onRetry={() => schedule.refetch()} /> : <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border">{days.map((day, index) => { if (!day) return <div key={`blank-${index}`} className="min-h-28 border-b border-r border-border bg-muted/25" />; const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`; const entries = byDate[key] ?? []; const isToday = key === new Date().toISOString().slice(0, 10); return <button key={key} onClick={() => openDay(day)} className="min-h-28 border-b border-r border-border bg-card p-2 text-left align-top transition-colors hover:bg-accent/10" data-testid={`calendar-day-${key}`}><span className={`inline-grid h-6 w-6 place-items-center rounded-full font-mono text-xs ${isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground'}`}>{day.getDate()}</span><div className="mt-2 space-y-1">{entries.slice(0, 3).map((entry) => <div key={entry.id} className="truncate rounded-md bg-primary/10 px-1.5 py-1 text-[10px] font-semibold text-primary" data-testid={`calendar-entry-${entry.id}`}>{entry.shift} · {entry.agentName.split(' ')[0]}</div>)}{entries.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{entries.length - 3} mais</p>}</div></button>; })}</div>}</div></div></section>
    {selected && <Modal eyebrow="Nova escala" title={`Plantão em ${dateLabel(selected)}`} onClose={() => setSelected(null)}><form onSubmit={submit} className="space-y-5 p-6"><label><span className="field-label">Agente</span><select required value={form.agentId} onChange={(e) => { const agent = agents.data?.find((item) => item.id === Number(e.target.value)); setForm({ ...form, agentId: Number(e.target.value), post: agent?.dailyPost ?? form.post }); }} className="field-input" data-testid="select-schedule-agent"><option value={0}>Selecione um agente</option>{(agents.data ?? []).map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.registration}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">Turno</span><select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="field-input" data-testid="select-schedule-shift"><option>07:00–19:00</option><option>19:00–07:00</option><option>08:00–18:00</option><option>12:00–20:00</option></select></label><label><span className="field-label">Posto</span><input required value={form.post} onChange={(e) => setForm({ ...form, post: e.target.value })} className="field-input" data-testid="input-schedule-post" /></label></div>{create.isError && <p className="text-sm text-destructive" data-testid="status-schedule-error">Não foi possível lançar o plantão.</p>}<div className="flex justify-end gap-3 border-t border-border pt-5"><button type="button" onClick={() => setSelected(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted" data-testid="button-cancel-schedule">Cancelar</button><button disabled={create.isPending} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50" data-testid="button-save-schedule">{create.isPending ? 'Lançando...' : 'Lançar plantão'}</button></div></form></Modal>}
  </div>;
}

function HoursPage() {
  const queryClient = useQueryClient();
  const hours = useListHours();
  const agents = useListAgents();
  const create = useCreateHoursEntry();
  const [agentFilter, setAgentFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HoursInput>({ agentId: 0, date: new Date().toISOString().slice(0, 10), type: HoursEntryType.credit, hours: 0, note: '' });
  const entries = useMemo(() => (hours.data ?? []).filter((entry) => agentFilter === 'all' || String(entry.agentId) === agentFilter), [hours.data, agentFilter]);
  const balances = useMemo(() => { const map = new Map<number, { name: string; balance: number }>(); (hours.data ?? []).forEach((entry) => { const previous = map.get(entry.agentId) ?? { name: entry.agentName, balance: 0 }; previous.balance += entry.type === 'credit' ? entry.hours : -entry.hours; map.set(entry.agentId, previous); }); return [...map.values()].sort((a, b) => b.balance - a.balance); }, [hours.data]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.agentId || form.hours <= 0) return; create.mutate({ data: { ...form, hours: Number(form.hours) } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListHoursQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setOpen(false); } }); };
  return <div className="animate-enter-up"><PageHeading eyebrow="Controle · Compensação" title="Banco de horas" description="Lance ocorrências e acompanhe o saldo individual do efetivo." action={<button onClick={() => { setForm({ ...form, agentId: agents.data?.[0]?.id ?? 0 }); setOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 hover:brightness-110" data-testid="button-add-hours"><Plus className="h-4 w-4" /> Novo lançamento</button>} />
    <div className="mb-5 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-border bg-card p-5"><p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Saldo consolidado</p><p className="mt-2 text-3xl font-bold text-[hsl(159_52%_32%)]">{balances.reduce((sum, item) => sum + item.balance, 0).toFixed(1)}h</p><p className="mt-1 text-xs text-muted-foreground">considerando todos os agentes</p></div><div className="rounded-2xl border border-border bg-card p-5"><p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Agentes com saldo</p><p className="mt-2 text-3xl font-bold">{balances.length}</p><p className="mt-1 text-xs text-muted-foreground">com movimentação registrada</p></div><div className="rounded-2xl border border-border bg-card p-5"><p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Lançamentos</p><p className="mt-2 text-3xl font-bold">{hours.data?.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">histórico disponível</p></div></div>
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.6fr]"><section className="rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border px-5 py-5"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Resumo individual</p><h2 className="mt-1 font-serif text-2xl font-bold">Saldos atuais</h2></div><div className="divide-y divide-border">{balances.length ? balances.map((item, index) => <button key={item.name} onClick={() => { const found = (hours.data ?? []).find((entry) => entry.agentName === item.name); setAgentFilter(found ? String(found.agentId) : 'all'); }} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40" data-testid={`row-balance-${index}`}><div className="grid h-9 w-9 place-items-center rounded-full bg-muted font-mono text-[10px] font-semibold text-primary">{initials(item.name)}</div><p className="min-w-0 flex-1 truncate text-xs font-semibold">{item.name}</p><span className={`font-mono text-xs font-semibold ${item.balance >= 0 ? 'text-[hsl(159_52%_32%)]' : 'text-destructive'}`}>{item.balance >= 0 ? '+' : ''}{item.balance.toFixed(1)}h</span></button>) : <div className="p-5"><EmptyState icon={BarChart3} title="Sem saldos ainda" description="Os saldos aparecem após o primeiro lançamento." /></div>}</div></section><section className="rounded-2xl border border-border bg-card shadow-sm"><div className="flex flex-col gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Histórico de movimentos</p><h2 className="mt-1 font-serif text-2xl font-bold">Lançamentos</h2></div><select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="field-input max-w-full sm:w-52" data-testid="select-hours-agent"><option value="all">Todos os agentes</option>{(agents.data ?? []).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></div>{hours.isLoading ? <div className="p-5"><LoadingState label="Carregando banco de horas" /></div> : hours.isError ? <div className="p-5"><ErrorState onRetry={() => hours.refetch()} /></div> : entries.length === 0 ? <div className="p-5"><EmptyState icon={FileClock} title="Nenhum lançamento encontrado" description="Registre horas de crédito ou débito para começar o acompanhamento." /></div> : <div className="divide-y divide-border">{entries.map((entry) => <div key={entry.id} className="flex items-center gap-3 px-5 py-4" data-testid={`row-hours-${entry.id}`}><div className={`grid h-9 w-9 place-items-center rounded-xl ${entry.type === 'credit' ? 'bg-[hsl(159_52%_39%/0.13)] text-[hsl(159_52%_32%)]' : 'bg-destructive/10 text-destructive'}`}>{entry.type === 'credit' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{entry.agentName}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{dateLabel(entry.date)} · {entry.note || 'Sem observação'}</p></div><span className={`font-mono text-sm font-semibold ${entry.type === 'credit' ? 'text-[hsl(159_52%_32%)]' : 'text-destructive'}`}>{entry.type === 'credit' ? '+' : '−'}{entry.hours}h</span></div>)}</div>}</section></div>
    {open && <Modal eyebrow="Banco de horas" title="Novo lançamento" onClose={() => setOpen(false)}><form onSubmit={submit} className="space-y-5 p-6"><label><span className="field-label">Agente</span><select required value={form.agentId} onChange={(e) => setForm({ ...form, agentId: Number(e.target.value) })} className="field-input" data-testid="select-entry-agent"><option value={0}>Selecione um agente</option>{(agents.data ?? []).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">Data</span><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="field-input" data-testid="input-hours-date" /></label><label><span className="field-label">Quantidade de horas</span><input required min="0.5" step="0.5" type="number" value={form.hours || ''} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} className="field-input" data-testid="input-hours-amount" /></label></div><label><span className="field-label">Tipo de lançamento</span><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm({ ...form, type: HoursEntryType.credit })} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${form.type === HoursEntryType.credit ? 'border-[hsl(159_52%_39%)] bg-[hsl(159_52%_39%/0.1)] text-[hsl(159_52%_32%)]' : 'border-border text-muted-foreground'}`} data-testid="button-hours-credit"><ArrowUpRight className="mx-auto mb-1 h-4 w-4" /> Crédito</button><button type="button" onClick={() => setForm({ ...form, type: HoursEntryType.debit })} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${form.type === HoursEntryType.debit ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground'}`} data-testid="button-hours-debit"><ArrowDownLeft className="mx-auto mb-1 h-4 w-4" /> Débito</button></div></label><label><span className="field-label">Observação</span><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="field-input min-h-20 resize-y" data-testid="input-hours-note" placeholder="Ex.: cobertura extraordinária" /></label>{create.isError && <p className="text-sm text-destructive" data-testid="status-hours-error">Não foi possível registrar o lançamento.</p>}<div className="flex justify-end gap-3 border-t border-border pt-5"><button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted" data-testid="button-cancel-hours">Cancelar</button><button disabled={create.isPending} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50" data-testid="button-save-hours">{create.isPending ? 'Registrando...' : 'Registrar lançamento'}</button></div></form></Modal>}
  </div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><AppShell><Switch><Route path="/" component={DashboardPage} /><Route path="/agentes" component={AgentsPage} /><Route path="/agenda" component={AgendaPage} /><Route path="/banco-de-horas" component={HoursPage} /><Route component={NotFound} /></Switch></AppShell></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;