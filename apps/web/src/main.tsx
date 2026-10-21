import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { Layout } from "./Layout.tsx";
import { AdminPage } from "./pages/admin/AdminPage.tsx";
import { TripFormPage } from "./pages/admin/TripFormPage.tsx";
import { DestinationPage } from "./pages/DestinationPage.tsx";
import { EditAccommodationPage } from "./pages/EditAccommodationPage.tsx";
import { EditDestinationPage } from "./pages/EditDestinationPage.tsx";
import { JoinPage } from "./pages/JoinPage.tsx";
import { LandingPage } from "./pages/LandingPage.tsx";
import { NewAccommodationPage } from "./pages/NewAccommodationPage.tsx";
import { NewDestinationPage } from "./pages/NewDestinationPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { TripPage } from "./pages/TripPage.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/t/:tripId", element: <TripPage /> },
      { path: "/t/:tripId/join", element: <JoinPage /> },
      { path: "/t/:tripId/new-destination", element: <NewDestinationPage /> },
      { path: "/d/:destinationId", element: <DestinationPage /> },
      { path: "/d/:destinationId/edit", element: <EditDestinationPage /> },
      { path: "/d/:destinationId/new-accommodation", element: <NewAccommodationPage /> },
      { path: "/a/:accommodationId/edit", element: <EditAccommodationPage /> },
      { path: "/admin", element: <AdminPage /> },
      { path: "/admin/trips/new", element: <TripFormPage /> },
      { path: "/admin/trips/:tripId", element: <TripFormPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
