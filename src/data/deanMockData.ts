import type { DeanStudent, DeanAttendance, Location } from '@/modules/dean/types';

const locationSeeds = [
  {
    id: 'loc-rosales',
    name: 'Hospital Nacional Rosales',
    address: '25 Avenida Norte, San Salvador',
    coordinates: { lat: 13.7035, lng: -89.2094 },
    allowedRadiusMeters: 220,
    doctorName: 'Dra. Patricia Molina de Hernández',
    doctorStatus: 'active' as const,
    status: 'active' as const,
  },
  {
    id: 'loc-bloom',
    name: 'Hospital Nacional de Niños Benjamín Bloom',
    address: 'Final 25 Av. Norte y Boulevard de los Héroes, San Salvador',
    coordinates: { lat: 13.7109, lng: -89.2024 },
    allowedRadiusMeters: 180,
    doctorName: 'Dr. Mauricio Alberto Quintanilla',
    doctorStatus: 'active' as const,
    status: 'active' as const,
  },
  {
    id: 'loc-sanjuan',
    name: 'Hospital Nacional San Juan de Dios',
    address: '10a Calle Oriente, Santa Ana',
    coordinates: { lat: 13.9941, lng: -89.5597 },
    allowedRadiusMeters: 250,
    doctorName: 'Dra. Silvia Maribel Escobar',
    doctorStatus: 'active' as const,
    status: 'active' as const,
  },
  {
    id: 'loc-soyapango',
    name: 'Unidad de Salud Soyapango',
    address: 'Boulevard del Ejército, Soyapango, San Salvador',
    coordinates: { lat: 13.7046, lng: -89.1522 },
    allowedRadiusMeters: 150,
    doctorName: 'Dr. José Armando Claros',
    doctorStatus: 'active' as const,
    status: 'active' as const,
  },
];

const studentSeeds = [
  ['st-01', 'MS22001', 'Ana Lucía Ramírez', 'Medicina', 'loc-rosales', 41, 120, 9],
  ['st-02', 'EN22044', 'Carlos Ernesto García', 'Enfermería', 'loc-rosales', 68, 120, 5],
  ['st-03', 'OD22018', 'Daniela Sofía Pineda', 'Odontología', 'loc-bloom', 96, 120, 2],
  ['st-04', 'MS22009', 'Jorge Luis Chávez', 'Medicina', 'loc-bloom', 78, 120, 4],
  ['st-05', 'EN22032', 'Valeria Meléndez', 'Enfermería', 'loc-sanjuan', 110, 120, 1],
  ['st-06', 'MS22014', 'Ricardo Antonio Orellana', 'Medicina', 'loc-sanjuan', 85, 120, 3],
  ['st-07', 'OD22003', 'Karla Ivette Flores', 'Odontología', 'loc-soyapango', 33, 120, 11],
  ['st-08', 'EN22056', 'Kevin Eduardo Campos', 'Enfermería', 'loc-soyapango', 74, 120, 4],
  ['st-09', 'MS22022', 'María Fernanda Guevara', 'Medicina', 'loc-rosales', 104, 120, 2],
  ['st-10', 'EN22061', 'Héctor Antonio Merino', 'Enfermería', 'loc-bloom', 70, 120, 6],
  ['st-11', 'MS22027', 'Paola Andrea Romero', 'Medicina', 'loc-sanjuan', 88, 120, 3],
  ['st-12', 'OD22011', 'Luis Fernando Benítez', 'Odontología', 'loc-soyapango', 55, 120, 7],
  ['st-13', 'EN22015', 'Andrea Marcela Alvarado', 'Enfermería', 'loc-rosales', 118, 120, 1],
  ['st-14', 'MS22031', 'Sebastián Eliseo Mejía', 'Medicina', 'loc-bloom', 72, 120, 5],
  ['st-15', 'OD22024', 'Gabriela Noemí Durán', 'Odontología', 'loc-sanjuan', 47, 120, 10],
  ['st-16', 'EN22073', 'Óscar David Hernández', 'Enfermería', 'loc-soyapango', 83, 120, 3],
  ['st-17', 'MS22039', 'Melissa Abigail Rivas', 'Medicina', 'loc-rosales', 92, 120, 2],
  ['st-18', 'OD22030', 'Cristian Alejandro Portillo', 'Odontología', 'loc-bloom', 62, 120, 6],
] as const;

function buildAttendances(studentName: string, sedeName: string, riskBias: number): DeanAttendance[] {
  const records: DeanAttendance[] = [];
  const now = new Date();
  for (let i = 0; i < 16; i += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i * 2);
    const date = day.toISOString().slice(0, 10);
    const status = (i + riskBias) % 7 === 0 ? 'absent' : (i + riskBias) % 5 === 0 ? 'review' : 'valid';
    records.push({
      id: `${studentName.toLowerCase().replace(/\s+/g, '-')}-${i}`,
      date,
      checkInTime: status === 'absent' ? '--:--' : `${String(7 + (i % 3)).padStart(2, '0')}:${i % 2 === 0 ? '30' : '10'}`,
      sedeName,
      status,
    });
  }
  return records;
}

function toStatus(percentage: number): DeanStudent['status'] {
  if (percentage < 60) return 'at-risk';
  if (percentage > 85) return 'completed';
  return 'in-progress';
}

export const deanStudents: DeanStudent[] = studentSeeds.map((seed, index) => {
  const [id, carnet, fullName, career, sedeId, completedHours, goalHours, absences] = seed;
  const sede = locationSeeds.find((location) => location.id === sedeId)!;
  const compliancePercentage = Math.round((completedHours / goalHours) * 100);

  return {
    id,
    carnet,
    fullName,
    career,
    sedeId,
    sedeName: sede.name,
    doctorName: sede.doctorName,
    completedHours,
    goalHours,
    compliancePercentage,
    absences,
    status: toStatus(compliancePercentage),
    attendances: buildAttendances(fullName, sede.name, index + absences),
  };
});

export const deanLocations: Location[] = locationSeeds.map((seed) => {
  const students = deanStudents.filter((student) => student.sedeId === seed.id);
  const averageCompliance = students.length
    ? Math.round(students.reduce((acc, student) => acc + student.compliancePercentage, 0) / students.length)
    : 0;

  return {
    ...seed,
    totalStudents: students.length,
    averageCompliance,
    students,
  };
});
