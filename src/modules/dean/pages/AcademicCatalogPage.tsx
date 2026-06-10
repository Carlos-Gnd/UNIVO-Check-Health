import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, GraduationCap, Loader2, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { PageHeader } from '@/shared/components/PageHeader';
import { HelpTooltip } from '@/shared/components/HelpTooltip';
import {
  fetchCareers, upsertCareer, deleteCareer, type Career,
  fetchSubjects, upsertSubject, deleteSubject, type Subject,
} from '@/modules/dean/services/catalog.service';

const EMPTY_CAREER = { id: undefined as string | undefined, name: '', totalCycles: 10, isActive: true };
const EMPTY_SUBJECT = {
  id: undefined as string | undefined,
  code: '', name: '', career: '', requiredHours: 240, minAcademicLevel: 1, isActive: true,
};

export function AcademicCatalogPage() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [careerForm, setCareerForm] = useState({ ...EMPTY_CAREER });
  const [subjectForm, setSubjectForm] = useState({ ...EMPTY_SUBJECT });
  const [savingCareer, setSavingCareer] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);

  const load = async () => {
    setIsLoading(true);
    const [c, s] = await Promise.all([fetchCareers(), fetchSubjects()]);
    setCareers(c);
    setSubjects(s);
    setIsLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const submitCareer = async (e: FormEvent) => {
    e.preventDefault();
    if (careerForm.name.trim().length < 3) { toast.error('Nombre de carrera inválido.'); return; }
    setSavingCareer(true);
    const result = await upsertCareer(careerForm);
    setSavingCareer(false);
    if (!result.ok) { toast.error(result.message ?? 'No se pudo guardar la carrera.'); return; }
    toast.success(careerForm.id ? 'Carrera actualizada.' : 'Carrera creada.');
    setCareerForm({ ...EMPTY_CAREER });
    void load();
  };

  const submitSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!subjectForm.code.trim() || subjectForm.name.trim().length < 3) { toast.error('Código y nombre de materia obligatorios.'); return; }
    setSavingSubject(true);
    const result = await upsertSubject({ ...subjectForm, career: subjectForm.career || null, minAcademicLevel: subjectForm.minAcademicLevel });
    setSavingSubject(false);
    if (!result.ok) { toast.error(result.message ?? 'No se pudo guardar la materia.'); return; }
    toast.success(subjectForm.id ? 'Materia actualizada.' : 'Materia creada.');
    setSubjectForm({ ...EMPTY_SUBJECT });
    void load();
  };

  const removeCareer = async (id: string) => {
    const result = await deleteCareer(id);
    if (!result.ok) { toast.error(result.message ?? 'No se pudo eliminar (¿en uso?).'); return; }
    toast.success('Carrera eliminada.');
    void load();
  };

  const toggleCareer = async (c: Career) => {
    const result = await upsertCareer({ id: c.id, name: c.name, totalCycles: c.totalCycles, isActive: !c.isActive });
    if (!result.ok) { toast.error(result.message ?? 'No se pudo cambiar el estado.'); return; }
    toast.success(c.isActive ? 'Carrera desactivada.' : 'Carrera activada.');
    void load();
  };

  const removeSubject = async (id: string) => {
    const result = await deleteSubject(id);
    if (!result.ok) { toast.error(result.message ?? 'No se pudo eliminar (¿en uso?).'); return; }
    toast.success('Materia eliminada.');
    void load();
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /><span>Cargando catálogo…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo académico"
        description="Gestiona las carreras (y sus ciclos) y las materias de práctica."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Carreras ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4 text-brand-700" />Carreras
              <HelpTooltip text="El número de ciclos define cuántos niveles académicos tiene la carrera. Medicina, al ser de larga duración, usa más ciclos." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitCareer} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-brand-700">Nombre</Label>
                <Input value={careerForm.name} onChange={(e) => setCareerForm({ ...careerForm, name: e.target.value })} placeholder="Medicina" />
              </div>
              <div className="space-y-1 w-24">
                <Label className="text-xs uppercase tracking-wide text-brand-700">Ciclos</Label>
                <Input type="number" min={1} max={20} value={careerForm.totalCycles}
                  onChange={(e) => setCareerForm({ ...careerForm, totalCycles: Number(e.target.value) })} />
              </div>
              <Button type="submit" disabled={savingCareer} className="bg-brand-700 hover:bg-brand-800 text-white">
                {savingCareer ? <Loader2 className="h-4 w-4 animate-spin" /> : careerForm.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </Button>
            </form>
            {careerForm.id && (
              <button type="button" onClick={() => setCareerForm({ ...EMPTY_CAREER })} className="text-xs text-gray-500 hover:underline flex items-center gap-1">
                <X className="h-3 w-3" />Cancelar edición
              </button>
            )}
            <ul className="divide-y divide-gray-100 rounded-lg border">
              {careers.length === 0 && <li className="p-3 text-sm text-gray-400">Sin carreras.</li>}
              {careers.map((c) => (
                <li key={c.id} className={`flex items-center justify-between gap-2 p-3 text-sm ${!c.isActive ? 'opacity-60' : ''}`}>
                  <span className="text-gray-800">{c.name} <span className="text-gray-400">· {c.totalCycles} ciclos</span>{!c.isActive && <span className="ml-1 text-amber-600">(inactiva)</span>}</span>
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" title={c.isActive ? 'Desactivar' : 'Activar'} onClick={() => void toggleCareer(c)}>
                      <Power className={`h-4 w-4 ${c.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCareerForm({ id: c.id, name: c.name, totalCycles: c.totalCycles, isActive: c.isActive })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => void removeCareer(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── Materias ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-brand-700" />Materias de práctica
              <HelpTooltip text="Cada materia define sus horas requeridas y el nivel académico mínimo para cursarla. La asignación valida que el alumno cumpla ese nivel." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitSubject} className="space-y-3">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-brand-700">Código</Label>
                  <Input value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })} placeholder="MED-101" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-brand-700">Nombre</Label>
                  <Input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="Práctica clínica I" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-brand-700">Carrera</Label>
                  <Select value={subjectForm.career} onValueChange={(v) => setSubjectForm({ ...subjectForm, career: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {careers.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-brand-700">Horas req.</Label>
                  <Input type="number" min={1} value={subjectForm.requiredHours} onChange={(e) => setSubjectForm({ ...subjectForm, requiredHours: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-brand-700">Nivel mín.</Label>
                  <Input type="number" min={0} max={20} value={subjectForm.minAcademicLevel ?? 0} onChange={(e) => setSubjectForm({ ...subjectForm, minAcademicLevel: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={savingSubject} className="bg-brand-700 hover:bg-brand-800 text-white">
                  {savingSubject ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : subjectForm.id ? <Pencil className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                  {subjectForm.id ? 'Actualizar materia' : 'Agregar materia'}
                </Button>
                {subjectForm.id && (
                  <button type="button" onClick={() => setSubjectForm({ ...EMPTY_SUBJECT })} className="text-xs text-gray-500 hover:underline flex items-center gap-1">
                    <X className="h-3 w-3" />Cancelar
                  </button>
                )}
              </div>
            </form>
            <ul className="divide-y divide-gray-100 rounded-lg border">
              {subjects.length === 0 && <li className="p-3 text-sm text-gray-400">Sin materias.</li>}
              {subjects.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-brand-700">{s.code}</span> <span className="text-gray-800">{s.name}</span>
                    <span className="block text-xs text-gray-400">{s.career ?? 'Sin carrera'} · {s.requiredHours}h · nivel ≥ {s.minAcademicLevel ?? 0}{!s.isActive && ' · inactiva'}</span>
                  </span>
                  <span className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setSubjectForm({ id: s.id, code: s.code, name: s.name, career: s.career ?? '', requiredHours: s.requiredHours, minAcademicLevel: s.minAcademicLevel ?? 0, isActive: s.isActive })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => void removeSubject(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
