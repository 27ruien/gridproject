import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/app/layouts/AppLayout";
import { AdminGuard, AuthGuard } from "@/app/router/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { CostManagementPage } from "@/features/costs/CostManagementPage";
import { ForbiddenPage } from "@/features/feedback/ForbiddenPage";
import { NotFoundPage } from "@/features/feedback/NotFoundPage";
import { HomePage } from "@/features/home/HomePage";
import { PeopleManagementPage } from "@/features/people/PeopleManagementPage";
import { ProjectLibraryPage } from "@/features/projects/ProjectLibraryPage";
import { ProjectWorkspacePage } from "@/features/projects/ProjectWorkspacePage";
import { ProfileSettingsPage } from "@/features/profile/ProfileSettingsPage";
import { PlatformSettingsPage } from "@/features/settings/PlatformSettingsPage";
import { TimesheetListPage } from "@/features/timesheets/TimesheetListPage";
import { TimesheetPage } from "@/features/timesheets/TimesheetPage";
import { TrashPage } from "@/features/trash/TrashPage";
import { appBasePath } from "@/lib/env";

export const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    {
      element: <AuthGuard />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { index: true, element: <HomePage /> },
            { path: "projects", element: <ProjectLibraryPage /> },
            { path: "projects/:projectId", element: <ProjectWorkspacePage /> },
            { path: "timesheets", element: <TimesheetPage /> },
            { path: "timesheet-list", element: <TimesheetListPage /> },
            { path: "profile", element: <ProfileSettingsPage section="profile" /> },
            { path: "profile/security", element: <ProfileSettingsPage section="security" /> },
            { path: "trash", element: <TrashPage /> },
            { path: "forbidden", element: <ForbiddenPage /> },
            {
              element: <AdminGuard />,
              children: [
                { path: "costs", element: <CostManagementPage /> },
                { path: "people", element: <PeopleManagementPage /> },
                { path: "settings", element: <PlatformSettingsPage /> },
              ],
            },
          ],
        },
      ],
    },
    { path: "*", element: <NotFoundPage /> },
  ],
  { basename: appBasePath() },
);
