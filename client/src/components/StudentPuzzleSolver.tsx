import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { TutorialOverlay, TutorialStep } from './TutorialOverlay';

interface StudentPuzzleProps {
  puzzle: {
    _id: string;  // Assignment ID
    puzzleId: string;  // Puzzle ID
    fen: string;
    solution: string[];
    themes: string[];
    playerMovesFirst: boolean;
  };
  onComplete: () => void;
  onNext?: () => void;
}

// Helper function for pawn promotion check
const isPawnPromotion = (piece: string, targetSquare: string) => {
  const isPawn = piece[1].toLowerCase() === 'p';
  const isLastRank = targetSquare[1] === '8' || targetSquare[1] === '1';
  return isPawn && isLastRank;
};

export function StudentPuzzleSolver({ puzzle, onComplete, onNext }: StudentPuzzleProps) {
  const [game, setGame] = useState<Chess>(new Chess());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [attempts, setAttempts] = useState<{moves: string[], isCorrect: boolean}[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<{
    moves: string[],
    positions: string[]
  }>({ moves: [], positions: [] });
  const [boardWidth, setBoardWidth] = useState(600);
  const [incorrectMove, setIncorrectMove] = useState<{from: string, to: string} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const puzzleIdRef = useRef(puzzle._id);

  // Clear attempts when puzzle changes
  useEffect(() => {
    if (puzzleIdRef.current !== puzzle._id) {
      setAttempts([]);
      setCurrentAttempt({ moves: [], positions: [] });
      puzzleIdRef.current = puzzle._id;
    }
  }, [puzzle._id]);

  // Clear incorrect move highlight after a delay
  useEffect(() => {
    if (incorrectMove) {
      const timer = setTimeout(() => {
        setIncorrectMove(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [incorrectMove]);

  // Responsive board size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 32, 800);
        setBoardWidth(width);
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Setup initial position
  useEffect(() => {
    try {
      const initialGame = new Chess(puzzle.fen);
      const playerSide = initialGame.turn() === 'w' ? 'white' : 'black';
      setBoardOrientation(playerSide);
      setGame(initialGame);
      setCurrentMoveIndex(-1);
      setCurrentAttempt({
        moves: [],
        positions: [puzzle.fen]
      });
    } catch (error) {
      console.error('Error in puzzle setup:', error);
    }
  }, [puzzle.fen]);

  const isCorrectMove = (moveStr: string, game: Chess): boolean => {
    const expectedMove = puzzle.solution[currentMoveIndex + 1];
    if (!expectedMove) return false;

    // Direct string comparison
    if (moveStr === expectedMove) return true;

    // For pawn promotion moves, compare base moves
    const baseMove = moveStr.substring(0, 4);
    const expectedBaseMove = expectedMove.substring(0, 4);

    if (baseMove === expectedBaseMove) {
      const moveIsPromotion = moveStr.length === 5;
      const expectedIsPromotion = expectedMove.length === 5;
      return moveIsPromotion || expectedIsPromotion;
    }

    return false;
  };

  const handlePuzzleAttempt = async (moves: string[], isCorrect: boolean) => {
    try {
      if (!isCorrect) {
        await apiRequest("POST", `/api/assignments/${puzzle._id}/attempt`, {
          moves,
        });
        setAttempts(prev => [...prev, { moves, isCorrect: false }]);
      } else {
        await apiRequest("POST", `/api/assignments/${puzzle._id}/complete`, {
          moves,
        });
        setAttempts(prev => [...prev, { moves, isCorrect: true }]);
        onComplete();
        if (onNext) {
          setTimeout(onNext, 1000);
        }
      }
    } catch (error) {
      console.error('Error handling puzzle attempt:', error);
    }
  };

  const handlePieceDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    try {
      const playerColor = boardOrientation === 'white' ? 'w' : 'b';
      if (game.turn() !== playerColor) return false;

      const sourcePiece = game.get(sourceSquare as any);
      if (!sourcePiece) return false;

      // Handle pawn promotion
      let promotion: 'q' | 'r' | 'b' | 'n' | undefined = undefined;
      const isPromotion = sourcePiece.type === 'p' && 
                         ((sourcePiece.color === 'w' && targetSquare[1] === '8') ||
                          (sourcePiece.color === 'b' && targetSquare[1] === '1'));

      if (isPromotion) {
        const expectedMove = puzzle.solution[currentMoveIndex + 1];
        promotion = expectedMove?.length === 5 ? expectedMove[4] as 'q' | 'r' | 'b' | 'n' : 'q';
      }

      const moveStr = `${sourceSquare}${targetSquare}${promotion || ''}`;

      const moveAttempt = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion
      });

      if (!moveAttempt) {
        setIncorrectMove({ from: sourceSquare, to: targetSquare });
        return false;
      }

      if (!isCorrectMove(moveStr, game)) {
        game.undo();
        setIncorrectMove({ from: sourceSquare, to: targetSquare });
        handlePuzzleAttempt([...currentAttempt.moves, moveStr], false);
        return false;
      }

      const newGame = new Chess(game.fen());
      setGame(newGame);
      setCurrentMoveIndex(prev => prev + 1);
      setCurrentAttempt(prev => ({
        moves: [...prev.moves, moveStr],
        positions: [...prev.positions, newGame.fen()]
      }));

      if (currentMoveIndex + 1 === puzzle.solution.length - 1) {
        handlePuzzleAttempt([...currentAttempt.moves, moveStr], true);
      } else {
        setTimeout(() => {
          const nextMove = puzzle.solution[currentMoveIndex + 2];
          if (!nextMove) return;

          const from = nextMove.substring(0, 2);
          const to = nextMove.substring(2, 4);
          const promotion = nextMove.length === 5 ? nextMove[4] as 'q' | 'r' | 'b' | 'n' : undefined;

          try {
            const opponentMove = game.move({ from, to, promotion });
            if (!opponentMove) throw new Error(`Invalid opponent move: ${nextMove}`);

            const newGameAfterOpponent = new Chess(game.fen());
            setGame(newGameAfterOpponent);
            setCurrentMoveIndex(prev => prev + 1);
            setCurrentAttempt(prev => ({
              moves: [...prev.moves, nextMove],
              positions: [...prev.positions, newGameAfterOpponent.fen()]
            }));
          } catch (error) {
            console.error('Error making opponent move:', error);
          }
        }, 300);
      }

      return true;
    } catch (error) {
      console.error('Error handling piece drop:', error);
      return false;
    }
  };

  const resetPuzzle = () => {
    try {
      const initialGame = new Chess(puzzle.fen);
      setGame(initialGame);
      setCurrentMoveIndex(-1);
      setCurrentAttempt({
        moves: [],
        positions: [puzzle.fen]
      });
      setIncorrectMove(null);
    } catch (error) {
      console.error('Error resetting puzzle:', error);
    }
  };

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

  // Custom styles for squares
  const customSquareStyles = {
    ...(incorrectMove && {
      [incorrectMove.from]: { backgroundColor: 'rgba(255, 0, 0, 0.2)' },
      [incorrectMove.to]: { backgroundColor: 'rgba(255, 0, 0, 0.2)' }
    })
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <div ref={containerRef} className="relative">
                <Chessboard
                  position={game.fen()}
                  onPieceDrop={handlePieceDrop}
                  boardWidth={boardWidth}
                  boardOrientation={boardOrientation}
                  customSquareStyles={customSquareStyles}
                  arePiecesDraggable={game.turn() === (boardOrientation === 'white' ? 'w' : 'b')}
                />
              </div>
            </div>
            <div className="w-full lg:w-80 space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Themes</h3>
                <div className="flex flex-wrap gap-2">
                  {puzzle.themes.map(theme => (
                    <Badge key={theme} variant="secondary">{theme}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <Button 
                  variant="outline" 
                  onClick={resetPuzzle}
                  className="w-full"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Puzzle
                </Button>
              </div>

              {attempts.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Attempts</h3>
                  <div className="space-y-2">
                    {attempts.map((attempt, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-sm p-2 rounded bg-muted/50"
                      >
                        {attempt.isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mt-1" />
                        )}
                        <div className="font-mono break-all">
                          {attempt.moves.map((move, j) => {
                            const moveNumber = Math.floor(j / 2) + 1;
                            const isPlayerMove = j % 2 === 0;
                            const pos = j > 0 ? currentAttempt.positions[j - 1] : puzzle.fen;
                            const san = uciToSan(move, pos);
                            return (
                              <span key={j}>
                                {isPlayerMove ? `${moveNumber}. ` : ''}
                                {san}
                                {j < attempt.moves.length - 1 ? ' ' : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}