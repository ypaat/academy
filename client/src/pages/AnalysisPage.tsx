import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { AnalysisBoard } from "@/components/AnalysisBoard";

export function AnalysisPage() {
  const [_, setLocation] = useLocation();

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
          <h1 className="text-3xl font-bold">Chess Analysis</h1>
        </div>
        <AnalysisBoard />
      </div>
    </div>
  );
}