export interface Student {
  id: string;
  name: string;
  carnet: string;
  email: string;
  career: string;
  academicLevel: number | null;
  sedes: string[]; // sedes asignadas al alumno (vía teacher_groups)
  photo?: string;
}
