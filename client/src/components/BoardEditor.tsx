import React, { useState, useMemo } from 'react';
import { Chessboard, ChessboardDnDProvider, SparePiece } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronLeft } from "lucide-react";

const boardWrapper = {
  maxWidth: '70vh',
  margin: '0 auto'
};

export interface BoardEditorProps {
  onSavePuzzle: (fen: string, solution: string[], themes: string[]) => void;
  onBack?: () => void;  // Add back handler prop
}

const isPawnPromotion = (piece: string, targetSquare: string) => {
  const isPawn = piece[1].toLowerCase() === 'p';
  const isLastRank = targetSquare[1] === '8' || targetSquare[1] === '1';
  return isPawn && isLastRank;
};

export function BoardEditor({ onSavePuzzle, onBack }: BoardEditorProps) {
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
  const [colorToMove, setColorToMove] = useState<"w" | "b">("w");

  const updateFenWithColor = (fen: string, color: "w" | "b") => {
    const emptyBoardFen = "8/8/8/8/8/8/8/8 w - - 0 1";
    const startingPositionFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    if (fen === emptyBoardFen || fen === startingPositionFen) {
      return fen;
    }

    try {
      const fenParts = fen.split(" ");
      if (fenParts[0] && fenParts[0] !== "8/8/8/8/8/8/8/8") {
        fenParts[1] = color;
        const newFen = fenParts.join(" ");
        const testGame = new Chess();
        testGame.load(newFen);
        return newFen;
      }
      return fen;
    } catch (error) {
      console.error('Invalid FEN:', error);
      return fen;
    }
  };

  const handleColorToMoveChange = (color: "w" | "b") => {
    try {
      setColorToMove(color);
      if (game.fen() !== "8/8/8/8/8/8/8/8 w - - 0 1") {
        const newFen = updateFenWithColor(currentFen, color);
        setFenPosition(newFen);
        setCurrentFen(newFen);
        const testGame = new Chess();
        testGame.load(newFen);
        game.load(newFen);
      }
    } catch (error) {
      console.error('Error updating color:', error);
    }
  };

  const handleSparePieceDrop = (piece: string, targetSquare: string) => {
    if (isCapturingSolution) return false;

    const color = piece[0] as 'w' | 'b';
    const type = piece[1].toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
    const success = game.put({ type, color }, targetSquare as any);
    if (success) {
      const newFen = updateFenWithColor(game.fen(), colorToMove);
      setFenPosition(newFen);
      setCurrentFen(newFen);
    }
    return success;
  };

  const handlePieceDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (isCapturingSolution) {
      if (visualGame) {
        try {
          visualGame.remove(sourceSquare as any);
          visualGame.remove(targetSquare as any);
          const color = piece[0] as 'w' | 'b';
          let type = piece[1].toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

          // Handle pawn promotion
          if (isPawnPromotion(piece, targetSquare)) {
            type = 'q'; // Default promote to queen
          }

          const success = visualGame.put({ type, color }, targetSquare as any);
          if (success) {
            const moveString = isPawnPromotion(piece, targetSquare)
              ? `${sourceSquare}${targetSquare}q` // Add promotion piece to move string
              : `${sourceSquare}${targetSquare}${type}`;
            setSolutionMoves(prev => [...prev, moveString]);
            setFenPosition(visualGame.fen());
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error handling piece drop:', error);
          return false;
        }
      }
      return false;
    }

    game.remove(sourceSquare as any);
    game.remove(targetSquare as any);
    const color = piece[0] as 'w' | 'b';
    let type = piece[1].toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

    // Handle pawn promotion in the main board
    if (isPawnPromotion(piece, targetSquare)) {
      type = 'q'; // Default promote to queen
    }

    const success = game.put({ type, color }, targetSquare as any);
    if (success) {
      const newFen = updateFenWithColor(game.fen(), colorToMove);
      setFenPosition(newFen);
      setCurrentFen(newFen);
    }
    return success;
  };

  const handlePieceDropOffBoard = (sourceSquare: string) => {
    if (isCapturingSolution) return;
    game.remove(sourceSquare as any);
    const newFen = updateFenWithColor(game.fen(), colorToMove);
    setFenPosition(newFen);
    setCurrentFen(newFen);
  };

  const handleSetPosition = () => {
    try {
      game.load(manualFen);
      const newFen = updateFenWithColor(game.fen(), colorToMove);
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

  const handleClearBoard = () => {
    const emptyBoardFen = "8/8/8/8/8/8/8/8 w - - 0 1";
    game.load(emptyBoardFen);
    setFenPosition(emptyBoardFen);
    setCurrentFen(emptyBoardFen);
  };

  return (
    <div style={boardWrapper}>
      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      )}
      <ChessboardDnDProvider>
        <div>
          <div style={{
            display: "flex",
            margin: `${boardWidth / 32}px ${boardWidth / 8}px`
          }}>
            {pieces.slice(6, 12).map(piece => (
              <SparePiece
                key={piece}
                piece={piece as any}
                width={boardWidth / 8}
                dndId="MainBoard"
              />
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
              <SparePiece
                key={piece}
                piece={piece as any}
                width={boardWidth / 8}
                dndId="MainBoard"
              />
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-4 mb-4">
          <Label className="flex items-center mr-2">Color to move:</Label>
          <ToggleGroup
            type="single"
            value={colorToMove}
            onValueChange={(value) => value && handleColorToMoveChange(value as "w" | "b")}
          >
            <ToggleGroupItem value="w">White</ToggleGroupItem>
            <ToggleGroupItem value="b">Black</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginTop: "16px"
        }}>
          <Button
            variant="outline"
            onClick={handleClearBoard}
          >
            Clear board 🗑️
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              game.reset();
              const newFen = updateFenWithColor(game.fen(), colorToMove);
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