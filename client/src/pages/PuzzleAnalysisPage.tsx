import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { PuzzleAnalysisBoard } from "@/components/PuzzleAnalysisBoard";

export function PuzzleAnalysisPage() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const fen = searchParams.get('fen') || '';
  const pgn = searchParams.get('pgn') || '';

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
          <h1 className="text-3xl font-bold">Puzzle Analysis</h1>
        </div>
        <PuzzleAnalysisBoard fen={fen} pgn={pgn} />
      </div>
    </div>
  );
}
