import { createBrowserRouter } from "react-router";
import { MainLayout } from "./components/MainLayout";
import { Dashboard } from "./components/Dashboard";
import { CheckIn } from "./components/CheckIn";
import { Students } from "./components/Students";
import { Practices } from "./components/Practices";
import { Reports } from "./components/Reports";
import { NotFound } from "./components/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "checkin", Component: CheckIn },
      { path: "students", Component: Students },
      { path: "practices", Component: Practices },
      { path: "reports", Component: Reports },
      { path: "*", Component: NotFound },
    ],
  },
]);
