import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route } from "wouter";
import { ReactElement } from "react";

export function ProtectedRoute({
  path,
  component: Component,
  requireCoach = false,
}: {
  path: string;
  component: () => ReactElement;
  requireCoach?: boolean;
}) {
  const { user, isLoading } = useAuth();

  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        if (!user || (requireCoach && user.role !== "coach")) {
          window.location.href = "/auth";
          return null;
        }

        return <Component />;
      }}
    </Route>
  );
}