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
      { path: 'dean/dashboard', Component: DeanDashboardPage },
      { path: 'dean/students', Component: DeanStudentsPage },
      { path: 'dean/locations', Component: DeanLocationsPage },
      { path: '*', Component: NotFound },
    ],
  },
]);
