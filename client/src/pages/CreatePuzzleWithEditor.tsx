import { useState } from 'react';
import { useLocation } from 'wouter';
import { BoardEditor } from '../components/BoardEditor';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export function CreatePuzzleWithEditor() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSavePuzzle = async (fen: string, solution: string[], themes: string[]) => {
    try {
      const response = await apiRequest("POST", "/api/puzzles", {
        fen: fen,
        solution: solution,
        themes: themes,
        difficulty: 'medium', // Default difficulty
      });

      toast({
        title: 'Success',
        description: 'Puzzle created successfully!',
      });

      // Don't navigate away after creating puzzle
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create puzzle. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="group"
        >
          <ChevronLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold">Create Puzzle with Board Editor</h1>
      </div>
      <Card className="p-6">
        <BoardEditor onSavePuzzle={handleSavePuzzle} />
      </Card>
    </div>
  );
}