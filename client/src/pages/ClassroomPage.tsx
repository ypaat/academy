import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ClassroomBoard } from "@/components/ClassroomBoard";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

export function ClassroomPage() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isCoach = user?.role === 'coach';

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6 max-w-[1400px] mx-auto px-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="group"
          >
            <ChevronLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">
            {isCoach ? "Classroom Analysis" : "Classroom View"}
          </h1>
        </div>
        <ClassroomBoard
          isCoach={isCoach}
          classId={params.id}
        />
      </div>
    </div>
  );
}
