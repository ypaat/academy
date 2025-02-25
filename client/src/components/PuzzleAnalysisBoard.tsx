import { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PuzzleAnalysisBoardProps {
  fen: string;
  pgn: string;
  onClose?: () => void;
}

export function PuzzleAnalysisBoard({ fen, pgn, onClose }: PuzzleAnalysisBoardProps) {
  const [game] = useState(new Chess());
  const [currentPosition, setCurrentPosition] = useState(fen);
  const [moveIndex, setMoveIndex] = useState(-1);
  const [moves, setMoves] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [boardWidth, setBoardWidth] = useState(560);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<NodeJS.Timeout>();
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [analysis, setAnalysis] = useState<{
    depth: number;
    evaluation?: number;
    bestMove?: string;
    continuation?: string[];
    mate?: number | null;
  } | null>(null);

  // Add resize observer for responsive board sizing
  useEffect(() => {
    if (!boardContainerRef.current) return;

    const calculateBoardWidth = () => {
      if (!boardContainerRef.current) return;
      const containerWidth = boardContainerRef.current.offsetWidth;
      const newWidth = Math.min(
        window.innerWidth < 768 ? containerWidth * 0.9 : containerWidth * 0.8,
        560
      );
      setBoardWidth(Math.floor(newWidth));
    };

    calculateBoardWidth();
    const resizeObserver = new ResizeObserver(calculateBoardWidth);
    resizeObserver.observe(boardContainerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Load initial position and moves
  useEffect(() => {
    try {
      game.load(fen);
      if (pgn) {
        // Parse the moves from PGN format
        const cleanPgn = pgn.trim();
        const formattedMoves: string[] = [];

        // Initialize temporary game for move validation
        const tempGame = new Chess(fen);

        // Extract moves using regex pattern for numbered moves
        const moveRegex = /\d+\.\s+(\S+)(?:\s+{[^}]*})?(?:\s+(\S+)(?:\s+{[^}]*})?)?/g;
        let match;

        while ((match = moveRegex.exec(cleanPgn)) !== null) {
          try {
            // Process white's move
            if (match[1]) {
              const moveResult = tempGame.move(match[1], { sloppy: true });
              if (moveResult) {
                formattedMoves.push(moveResult.san);
              }
            }

            // Process black's move if it exists
            if (match[2]) {
              const moveResult = tempGame.move(match[2], { sloppy: true });
              if (moveResult) {
                formattedMoves.push(moveResult.san);
              }
            }
          } catch (moveError) {
            console.error('Error processing move:', moveError);
          }
        }

        setMoves(formattedMoves);
        game.load(fen); // Reset to initial position
      }
    } catch (error) {
      console.error('Error loading position or moves:', error);
      // Reset to initial state on error
      game.reset();
      setCurrentPosition(game.fen());
      setMoves([]);
    }
  }, [fen, pgn]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setMoveIndex(current => {
          if (current >= moves.length - 1) {
            setIsPlaying(false);
            return current;
          }
          return current + 1;
        });
      }, 1000);
    }
    return () => clearInterval(playIntervalRef.current);
  }, [isPlaying, moves.length]);

  // Update position when move index changes
  useEffect(() => {
    try {
      game.load(fen);
      for (let i = 0; i <= moveIndex; i++) {
        try {
          const result = game.move(moves[i]);
          if (!result) {
            console.error(`Invalid move: ${moves[i]}`);
            break;
          }
        } catch (moveError) {
          console.error(`Error making move ${moves[i]}:`, moveError);
          break;
        }
      }
      setCurrentPosition(game.fen());
      // Trigger engine analysis after position update
      if (engineEnabled) {
        analyzeFen(game.fen());
      }
    } catch (error) {
      console.error('Error updating position:', error);
    }
  }, [moveIndex, fen, moves]);

  // Function to handle moves made on the board
  function onDrop(sourceSquare: string, targetSquare: string, piece: string) {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: piece[1].toLowerCase() === 'p' ? 'q' : undefined
      });

      if (!move) return false;

      const newPosition = game.fen();
      setCurrentPosition(newPosition);

      // Update moves list with the new move
      const newMoves = [...moves.slice(0, moveIndex + 1), move.san];
      setMoves(newMoves);
      setMoveIndex(moveIndex + 1);

      // Trigger engine analysis for the new position
      if (engineEnabled) {
        analyzeFen(newPosition);
      }

      return true;
    } catch (error) {
      console.error('Move error:', error);
      return false;
    }
  }

  // Engine analysis
  const analyzeFen = async (fen: string) => {
    if (!engineEnabled) return;

    try {
      const params = new URLSearchParams({
        fen: fen,
        depth: '15'
      });

      const response = await fetch(`https://stockfish.online/api/s/v2.php?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Parse continuation moves from the response
      const continuation = data.continuation ? data.continuation.split(' ') : [];

      setAnalysis({
        depth: parseInt(data.depth || '15'),
        evaluation: parseFloat(data.evaluation || '0'),
        bestMove: data.bestmove?.split(' ')[1],
        continuation,
        mate: data.mate
      });
    } catch (error) {
      console.error('Error analyzing position:', error);
    }
  };

  const formatEvaluation = (eval_score?: number, mate?: number | null) => {
    if (mate !== null && mate !== undefined) {
      return `M${mate}`;
    }
    if (eval_score === undefined) return "0.0";
    return eval_score.toFixed(2);
  };

  const formatContinuationLine = (moves: string[]) => {
    return moves.map((move, i) => {
      const moveNumber = Math.floor((i + 1) / 2) + 1;
      return i % 2 === 0 ? `${moveNumber}. ${move}` : `${move}`;
    }).join(' ');
  };

  const playNextMove = () => {
    if (moveIndex + 1 < moves.length) {
      setMoveIndex(moveIndex + 1);
    }
  };

  const playPreviousMove = () => {
    if (moveIndex >= 0) {
      setMoveIndex(moveIndex - 1);
    }
  };

  const resetPosition = () => {
    setMoveIndex(-1);
    setIsPlaying(false);
  };

  const toggleAutoPlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4">
      <div className="space-y-4">
        <div className="relative w-full max-w-[600px] mx-auto" ref={boardContainerRef}>
          <Chessboard
            position={currentPosition}
            boardWidth={boardWidth}
            onPieceDrop={onDrop}
            customBoardStyle={{
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)"
            }}
          />
        </div>

        <Card className="max-w-[600px] mx-auto">
          <CardContent className="py-4">
            <div className="flex gap-2 justify-center">
              <Button
                variant="default"
                onClick={resetPosition}
                disabled={moveIndex === -1}
                className="min-w-[40px] hover:bg-primary/90"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
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
                onClick={toggleAutoPlay}
                disabled={moveIndex >= moves.length - 1}
                className="min-w-[40px] hover:bg-primary/90"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="default"
                onClick={playNextMove}
                disabled={moveIndex >= moves.length - 1}
                className="min-w-[40px] hover:bg-primary/90"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Sidebar */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Engine toggle and evaluation */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="engine-toggle">Engine Analysis</Label>
              <Switch
                id="engine-toggle"
                checked={engineEnabled}
                onCheckedChange={setEngineEnabled}
              />
            </div>

            {engineEnabled && analysis && (
              <div className="space-y-2">
                <div className="text-lg font-medium">
                  Evaluation: {formatEvaluation(analysis.evaluation, analysis.mate)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Depth: {analysis.depth || 15}
                  {analysis.bestMove && (
                    <>
                      <div>Best move: {analysis.bestMove}</div>
                      {analysis.continuation && (
                        <div className="mt-1 text-xs">
                          Continuation: {formatContinuationLine(analysis.continuation)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Move History</h3>
            <div className="font-mono text-sm">
              {moves.map((move, index) => (
                <span
                  key={index}
                  className={cn(
                    "cursor-pointer px-1",
                    index <= moveIndex && "bg-primary/20",
                    index === moveIndex && "ring-1 ring-primary"
                  )}
                  onClick={() => setMoveIndex(index)}
                >
                  {index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}
                  {move}{' '}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}