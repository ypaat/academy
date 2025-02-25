import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Play, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation, Link } from 'wouter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface StudentPuzzle {
  _id: string;
  puzzleId: string;
  completed: boolean;
  assignedAt: string;
  puzzle: {
    fen: string;
    solution: string[];
    themes: string[];
  };
  attempts?: {
    moves: string[];
    timestamp: string;
  }[];
}

interface StudentPuzzleProps {
  studentId: string;
  studentName: string;
  onBack: () => void;
}

type TimePeriod = '30' | '90' | '180' | '365' | 'all';

const timeOptions = [
  { value: '30', label: 'Past 30 Days' },
  { value: '90', label: 'Past 3 Months' },
  { value: '180', label: 'Past 6 Months' },
  { value: '365', label: 'Past 12 Months' },
  { value: 'all', label: 'All Time' },
];

const uciToSan = (uciMove: string, position: string): string => {
  try {
    const tempGame = new Chess(position);
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;
    const move = tempGame.move({ from, to, promotion });
    return move?.san || uciMove;
  } catch {
    return uciMove;
  }
};

interface SolutionPlayerProps {
  fen: string;
  solution: string[];
  onClose: () => void;
}

function SolutionPlayer({ fen, solution, onClose }: SolutionPlayerProps) {
  const [currentPosition, setCurrentPosition] = useState(fen);
  const [moveIndex, setMoveIndex] = useState(-1);
  const [boardWidth, setBoardWidth] = useState(560);
  const modalBoardRef = useRef<HTMLDivElement>(null);
  const game = useRef(new Chess(fen)).current;

  useEffect(() => {
    if (!modalBoardRef.current) return;

    const calculateModalBoardWidth = () => {
      if (!modalBoardRef.current) return;
      const containerWidth = modalBoardRef.current.offsetWidth;
      // Use 90% of container width on mobile, 80% on desktop
      const newWidth = Math.min(
        window.innerWidth < 768 ? containerWidth * 0.9 : containerWidth * 0.8,
        560 // Maximum width
      );
      setBoardWidth(Math.floor(newWidth));
    };

    calculateModalBoardWidth();

    const resizeObserver = new ResizeObserver(calculateModalBoardWidth);
    resizeObserver.observe(modalBoardRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const playNextMove = () => {
    if (moveIndex + 1 < solution.length) {
      const move = solution[moveIndex + 1];
      const from = move.substring(0, 2);
      const to = move.substring(2, 4);
      const promotion = move.length === 5 ? move[4] : undefined;
      game.move({ from, to, promotion });
      setCurrentPosition(game.fen());
      setMoveIndex(moveIndex + 1);
    }
  };

  const playPreviousMove = () => {
    if (moveIndex >= 0) {
      game.undo();
      setCurrentPosition(game.fen());
      setMoveIndex(moveIndex - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg shadow-lg p-6 w-full max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Solution Viewer</h3>
          <Button variant="ghost" onClick={onClose}>×</Button>
        </div>
        <div ref={modalBoardRef} className="w-full mx-auto mb-4">
          <Chessboard
            position={currentPosition}
            boardWidth={boardWidth}
          />
        </div>
        <div className="flex justify-center gap-2">
          <Button
            variant="default"
            onClick={playPreviousMove}
            disabled={moveIndex < 0}
            className="min-w-[40px] hover:bg-primary/90"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            onClick={playNextMove}
            disabled={moveIndex >= solution.length - 1}
            className="min-w-[40px] hover:bg-primary/90"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StudentPuzzles({ studentId, studentName, onBack }: StudentPuzzleProps) {
  const [activeTab, setActiveTab] = useState<'assigned' | 'completed'>('assigned');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30');
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(256);
  const [, setLocation] = useLocation();
  const [selectedPuzzle, setSelectedPuzzle] = useState<StudentPuzzle | null>(null);
  const [puzzleToDelete, setPuzzleToDelete] = useState<StudentPuzzle | null>(null);

  // Add resize observer
  useEffect(() => {
    if (!boardContainerRef.current) return;

    const calculateBoardWidth = () => {
      if (!boardContainerRef.current) return;
      const containerWidth = boardContainerRef.current.offsetWidth;
      // Use 30% of container width on desktop, 70% on mobile
      const newWidth = Math.min(
        window.innerWidth < 768 ? containerWidth * 0.7 : containerWidth * 0.3,
        400 // Maximum width
      );
      setBoardWidth(Math.floor(newWidth));
    };

    // Initial calculation
    calculateBoardWidth();

    // Set up resize observer
    const resizeObserver = new ResizeObserver(calculateBoardWidth);
    resizeObserver.observe(boardContainerRef.current);

    // Cleanup
    return () => resizeObserver.disconnect();
  }, []);

  const { data: puzzles, isLoading } = useQuery<StudentPuzzle[]>({
    queryKey: ["/api/students", studentId, "puzzles"],
    queryFn: async () => {
      const res = await fetch(`/api/students/${studentId}/puzzles`);
      if (!res.ok) throw new Error("Failed to fetch student puzzles");
      return res.json();
    },
  });

  const assignedPuzzles = puzzles?.filter(p => !p.completed) ?? [];

  const filterCompletedPuzzlesByTime = (puzzles: StudentPuzzle[]) => {
    if (timePeriod === 'all') return puzzles;

    const now = new Date();
    const cutoff = new Date(now.setDate(now.getDate() - parseInt(timePeriod)));

    return puzzles.filter(puzzle => {
      const completedDate = new Date(puzzle.assignedAt);
      return completedDate >= cutoff;
    });
  };

  const completedPuzzles = filterCompletedPuzzlesByTime(puzzles?.filter(p => p.completed) ?? []);
  const currentPuzzles = activeTab === 'assigned' ? assignedPuzzles : completedPuzzles;

  const virtualizer = useVirtualizer({
    count: currentPuzzles.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });

  const deletePuzzleMutation = useMutation({
    mutationFn: async (puzzleId: string) => {
      console.log("Deleting puzzle:", puzzleId, "for student:", studentId);
      const res = await apiRequest(
        "DELETE",
        `/api/students/${studentId}/puzzles/${puzzleId}`
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete puzzle");
      }
      return puzzleId;
    },
    onSuccess: (deletedPuzzleId) => {
      console.log("Successfully deleted puzzle:", deletedPuzzleId);
      // Force refetch the puzzles query
      queryClient.invalidateQueries({
        queryKey: ["/api/students", studentId, "puzzles"],
        exact: true,
        refetchType: "all"
      });
      setPuzzleToDelete(null);
    },
    onError: (error: Error) => {
      console.error("Failed to delete puzzle:", error);
    },
  });

  // Add effect to log when puzzles data changes
  useEffect(() => {
    console.log("Puzzles data updated:", puzzles);
  }, [puzzles]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const formatSolution = (puzzle: StudentPuzzle) => {
    try {
      let position = puzzle.puzzle.fen;
      return puzzle.puzzle.solution.map((move, index) => {
        try {
          const san = uciToSan(move, position);
          const tempGame = new Chess(position);
          const from = move.substring(0, 2);
          const to = move.substring(2, 4);
          const promotion = move.length === 5 ? move[4] : undefined;

          try {
            const validMove = tempGame.move({ from, to, promotion });
            if (!validMove) {
              console.warn(`Invalid move: ${move} in position ${position}`);
              return move; // Return UCI notation as fallback
            }
            position = tempGame.fen();
            const moveNumber = Math.floor(index / 2) + 1;
            return index % 2 === 0 ? `${moveNumber}. ${san}` : san;
          } catch (moveError) {
            console.warn(`Error making move: ${move}`, moveError);
            return move; // Return UCI notation as fallback
          }
        } catch (sanError) {
          console.warn(`Error converting move to SAN: ${move}`, sanError);
          return move; // Return UCI notation as fallback
        }
      }).join(' ');
    } catch (error) {
      console.error('Error formatting solution:', error);
      return 'Unable to display moves';
    }
  };

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className="space-y-6">
      {selectedPuzzle && (
        <SolutionPlayer
          fen={selectedPuzzle.puzzle.fen}
          solution={selectedPuzzle.puzzle.solution}
          onClose={() => setSelectedPuzzle(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="group"
          >
            <ChevronLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Students
          </Button>
          <h2 className="text-2xl font-bold">{studentName}'s Puzzles</h2>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'assigned' | 'completed')} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="assigned">
              Assigned ({assignedPuzzles.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedPuzzles.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === 'completed' && (
            <Select value={timePeriod} onValueChange={(value) => setTimePeriod(value as TimePeriod)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time period" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value={activeTab}>
          {currentPuzzles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {activeTab} puzzles {activeTab === 'completed' && timePeriod !== 'all' && `in the past ${timePeriod} days`}
            </div>
          ) : (
            <div ref={scrollRef} className="h-[600px] overflow-auto border rounded-lg bg-muted/50">
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualRows.map((virtualRow) => {
                  const puzzle = currentPuzzles[virtualRow.index];
                  if (!puzzle) return null;

                  // Get total attempts count
                  const attemptsCount = puzzle.attempts?.length || 0;

                  return (
                    <div
                      key={puzzle._id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute top-0 left-0 w-full"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <Card className="m-2">
                        <CardContent className="flex items-center gap-4 p-4">
                          <div ref={boardContainerRef} className="min-w-[128px]">
                            <Chessboard
                              position={puzzle.puzzle.fen}
                              boardWidth={boardWidth}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex flex-wrap gap-2 items-center">
                                {puzzle.puzzle.themes.map(theme => (
                                  <Badge key={theme} variant="secondary">{theme}</Badge>
                                ))}
                                <Badge variant="outline" className="ml-2">
                                  {attemptsCount} {attemptsCount === 1 ? 'attempt' : 'attempts'}
                                </Badge>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedPuzzle(puzzle)}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Play Solution
                                </Button>
                                <Link
                                  to={`/puzzle-analysis?fen=${encodeURIComponent(puzzle.puzzle.fen)}&pgn=${encodeURIComponent(formatSolution(puzzle))}`}
                                >
                                  <Button
                                    variant="outline"
                                    size="sm"
                                  >
                                    Analysis Board
                                  </Button>
                                </Link>
                                {!puzzle.completed && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setPuzzleToDelete(puzzle)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {puzzle.completed ? 'Completed' : 'Assigned'}: {new Date(puzzle.assignedAt).toLocaleDateString()}
                            </p>
                            <div className="mt-2 font-mono text-sm bg-muted/50 p-2 rounded">
                              Solution: {formatSolution(puzzle)}
                            </div>
                            {puzzle.attempts && puzzle.attempts.length > 0 && (
                              <div className="space-y-2 mt-4">
                                <h4 className="font-medium">Attempts</h4>
                                <div className="space-y-1">
                                  {puzzle.attempts.map((attempt, attemptIndex) => (
                                    <div
                                      key={attemptIndex}
                                      className="flex items-center gap-2 text-sm p-2 rounded"
                                    >
                                      {attemptIndex === puzzle.attempts!.length - 1 && puzzle.completed ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      )}
                                      <span className="text-muted-foreground mr-2">
                                        Attempt {attemptIndex + 1}:
                                      </span>
                                      <span className="font-mono">
                                        {attempt.moves.map((move, moveIndex) => {
                                          try {
                                            const moveNumber = Math.floor(moveIndex / 2) + 1;
                                            const isPlayerMove = moveIndex % 2 === 0;
                                            const prevMoves = attempt.moves.slice(0, moveIndex);
                                            let position = puzzle.puzzle.fen;
                                            const game = new Chess(position);

                                            // Apply previous moves
                                            for (const m of prevMoves) {
                                              try {
                                                const from = m.substring(0, 2);
                                                const to = m.substring(2, 4);
                                                const promotion = m.length === 5 ? m[4] : undefined;
                                                const validMove = game.move({ from, to, promotion });
                                                if (!validMove) {
                                                  console.warn(`Invalid previous move: ${m}`);
                                                  break;
                                                }
                                              } catch (prevMoveError) {
                                                console.warn(`Error applying previous move: ${m}`, prevMoveError);
                                                break;
                                              }
                                            }

                                            let san;
                                            try {
                                              san = uciToSan(move, game.fen());
                                            } catch (sanError) {
                                              console.warn(`Error converting move to SAN: ${move}`, sanError);
                                              san = move; // Fallback to UCI notation
                                            }

                                            return (
                                              <span key={moveIndex}>
                                                {isPlayerMove ? `${moveNumber}. ` : ''}
                                                {san}
                                                {moveIndex < attempt.moves.length - 1 ? ' ' : ''}
                                              </span>
                                            );
                                          } catch (error) {
                                            console.error(`Error processing move ${move}:`, error);
                                            return (
                                              <span key={moveIndex}>
                                                {move}
                                                {moveIndex < attempt.moves.length - 1 ? ' ' : ''}
                                              </span>
                                            );
                                          }
                                        })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Separate AlertDialog for delete confirmation */}
      <AlertDialog open={!!puzzleToDelete} onOpenChange={(open) => !open && setPuzzleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Puzzle Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this puzzle from {studentName}'s assignments?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (puzzleToDelete) {
                  deletePuzzleMutation.mutate(puzzleToDelete._id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}