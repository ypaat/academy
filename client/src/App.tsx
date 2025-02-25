import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import { CreatePuzzleWithEditor } from "@/pages/CreatePuzzleWithEditor";
import { AnalysisPage } from "@/pages/AnalysisPage";
import { PuzzleAnalysisPage } from "@/pages/PuzzleAnalysisPage";
import { ClassroomPage } from "@/pages/ClassroomPage";
import Preferences from "@/pages/preferences";
import StudentPreferences from "@/pages/student-preferences";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import React from 'react';

function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute 
        path="/" 
        component={() => (
          user?.role === "student" ? <StudentDashboard /> : <Dashboard />
        )} 
      />
      <ProtectedRoute 
        path="/create-puzzle/editor" 
        component={CreatePuzzleWithEditor}
        requireCoach={true}
      />
      <ProtectedRoute 
        path="/analysis" 
        component={AnalysisPage}
      />
      <ProtectedRoute 
        path="/puzzle-analysis" 
        component={PuzzleAnalysisPage}
      />
      <ProtectedRoute 
        path="/classroom/:id" 
        component={ClassroomPage}
      />
      <ProtectedRoute 
        path="/preferences" 
        component={() => (
          user?.role === "student" ? <StudentPreferences /> : <Preferences />
        )}
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <React.StrictMode>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </React.StrictMode>
    </QueryClientProvider>
  );
}

export default App;