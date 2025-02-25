import { useState, useMemo } from 'react';
import { Chessboard, ChessboardDnDProvider, SparePiece } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const boardWrapper = {
  maxWidth: '70vh',
  margin: '0 auto'
};

export interface BoardEditorProps {
  onSavePuzzle: (fen: string, solution: string[], themes: string[]) => void;
}

export function BoardEditor({ onSavePuzzle }: BoardEditorProps) {
  const game = useMemo(() => {
    const chess = new Chess();
    chess.clear();
    return chess;
  }, []); 

  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [boardWidth, setBoardWidth] = useState(360);
  const [fenPosition, setFenPosition] = useState(game.fen());
  const [isCapturingSolution, setIsCapturingSolution] = useState(false);
  const [solutionMoves, setSolutionMoves] = useState<string[]>([]);
  const [themes, setThemes] = useState('');
  const [manualFen, setManualFen] = useState('');
  const [manualSolution, setManualSolution] = useState('');
  const [startingFen, setStartingFen] = useState('');
  const [visualGame, setVisualGame] = useState<Chess | null>(null);
  const [currentFen, setCurrentFen] = useState(game.fen());

  const handleSparePieceDrop = (piece: string, targetSquare: string) => {
    if (isCapturingSolution) return false;

    const color = piece[0] as 'w' | 'b';
    const type = piece[1].toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
    const success = game.put({ type, color }, targetSquare as any);
    if (success) {
      const newFen = game.fen();
      setFenPosition(newFen);
      setCurrentFen(newFen);
    }
    return success;
  };

  const handlePieceDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (isCapturingSolution) {
      if (visualGame) {
        try {
          visualGame.move({ from: sourceSquare, to: targetSquare });
          setSolutionMoves(prev => [...prev, `${sourceSquare}${targetSquare}`]);
          setFenPosition(visualGame.fen()); 
          return true;
        } catch (error) {
          return false;
        }
      }
      return false;
    }

    game.remove(sourceSquare as any);
    game.remove(targetSquare as any);
    const color = piece[0] as 'w' | 'b';
    const type = piece[1].toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
    const success = game.put({ type, color }, targetSquare as any);
    if (success) {
      const newFen = game.fen();
      setFenPosition(newFen);
      setCurrentFen(newFen);
    }
    return success;
  };

  const handlePieceDropOffBoard = (sourceSquare: string) => {
    if (isCapturingSolution) return;
    game.remove(sourceSquare as any);
    const newFen = game.fen();
    setFenPosition(newFen);
    setCurrentFen(newFen);
  };

  const handleSetPosition = () => {
    try {
      game.load(manualFen);
      const newFen = game.fen();
      setFenPosition(newFen);
      setCurrentFen(newFen);
      setStartingFen(newFen);
    } catch (error) {
      console.error('Invalid FEN:', error);
    }
  };

  const startCapturingSolution = () => {
    setStartingFen(game.fen()); 
    setSolutionMoves([]);
    setIsCapturingSolution(true);
    const visualChess = new Chess(game.fen());
    setVisualGame(visualChess);
  };

  const stopCapturingSolution = () => {
    setIsCapturingSolution(false);
    setVisualGame(null);
    game.load(startingFen);
    setFenPosition(startingFen);
    setCurrentFen(startingFen);
  };

  const handleSave = () => {
    const themeList = themes.split(',').map(t => t.trim()).filter(Boolean);

    if (manualFen && manualSolution) {
      const moves = manualSolution.split(' ').filter(Boolean);
      onSavePuzzle(manualFen, moves, themeList);
    } else {
      onSavePuzzle(startingFen || game.fen(), solutionMoves, themeList);
    }
  };

  const pieces = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];

  return (
    <div style={boardWrapper}>
      <ChessboardDnDProvider>
        <div>
          <div style={{
            display: "flex",
            margin: `${boardWidth / 32}px ${boardWidth / 8}px`
          }}>
            {pieces.slice(6, 12).map(piece => (
              <SparePiece key={piece} piece={piece} width={boardWidth / 8} dndId="MainBoard" />
            ))}
          </div>

          <Chessboard
            onBoardWidthChange={setBoardWidth}
            id="MainBoard"
            position={fenPosition}
            onPieceDrop={handlePieceDrop}
            onSparePieceDrop={handleSparePieceDrop}
            onPieceDropOffBoard={handlePieceDropOffBoard}
            boardOrientation={boardOrientation}
            customBoardStyle={{
              borderRadius: "4px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)"
            }}
            dropOffBoardAction="trash"
          />

          <div style={{
            display: "flex",
            margin: `${boardWidth / 32}px ${boardWidth / 8}px`
          }}>
            {pieces.slice(0, 6).map(piece => (
              <SparePiece key={piece} piece={piece} width={boardWidth / 8} dndId="MainBoard" />
            ))}
          </div>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginTop: "16px"
        }}>
          <Button
            variant="outline"
            onClick={() => {
              game.clear();
              const newFen = game.fen();
              setFenPosition(newFen);
              setCurrentFen(newFen);
            }}
          >
            Clear board 🗑️
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              game.reset();
              const newFen = game.fen();
              setFenPosition(newFen);
              setCurrentFen(newFen);
            }}
          >
            Start position ♟️
          </Button>
          <Button
            variant="outline"
            onClick={() => setBoardOrientation(boardOrientation === "white" ? "black" : "white")}
          >
            Flip board 🔁
          </Button>
          {!isCapturingSolution ? (
            <Button
              variant="default"
              onClick={startCapturingSolution}
            >
              Start Capturing Solution
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={stopCapturingSolution}
            >
              Stop Capturing
            </Button>
          )}
        </div>

        <div className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label>Themes (comma-separated)</Label>
            <Input
              value={themes}
              onChange={(e) => setThemes(e.target.value)}
              placeholder="Enter themes (e.g. pin, fork, discovered attack)"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Current FEN Position</Label>
            <Input
              value={currentFen}
              readOnly
              className="font-mono text-sm bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Manual Position Setup</Label>
            <div className="flex gap-2">
              <Input
                value={manualFen}
                onChange={(e) => setManualFen(e.target.value)}
                placeholder="Enter FEN position"
                className="font-mono text-sm"
              />
              <Button onClick={handleSetPosition}>
                Set Position
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Manual Solution</Label>
            <Input
              value={manualSolution}
              onChange={(e) => setManualSolution(e.target.value)}
              placeholder="Enter solution moves (e.g. e2e4 e7e5)"
              className="font-mono text-sm"
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {solutionMoves.length > 0 && (
                <span>Captured moves: {solutionMoves.join(' ')}</span>
              )}
            </div>
            <Button 
              onClick={handleSave} 
              disabled={(!solutionMoves.length && !manualSolution) || !themes}
            >
              Save Puzzle
            </Button>
          </div>
        </div>
      </ChessboardDnDProvider>
    </div>
  );
}