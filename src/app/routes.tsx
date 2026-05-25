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
import { UserManagement } from '@/modules/admin/components/UserManagement';
import { RotationsCalendarPage } from '@/modules/rotations/components/RotationsCalendarPage';
import { RoleGuard } from '@/shared/components/RoleGuard';
import { StudentPlaceholderPage } from '@/modules/students/components/StudentPlaceholderPage';
import { StudentQrScannerPage } from '@/modules/students/components/StudentQrScannerPage';
import { StudentProgressPage } from '@/modules/students/components/StudentProgressPage';
import { StudentHistoryPage } from '@/modules/students/components/StudentHistoryPage';

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
    <StudentPlaceholderPage title="Justificaciones de inasistencia" />
  </RoleGuard>
);

const StudentAssignmentRoute = () => (
  <RoleGuard allow={['STUDENT']}>
    <StudentPlaceholderPage title="Mi sede y doctor encargado" />
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
      { path: '*', Component: NotFound },
    ],
  },
]);
