"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, ChevronRight, GraduationCap } from "lucide-react";
import type { AdminOfferingRow } from "@scholau/api";
import { useAdminOfferings } from "@scholau/api/react";
import { formatDate } from "@scholau/core";
import { type Column, DataTable } from "@/components/admin/data-table";
import { PublishActions } from "@/components/admin/publish-actions";
import { AdminErrorState, StatusBadge } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, LoadingState } from "@/components/ui/states";

const facultyId = (row: AdminOfferingRow) => row.department?.faculty?.id ?? "unassigned-faculty";
const departmentId = (row: AdminOfferingRow) => row.department?.id ?? "unassigned-department";
const compare = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
const courseLabel = (row: AdminOfferingRow) => row.course ? `${row.course.code} ${row.course.title}` : "Offering";
const PAGE_SIZE = 15;
type Filters = { scope: string; search: string; level: string; semester: string; status: string; page: number };
const defaults = (scope: string): Filters => ({ scope, search: "", level: "", semester: "", status: "", page: 0 });

function OfferingsBrowser() {
  const query = useAdminOfferings();
  const pathname = usePathname();
  const params = useSearchParams();
  const faculty = params.get("faculty");
  const department = params.get("department");
  const scope = `${faculty ?? ""}/${department ?? ""}`;
  const [savedFilters, setFilters] = useState<Filters>(() => defaults(scope));
  const filters = savedFilters.scope === scope ? savedFilters : defaults(scope);
  const [notice, setNotice] = useState<string | null>(null);
  const updateFilters = (patch: Partial<Filters>) => setFilters({ ...filters, page: 0, ...patch });

  function destination(facultyKey?: string, departmentKey?: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("faculty"); next.delete("department");
    if (facultyKey) next.set("faculty", facultyKey);
    if (departmentKey) next.set("department", departmentKey);
    return `${pathname}${next.size ? `?${next}` : ""}`;
  }

  const rows = query.data ?? [];
  const facultyMap = new Map<string, { id: string; name: string; university: string; rows: AdminOfferingRow[] }>();
  for (const row of rows) {
    const id = facultyId(row);
    const item = facultyMap.get(id) ?? { id, name: row.department?.faculty?.name ?? "Faculty unavailable", university: row.department?.faculty?.university?.name ?? "Institution unavailable", rows: [] };
    item.rows.push(row); facultyMap.set(id, item);
  }
  const faculties = [...facultyMap.values()].sort((a, b) => compare(a.university, b.university) || compare(a.name, b.name));
  const selectedFaculty = faculty ? facultyMap.get(faculty) : undefined;
  const departmentMap = new Map<string, { id: string; name: string; rows: AdminOfferingRow[] }>();
  for (const row of selectedFaculty?.rows ?? []) {
    const id = departmentId(row);
    const item = departmentMap.get(id) ?? { id, name: row.department?.name ?? "Department unavailable", rows: [] };
    item.rows.push(row); departmentMap.set(id, item);
  }
  const departments = [...departmentMap.values()].sort((a, b) => compare(a.name, b.name));
  const selectedDepartment = department ? departmentMap.get(department) : undefined;
  const departmentRows = selectedDepartment?.rows ?? [];
  const levels = [...new Map(departmentRows.flatMap(row => row.level ? [[row.level.id, row.level] as const] : [])).values()].sort((a, b) => compare(a.label, b.label));
  const semesters = [...new Map(departmentRows.flatMap(row => row.semester ? [[row.semester.id, row.semester] as const] : [])).values()].sort((a, b) => compare(a.period?.label ?? "", b.period?.label ?? "") || compare(a.label, b.label));
  const filtered = departmentRows.filter(row => (!filters.level || row.level?.id === filters.level) && (!filters.semester || row.semester?.id === filters.semester) && (!filters.status || row.status === filters.status) && courseLabel(row).toLowerCase().includes(filters.search.trim().toLowerCase())).sort((a, b) => compare(a.level?.label ?? "", b.level?.label ?? "") || compare(a.course?.code ?? "", b.course?.code ?? "") || compare(a.semester?.period?.label ?? "", b.semester?.period?.label ?? "") || compare(a.semester?.label ?? "", b.semester?.label ?? "") || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(filters.page, pageCount - 1);
  const visibleRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const columns: Column<AdminOfferingRow>[] = [
    { key: "course", header: "Course", cell: row => row.course ? <span className="flex flex-col"><span className="font-bold">{row.course.code}</span><span className="font-normal">{row.course.title}</span></span> : "Unavailable" },
    { key: "level", header: "Level", cell: row => row.level?.label ?? "Unavailable" },
    { key: "semester", header: "Semester", cell: row => <>{row.semester?.label ?? "Unavailable"}<span className="block text-xs text-ink-muted">{row.semester?.period?.label}</span></> },
    { key: "status", header: "Status", cell: row => <StatusBadge status={row.status} /> },
    { key: "created", header: "Created", cell: row => formatDate(row.created_at) },
    { key: "actions", header: "Actions", action: true, cell: row => <PublishActions size="sm" entityType="course_offering" id={row.id} status={row.status} label={courseLabel(row)} canRetire={row.status !== "retired"} publishDescription="The offering becomes visible in the catalog to students whose department, level and semester match." publishDetails={<p>Only its published lessons and assessments are shown to students.</p>} retireDescription="Students can no longer find or enroll in this offering. A retired offering can't be republished." retiredNote="Retired — can't be republished." onDone={setNotice} /> },
  ];

  return <>
    <PageHeader eyebrow="Admin" title="Offerings" description="Browse faculties, choose a department, then manage its course offerings." />
    <nav aria-label="Offering hierarchy" className="mb-6"><ol className="flex flex-wrap items-center gap-2 text-sm">
      <li>{faculty ? <Link href={destination()} className="font-semibold text-brand-primary underline-offset-4 hover:underline">Faculties</Link> : <span aria-current="page" className="font-semibold">Faculties</span>}</li>
      {faculty && <><li aria-hidden><ChevronRight className="size-4 text-ink-muted" /></li><li>{department ? <Link href={destination(faculty)} className="font-semibold text-brand-primary underline-offset-4 hover:underline">{selectedFaculty?.name ?? "Faculty"}</Link> : <span aria-current="page">{selectedFaculty?.name ?? "Faculty"}</span>}</li></>}
      {department && <><li aria-hidden><ChevronRight className="size-4 text-ink-muted" /></li><li><span aria-current="page">{selectedDepartment?.name ?? "Department"}</span></li></>}
    </ol></nav>
    {notice && <Alert tone="success" role="status" className="mb-6" action={<Button variant="link" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice}</Alert>}
    {query.isPending ? <LoadingState label="Loading offerings..." /> : query.isError ? <AdminErrorState error={query.error} onRetry={() => void query.refetch()} /> : !rows.length ? <EmptyState title="No offerings yet" description="Course offerings are created by the content seed or database migrations." /> : (faculty && !selectedFaculty) || (department && (!faculty || !selectedDepartment)) ? <EmptyState title="This location is unavailable" description="The faculty or department could not be found in the current offerings." action={<Button asChild><Link href={destination()}>Browse faculties</Link></Button>} /> : !faculty ? <section aria-labelledby="faculties-title">
      <div className="mb-5"><h2 id="faculties-title" className="text-xl font-bold">Choose a faculty</h2><p className="mt-1 text-sm text-ink-muted">{faculties.length} faculties · {rows.length} offerings. Open a faculty to see its departments.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{faculties.map(item => <Link key={item.id} href={destination(item.id)} className="group flex min-w-0 flex-col gap-4 rounded-card border border-line bg-surface-card p-5 shadow-card transition-colors hover:border-brand-primary">
        <div className="flex items-start justify-between gap-3"><Building2 className="size-6 shrink-0 text-brand-primary" aria-hidden /><ArrowRight className="size-5 shrink-0 text-ink-muted group-hover:text-brand-primary" aria-hidden /></div><div><h3 className="text-lg font-bold">{item.name}</h3><p className="mt-1 text-sm text-ink-muted">{item.university}</p></div><p className="mt-auto text-sm font-semibold">{new Set(item.rows.map(departmentId)).size} departments · {item.rows.length} offerings</p>
      </Link>)}</div>
    </section> : !department ? <section aria-labelledby="departments-title">
      <Link href={destination()} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-primary"><ArrowLeft className="size-4" aria-hidden />All faculties</Link>
      <div className="mb-5"><p className="text-sm text-ink-muted">{selectedFaculty?.university}</p><h2 id="departments-title" className="text-xl font-bold">{selectedFaculty?.name}</h2><p className="mt-1 text-sm text-ink-muted">Choose one of {departments.length} departments to view its courses.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{departments.map(item => <Link key={item.id} href={destination(faculty, item.id)} className="group flex min-w-0 items-start gap-4 rounded-card border border-line bg-surface-card p-5 shadow-card transition-colors hover:border-brand-primary"><GraduationCap className="mt-1 size-6 shrink-0 text-brand-primary" aria-hidden /><div className="min-w-0 flex-1"><h3 className="text-lg font-bold">{item.name}</h3><p className="mt-2 text-sm text-ink-muted">{item.rows.length} offerings · {new Set(item.rows.map(row => row.level?.id).filter(Boolean)).size} levels</p><p className="mt-2 text-sm font-semibold text-brand-primary">View course offerings</p></div><ArrowRight className="mt-1 size-5 shrink-0 text-ink-muted" aria-hidden /></Link>)}</div>
    </section> : <section aria-labelledby="department-offerings-title">
      <Link href={destination(faculty ?? undefined)} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-primary"><ArrowLeft className="size-4" aria-hidden />Back to departments</Link>
      <div className="mb-5 rounded-card border border-line bg-surface-card p-5"><p className="text-sm text-ink-muted">{selectedFaculty?.university} · {selectedFaculty?.name}</p><h2 id="department-offerings-title" className="mt-1 text-xl font-bold">{selectedDepartment?.name}</h2><p className="mt-2 text-sm text-ink-muted">{departmentRows.length} offerings in this department. Filter by level, semester or status.</p></div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field id="offering-search" label="Find a course"><Input value={filters.search} placeholder="Course code or title" maxLength={200} onChange={event => updateFilters({ search: event.target.value })} /></Field>
        <Field id="offering-level" label="Level"><NativeSelect value={filters.level} onChange={event => updateFilters({ level: event.target.value })}><option value="">All levels</option>{levels.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect></Field>
        <Field id="offering-semester" label="Semester"><NativeSelect value={filters.semester} onChange={event => updateFilters({ semester: event.target.value })}><option value="">All semesters</option>{semesters.map(item => <option key={item.id} value={item.id}>{item.label}{item.period ? ` · ${item.period.label}` : ""}</option>)}</NativeSelect></Field>
        <Field id="offering-status" label="Status"><NativeSelect value={filters.status} onChange={event => updateFilters({ status: event.target.value })}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="retired">Retired</option></NativeSelect></Field>
        {(filters.search || filters.level || filters.semester || filters.status) && <Button variant="ghost" onClick={() => setFilters(defaults(scope))}>Clear filters</Button>}
      </div>
      {filtered.length ? <DataTable caption={`${selectedDepartment?.name} course offerings`} columns={columns} rows={visibleRows} rowKey={row => row.id} /> : <EmptyState title="No offerings match these filters" description="Try another course, level, semester or status." />}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p>{filtered.length ? currentPage * PAGE_SIZE + 1 : 0}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} offerings</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => updateFilters({ page: currentPage - 1 })}>Previous</Button><span>Page {currentPage + 1} of {pageCount}</span><Button variant="outline" size="sm" disabled={currentPage + 1 >= pageCount} onClick={() => updateFilters({ page: currentPage + 1 })}>Next</Button></div></div>
    </section>}
  </>;
}

export default function AdminOfferingsPage() {
  return <Suspense fallback={<LoadingState label="Loading offerings..." />}><OfferingsBrowser /></Suspense>;
}
