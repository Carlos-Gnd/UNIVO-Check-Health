import { createBrowserRouter } from 'react-router';
import { MainLayout } from '@/shared/components/MainLayout';
import { Dashboard } from '@/modules/dashboard/components/Dashboard';
import { CheckIn } from '@/modules/attendance/components/CheckIn';
import { Students } from '@/modules/students/components/Students';
import { Practices } from '@/modules/practices/components/Practices';
import { Reports } from '@/modules/reports/components/Reports';
import { NotFound } from '@/shared/components/NotFound';

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
      { path: '*', Component: NotFound },
    ],
  },
]);
