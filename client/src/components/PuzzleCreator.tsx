import { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InsertPuzzle } from '@shared/schema';
import { Loader2, RotateCcw, Save, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface PuzzleCreatorProps {
  onSave: (puzzle: InsertPuzzle) => void;
  isSaving?: boolean;
}

export function PuzzleCreator({ onSave, isSaving }: PuzzleCreatorProps) {
  const [initialFen, setInitialFen] = useState('');
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('');
  const [solutionInput, setSolutionInput] = useState('');
  const [solution, setSolution] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [themesInput, setThemesInput] = useState('');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Autoplay effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isPlaying && currentMoveIndex < solution.length - 1) {
      intervalId = setInterval(() => {
        setCurrentMoveIndex(prev => {
          if (prev >= solution.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500); // Move every 1.5 seconds
    }
    return () => clearInterval(intervalId);
  }, [isPlaying, currentMoveIndex, solution.length]);

  // Effect to update board when currentMoveIndex changes
  useEffect(() => {
    if (currentMoveIndex === -1) {
      // Reset to initial position
      const newGame = new Chess(initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      setGame(newGame);
      return;
    }

    const newGame = new Chess(initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    // Apply moves up to currentMoveIndex
    for (let i = 0; i <= currentMoveIndex; i++) {
      try {
        const move = solution[i];
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const promotion = move.length === 5 ? move[4] : undefined;
        newGame.move({ from, to, promotion });
      } catch (e) {
        console.error('Invalid move:', solution[i]);
      }
    }
    setGame(newGame);
  }, [currentMoveIndex, solution, initialFen]);

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      try {
        const move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q', // always promote to queen for simplicity
        });

        if (move === null) return false;

        setGame(new Chess(game.fen()));
        return true;
      } catch (e) {
        return false;
      }
    },
    [game]
  );

  const setPosition = () => {
    try {
      const newGame = new Chess(fen);
      setGame(newGame);
      setInitialFen(fen); // Store initial position
      setFen('');
      setCurrentMoveIndex(-1); // Reset move index when setting new position
    } catch (e) {
      alert('Invalid FEN string');
    }
  };

  const handleSolutionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const moves = solutionInput.trim().split(/\s+/);
    // Basic UCI format validation
    const isValidUCI = moves.every(move =>
      (move.length === 4 || move.length === 5) &&
      /^[a-h][1-8][a-h][1-8][qrbnk]?$/.test(move)
    );

    if (!isValidUCI) {
      alert('Invalid UCI format. Moves should be like "e2e4" or "e7e8q", separated by spaces');
      return;
    }

    setSolution(moves);
    setSolutionInput('');
    setCurrentMoveIndex(-1); // Reset move index when setting new solution
    setIsPlaying(false);
  };

  const resetBoard = () => {
    setGame(new Chess());
    setSolution([]);
    setSolutionInput('');
    setCurrentMoveIndex(-1);
    setIsPlaying(false);
    setInitialFen('');
  };

  const handleThemesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (themesInput.trim()) {
      const newThemes = themesInput.trim().split(/\s+/);
      setThemes(prev => [...new Set([...prev, ...newThemes])]);
      setThemesInput('');
    }
  };

  const removeTheme = (theme: string) => {
    setThemes(prev => prev.filter(t => t !== theme));
  };

  const handleSave = () => {
    if (solution.length === 0) {
      alert('Please add solution moves first');
      return;
    }

    if (themes.length === 0) {
      alert('Please add at least one theme');
      return;
    }

    onSave({
      fen: initialFen || game.fen(),
      solution,
      themes,
      createdBy: '' // This will be set by the server
    });
  };

  const togglePlay = () => {
    if (!solution.length) {
      alert('Please add solution moves first');
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const nextMove = () => {
    if (currentMoveIndex < solution.length - 1) {
      setCurrentMoveIndex(prev => prev + 1);
    }
  };

  const previousMove = () => {
    if (currentMoveIndex > -1) {
      setCurrentMoveIndex(prev => prev - 1);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Chess Position</CardTitle>
          <CardDescription>Set up the initial position for the puzzle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <form onSubmit={(e) => { e.preventDefault(); setPosition(); }} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={fen}
                  onChange={(e) => setFen(e.target.value)}
                  placeholder="Enter FEN string"
                />
                <Button type="submit">Set Position</Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Current FEN: {game.fen()}
              </div>
            </form>
          </div>
          <div className="aspect-square">
            <Chessboard
              position={game.fen()}
              onPieceDrop={handlePieceDrop}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={resetBoard}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
          {solution.length > 0 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={previousMove}
                disabled={currentMoveIndex === -1}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                onClick={nextMove}
                disabled={currentMoveIndex === solution.length - 1}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Puzzle Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-medium mb-2">Solution Moves (UCI format)</h3>
            <form onSubmit={handleSolutionSubmit} className="space-y-2">
              <Input
                value={solutionInput}
                onChange={(e) => setSolutionInput(e.target.value)}
                placeholder="Enter moves (e.g., e2e4 e7e5 g1f3)"
              />
              <Button type="submit" className="w-full">Set Solution</Button>
            </form>
            <div className="flex flex-wrap gap-2 mt-2">
              {solution.map((move, i) => (
                <Badge
                  key={i}
                  variant={i === currentMoveIndex ? "default" : "secondary"}
                >
                  {move}
                </Badge>
              ))}
              {solution.length === 0 && (
                <p className="text-sm text-muted-foreground">No moves set yet</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Themes</h3>
            <form onSubmit={handleThemesSubmit} className="space-y-2">
              <Input
                value={themesInput}
                onChange={(e) => setThemesInput(e.target.value)}
                placeholder="Add themes (e.g., crushing hangingPiece middlegame)"
              />
              <Button type="submit" className="w-full">Add Themes</Button>
            </form>
            <div className="flex flex-wrap gap-2 mt-2">
              {themes.map(theme => (
                <Badge
                  key={theme}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive"
                  onClick={() => removeTheme(theme)}
                >
                  {theme} ×
                </Badge>
              ))}
            </div>
          </div>


          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving || solution.length === 0 || themes.length === 0}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Puzzle
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}