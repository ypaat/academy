import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { validateFen } from 'chess.js';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AnalysisBoard() {
  const game = useMemo(() => new Chess(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [boardWidth, setBoardWidth] = useState(360);
  const [chessBoardPosition, setChessBoardPosition] = useState(game.fen());
  const [analysis, setAnalysis] = useState<{
    depth: number;
    evaluation?: number;
    bestMove?: string;
    continuation?: string[];
    mate?: number | null;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [pgn, setPgn] = useState('');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [positions, setPositions] = useState<string[]>([game.fen()]);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);

  // Arrow drawing state
  const [arrows, setArrows] = useState<Array<[string, string, string]>>([]);
  const [dragStart, setDragStart] = useState<string | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 32, 600);
        setBoardWidth(width);
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const formatEvaluation = (eval_score?: number, mate?: number | null) => {
    if (mate !== null && mate !== undefined) {
      return `M${mate}`;
    }
    if (eval_score === undefined) return "0.0";
    return eval_score.toFixed(2);
  };

  const analyzeFen = async (fen: string) => {
    if (!engineEnabled) return;

    setIsAnalyzing(true);
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
        bestMove: data.bestmove?.split(' ')[1], // Extract actual move from "bestmove e2e4" format
        continuation,
        mate: data.mate
      });
    } catch (error) {
      console.error('Error analyzing position:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (engineEnabled && !game.isGameOver() && !game.isDraw()) {
      analyzeFen(chessBoardPosition);
    }
  }, [chessBoardPosition, engineEnabled]);

  const formatMoveTextForDisplay = (moves: string[]) => {
    return moves.reduce((acc: JSX.Element[], move, index) => {
      if (index % 2 === 0) {
        acc.push(
          <div key={index/2} className="flex items-center gap-2">
            <span className="w-8 text-muted-foreground">{Math.floor(index/2 + 1)}.</span>
            <button
              onClick={() => jumpToPosition(index)}
              className={`px-2 py-1 rounded hover:bg-accent min-w-[60px] text-left ${
                currentMoveIndex === index ? 'bg-accent' : ''
              }`}
            >
              {move}
            </button>
            {moves[index + 1] && (
              <button
                onClick={() => jumpToPosition(index + 1)}
                className={`px-2 py-1 rounded hover:bg-accent min-w-[60px] text-left ${
                  currentMoveIndex === index + 1 ? 'bg-accent' : ''
                }`}
              >
                {moves[index + 1]}
              </button>
            )}
          </div>
        );
      }
      return acc;
    }, []);
  };

  // Format continuation line
  const formatContinuationLine = (moves: string[]) => {
    return moves.map((move, i) => {
      const moveNumber = Math.floor((i + 1) / 2) + 1;
      return i % 2 === 0 ? `${moveNumber}. ${move}` : `${move}`;
    }).join(' ');
  };

  function onDrop(sourceSquare: string, targetSquare: string, piece: string) {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: piece[1].toLowerCase() === 'p' ? 'q' : undefined
      });

      if (!move) {
        return false;
      }

      setChessBoardPosition(game.fen());
      const newMoves = game.history({ verbose: true }).map(m => m.san);
      setMoveHistory(newMoves);
      setCurrentMoveIndex(newMoves.length - 1);
      setPositions(prev => [...prev.slice(0, currentMoveIndex + 2), game.fen()]);
      setPgn(game.pgn());
      setLastMove([sourceSquare, targetSquare]);

      if (game.isGameOver() || game.isDraw()) {
        toast({
          title: "Game Over",
          description: game.isDraw() ? "Game ended in draw" : "Checkmate!",
        });
      }
      return true;
    } catch (error) {
      console.error('Move error:', error);
      return false;
    }
  }

  const handleFenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFen = e.target.value.trim();
    if (!inputFen) return;

    try {
      const valid = validateFen(inputFen);
      if (!valid) {
        toast({
          title: "Invalid FEN",
          description: "The entered position is not valid",
          variant: "destructive"
        });
        return;
      }

      game.load(inputFen);
      setChessBoardPosition(game.fen());
      const newMoves = game.history({ verbose: true }).map(m => m.san);
      setMoveHistory(newMoves);
      setCurrentMoveIndex(newMoves.length - 1);
      setPgn(game.pgn());
      setPositions([inputFen]);
      setLastMove(null);
    } catch (error) {
      console.error('Invalid FEN:', error);
      toast({
        title: "Error",
        description: "Failed to load position",
        variant: "destructive"
      });
    }
  };

  const handlePgnImport = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const inputPgn = e.target.value;
    setPgn(inputPgn);

    if (!inputPgn.trim()) {
      // Reset to initial state if input is empty
      game.reset();
      setChessBoardPosition(game.fen());
      setPositions([game.fen()]);
      setMoveHistory([]);
      setCurrentMoveIndex(-1);
      setLastMove(null);
      return;
    }

    try {
      // Reset game to a clean state
      game.reset();

      // First, try to extract and load FEN if present
      const fenMatch = inputPgn.match(/\[FEN "(.*?)"\]/);
      const startingFen = fenMatch ? fenMatch[1] : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      // Load the starting position
      game.load(startingFen);
      const positions = [startingFen];

      // Load the PGN with sloppy parsing enabled to handle various formats
      try {
        game.loadPgn(inputPgn, { sloppy: true });
      } catch (pgnError) {
        console.error('Error loading PGN directly:', pgnError);

        // Fallback: Try to extract moves manually
        const moveRegex = /\d+\.\s+(\S+)(?:\s+{[^}]*})?(?:\s+(\S+)(?:\s+{[^}]*})?)?/g;
        let match;
        game.load(startingFen); // Reset to starting position

        while ((match = moveRegex.exec(inputPgn)) !== null) {
          if (match[1]) game.move(match[1], { sloppy: true });
          if (match[2]) game.move(match[2], { sloppy: true });
          positions.push(game.fen());
        }
      }

      // Get the history of moves
      const moves = game.history({ verbose: true });

      // Rebuild position history from the starting FEN
      const tempGame = new Chess(startingFen);
      const newPositions = [startingFen];

      moves.forEach(move => {
        tempGame.move(move);
        newPositions.push(tempGame.fen());
      });

      // Update state with new game data
      setChessBoardPosition(game.fen());
      setPositions(newPositions);
      setMoveHistory(moves.map(m => m.san));
      setCurrentMoveIndex(moves.length - 1);

      // Clear any previous last move highlighting
      setLastMove(null);
      setArrows([]);

      toast({
        title: "Success",
        description: `Loaded game with ${moves.length} moves from position`,
      });

    } catch (error) {
      console.error('Invalid PGN:', error);
      // Reset to initial state on error
      game.reset();
      setChessBoardPosition(game.fen());
      setPositions([game.fen()]);
      setMoveHistory([]);
      setCurrentMoveIndex(-1);
      setLastMove(null);
      setArrows([]);

      toast({
        title: "Error",
        description: "Failed to load PGN. Please check the format and try again.",
        variant: "destructive"
      });
    }
  };

  // Arrow drawing handlers
  const onSquareRightClick = (square: string) => {
    if (!dragStart) {
      setDragStart(square);
    } else {
      const newArrow: [string, string, string] = [dragStart, square, "rgb(255, 170, 0)"];
      setArrows(prev => [...prev, newArrow]);
      setDragStart(null);
    }
  };

  const jumpToPosition = (index: number) => {
    if (index >= -1 && index < moveHistory.length) {
      setCurrentMoveIndex(index);

      // Get move information
      if (index >= 0) {
        try {
          const moveHistory = game.history({ verbose: true });
          const move = moveHistory[index];

          // Only set last move if we have valid move data
          if (move && move.from && move.to) {
            setLastMove([move.from, move.to]);
          } else {
            setLastMove(null);
          }
        } catch (error) {
          console.error('Error getting move history:', error);
          setLastMove(null);
        }
      } else {
        setLastMove(null);
      }

      // Set position from our positions array
      setChessBoardPosition(positions[index + 1]);
    }
  };

  const customArrows = [
    // Only show last move arrow during replay
    ...(lastMove ? [[lastMove[0], lastMove[1], "rgb(0, 128, 0)"]] : []),
    ...arrows
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4">
      <div className="space-y-4">
        <div className="relative w-full max-w-[600px] mx-auto" ref={containerRef}>
          <Chessboard
            id="AnalysisBoard"
            position={chessBoardPosition}
            onPieceDrop={onDrop}
            boardWidth={boardWidth}
            customBoardStyle={{
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)"
            }}
            customArrows={customArrows}
            onSquareRightClick={onSquareRightClick}
          />
        </div>

        <Card className="max-w-[600px] mx-auto">
          <CardContent className="py-4">
            <div className="flex gap-2 justify-center">
              <Button
                variant="default"
                onClick={() => jumpToPosition(-1)}
                disabled={currentMoveIndex <= -1}
                className="min-w-[40px] hover:bg-primary/90"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                onClick={() => jumpToPosition(currentMoveIndex - 1)}
                disabled={currentMoveIndex <= -1}
                className="min-w-[40px] hover:bg-primary/90"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  game.reset();
                  setChessBoardPosition(game.fen());
                  setMoveHistory([]);
                  setPgn('');
                  setCurrentMoveIndex(-1);
                  setPositions([game.fen()]);
                  setArrows([]);
                  setLastMove(null);
                }}
                className="min-w-[40px] hover:bg-primary/90"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="default"
                onClick={() => jumpToPosition(currentMoveIndex + 1)}
                disabled={currentMoveIndex >= positions.length - 2}
                className="min-w-[40px] hover:bg-primary/90"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                onClick={() => jumpToPosition(positions.length - 2)}
                disabled={currentMoveIndex >= positions.length - 2}
                className="min-w-[40px] hover:bg-primary/90"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="max-w-[600px] mx-auto">
          <Input
            ref={inputRef}
            className="font-mono text-sm"
            onChange={handleFenInputChange}
            placeholder="Paste FEN to analyze custom position"
          />
        </div>

        <Card className="max-w-[600px] mx-auto">
          <CardHeader>
            <CardTitle>Import PGN</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={pgn}
              onChange={handlePgnImport}
              placeholder="Paste PGN here..."
              className="font-mono text-sm h-32"
            />
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
            <div className="font-mono text-sm space-y-1">
              {formatMoveTextForDisplay(moveHistory)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}