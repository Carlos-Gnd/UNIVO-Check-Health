import { createBrowserRouter } from 'react-router';
import { MainLayout } from '@/shared/components/MainLayout';
import { Dashboard } from '@/modules/dashboard/components/Dashboard';
import { CheckIn } from '@/modules/attendance/components/CheckIn';
import { Students } from '@/modules/students/components/Students';
import { Practices } from '@/modules/practices/components/Practices';
import { Reports } from '@/modules/reports/components/Reports';
import { NotFound } from '@/shared/components/NotFound';
import { DeanDashboardPage } from '@/modules/dean/pages/DeanDashboardPage';
import { DeanStudentsPage } from '@/modules/dean/pages/DeanStudentsPage';
import { DeanLocationsPage } from '@/modules/dean/pages/DeanLocationsPage';
import { DeanJustificationsPage } from '@/modules/dean/pages/DeanJustificationsPage';
import { DeanAssignmentsPage } from '@/modules/dean/pages/DeanAssignmentsPage';
import { UserManagement } from '@/modules/admin/components/UserManagement';
import { RotationsCalendarPage } from '@/modules/rotations/components/RotationsCalendarPage';
import { RoleGuard } from '@/shared/components/RoleGuard';
import { PlaceholderPage } from '@/shared/components/PlaceholderPage';
import { StudentQrScannerPage } from '@/modules/students/components/StudentQrScannerPage';
import { StudentProgressPage } from '@/modules/students/components/StudentProgressPage';
import { StudentHistoryPage } from '@/modules/students/components/StudentHistoryPage';
import { StudentJustificationsPage } from '@/modules/students/components/StudentJustificationsPage';
import { StudentAssignmentPage } from '@/modules/students/components/StudentAssignmentPage';

const DeanDashboardRoute = () => (
  <RoleGuard allow={['ADMIN']}>
    <DeanDashboardPage />
  </RoleGuard>
);

const DeanStudentsRoute = () => (
  <RoleGuard allow={['ADMIN']}>
    <DeanStudentsPage />
  </RoleGuard>
);

const DeanLocationsRoute = () => (
  <RoleGuard allow={['ADMIN']}>
    <DeanLocationsPage />
  </RoleGuard>
);

const DeanJustificationsRoute = () => (
  <RoleGuard allow={['ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE']}>
    <DeanJustificationsPage />
  </RoleGuard>
);

const UsersRoute = () => (
  <RoleGuard allow={['ADMIN']}>
    <UserManagement />
  </RoleGuard>
);

const AssignmentsRoute = () => (
  <RoleGuard allow={['ADMIN', 'COORDINATOR', 'COORDINADOR']}>
    <DeanAssignmentsPage />
  </RoleGuard>
);

const StudentQrRoute = () => (
  <RoleGuard allow={['STUDENT']}>
    <StudentQrScannerPage />
  </RoleGuard>
);

const StudentHistoryRoute = () => (
  <RoleGuard allow={['STUDENT']}>
    <StudentHistoryPage />
  </RoleGuard>
);

const StudentProgressRoute = () => (
  <RoleGuard allow={['STUDENT']}>
    <StudentProgressPage />
  </RoleGuard>
);

const StudentJustificationsRoute = () => (
  <RoleGuard allow={['STUDENT']}>
    <StudentJustificationsPage />
  </RoleGuard>
);

const StudentAssignmentRoute = () => (
  <RoleGuard allow={['STUDENT']}>
    <StudentAssignmentPage />
  </RoleGuard>
);

// Rutas del Docente (T-00.1). Las páginas reales las completan T-23.1, T-26.2 y T-28.1.
const TeacherDashboardRoute = () => (
  <RoleGuard allow={['DOCENTE', 'TEACHER']}>
    <PlaceholderPage title="Mapa de mi grupo" note="El mapa de estudiantes activos de tu grupo se integrará en HU-23." />
  </RoleGuard>
);

const TeacherEvaluationsRoute = () => (
  <RoleGuard allow={['DOCENTE', 'TEACHER']}>
    <PlaceholderPage title="Evaluación semanal" note="El formulario de evaluación cualitativa se integrará en HU-26." />
  </RoleGuard>
);

const TeacherHistoryRoute = () => (
  <RoleGuard allow={['DOCENTE', 'TEACHER']}>
    <PlaceholderPage title="Historial de decisiones" note="El historial de decisiones de incidencias se integrará en HU-28." />
  </RoleGuard>
);

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'checkin', Component: CheckIn },
      { path: 'students', Component: Students },
      { path: 'practices', Component: Practices },
      { path: 'reports', Component: Reports },
      { path: 'users', Component: UsersRoute },
      { path: 'rotations', Component: RotationsCalendarPage },
      { path: 'student/qr', Component: StudentQrRoute },
      { path: 'student/history', Component: StudentHistoryRoute },
      { path: 'student/progress', Component: StudentProgressRoute },
      { path: 'student/justifications', Component: StudentJustificationsRoute },
      { path: 'student/assignment', Component: StudentAssignmentRoute },
      { path: 'dean/dashboard', Component: DeanDashboardRoute },
      { path: 'dean/students', Component: DeanStudentsRoute },
      { path: 'dean/locations', Component: DeanLocationsRoute },
      { path: 'dean/justifications', Component: DeanJustificationsRoute },
      { path: 'dean/assignments', Component: AssignmentsRoute },
      { path: 'teacher/dashboard', Component: TeacherDashboardRoute },
      { path: 'teacher/evaluations', Component: TeacherEvaluationsRoute },
      { path: 'teacher/history', Component: TeacherHistoryRoute },
      { path: '*', Component: NotFound },
    ],
  },
]);
