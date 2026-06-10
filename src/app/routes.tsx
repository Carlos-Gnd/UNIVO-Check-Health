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
import { IncidentsDashboardPage } from '@/modules/dean/pages/IncidentsDashboardPage';
import { HolidaysPage } from '@/modules/dean/pages/HolidaysPage';
import { AcademicCatalogPage } from '@/modules/dean/pages/AcademicCatalogPage';
import { UserManagement } from '@/modules/admin/components/UserManagement';
import { RotationsCalendarPage } from '@/modules/rotations/components/RotationsCalendarPage';
import { RoleGuard } from '@/shared/components/RoleGuard';
import { PlaceholderPage } from '@/shared/components/PlaceholderPage';
import { StudentQrScannerPage } from '@/modules/students/components/StudentQrScannerPage';
import { StudentDashboardPage } from '@/modules/students/components/StudentDashboardPage';
import { StudentProgressPage } from '@/modules/students/components/StudentProgressPage';
import { StudentHistoryPage } from '@/modules/students/components/StudentHistoryPage';
import { StudentJustificationsPage } from '@/modules/students/components/StudentJustificationsPage';
import { StudentAssignmentPage } from '@/modules/students/components/StudentAssignmentPage';
import { TeacherDecisionHistoryPage } from '@/modules/teacher/pages/TeacherDecisionHistoryPage';
import { TeacherDashboardPage } from '@/modules/teacher/pages/TeacherDashboardPage';
import { TeacherEvaluationsPage } from '@/modules/teacher/pages/TeacherEvaluationsPage';
import { HospitalLivePage } from '@/modules/hospital/pages/HospitalLivePage';
import { HospitalIncidentsPage } from '@/modules/hospital/pages/HospitalIncidentsPage';
import { RecoveryPage } from '@/modules/auth/RecoveryPage';
import { PrivacyPolicyPage, CookiesPolicyPage, TermsPage } from '@/modules/legal/legalContent';
import { ProfilePage } from '@/modules/profile/ProfilePage';

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
  <RoleGuard allow={['ADMIN', 'TEACHER', 'DOCENTE']}>
    <DeanLocationsPage />
  </RoleGuard>
);

const DeanJustificationsRoute = () => (
  <RoleGuard allow={['ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE']}>
    <DeanJustificationsPage />
  </RoleGuard>
);

const IncidentsDashboardRoute = () => (
  <RoleGuard allow={['ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE']}>
    <IncidentsDashboardPage />
  </RoleGuard>
);

const UsersRoute = () => (
  <RoleGuard allow={['ADMIN', 'TEACHER', 'DOCENTE']}>
    <UserManagement />
  </RoleGuard>
);

const AssignmentsRoute = () => (
  <RoleGuard allow={['ADMIN', 'COORDINATOR', 'COORDINADOR']}>
    <DeanAssignmentsPage />
  </RoleGuard>
);

const HolidaysRoute = () => (
  <RoleGuard allow={['ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE']}>
    <HolidaysPage />
  </RoleGuard>
);

const CatalogRoute = () => (
  <RoleGuard allow={['ADMIN', 'COORDINATOR', 'COORDINADOR']}>
    <AcademicCatalogPage />
  </RoleGuard>
);

const StudentDashboardRoute = () => (
  <RoleGuard allow={['STUDENT']}>
    <StudentDashboardPage />
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

// Rutas del Docente (T-00.1).
const TeacherDashboardRoute = () => (
  <RoleGuard allow={['DOCENTE', 'TEACHER']}>
    <TeacherDashboardPage />
  </RoleGuard>
);

const TeacherEvaluationsRoute = () => (
  <RoleGuard allow={['DOCENTE', 'TEACHER']}>
    <TeacherEvaluationsPage />
  </RoleGuard>
);

const TeacherHistoryRoute = () => (
  <RoleGuard allow={['DOCENTE', 'TEACHER']}>
    <TeacherDecisionHistoryPage />
  </RoleGuard>
);

// Rutas del Representante Hospitalario (HU-38 / HU-40).
const HospitalLiveRoute = () => (
  <RoleGuard allow={['REPRESENTATIVE']}>
    <HospitalLivePage />
  </RoleGuard>
);

const HospitalIncidentsRoute = () => (
  <RoleGuard allow={['REPRESENTATIVE']}>
    <HospitalIncidentsPage />
  </RoleGuard>
);

export const router = createBrowserRouter([
  { path: '/auth/recovery', Component: RecoveryPage },
  { path: '/legal/privacy', Component: PrivacyPolicyPage },
  { path: '/legal/cookies', Component: CookiesPolicyPage },
  { path: '/legal/terms', Component: TermsPage },
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
      { path: 'profile', Component: ProfilePage },
      { path: 'rotations', Component: RotationsCalendarPage },
      { path: 'student/dashboard', Component: StudentDashboardRoute },
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
      { path: 'dean/holidays', Component: HolidaysRoute },
      { path: 'dean/catalog', Component: CatalogRoute },
      { path: 'dean/incidents', Component: IncidentsDashboardRoute },
      { path: 'teacher/dashboard', Component: TeacherDashboardRoute },
      { path: 'teacher/evaluations', Component: TeacherEvaluationsRoute },
      { path: 'teacher/history', Component: TeacherHistoryRoute },
      { path: 'hospital/live', Component: HospitalLiveRoute },
      { path: 'hospital/incidents', Component: HospitalIncidentsRoute },
      { path: '*', Component: NotFound },
    ],
  },
]);
