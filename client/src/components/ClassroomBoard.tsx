import { useState, useEffect, useCallback, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, ChevronLeft, ChevronRight, Upload, BookOpen, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";

interface ClassroomBoardProps {
  isCoach?: boolean;
  classId: string;
}

export function ClassroomBoard({ isCoach = false, classId }: ClassroomBoardProps) {
  const [game, setGame] = useState<Chess>(new Chess());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const newSocket = io(`${window.location.protocol}//${window.location.host}`, {
      path: `/ws/classroom/${classId}`,
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket.IO connected");
      setIsConnected(true);
    });

    newSocket.on("board_update", (data) => {
      const newGame = new Chess();
      newGame.load(data.fen);
      setGame(newGame);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket.IO disconnected");
      setIsConnected(false);
      toast({
        title: "Connection Lost",
        description: "Unable to maintain connection to the classroom. Please refresh the page.",
        variant: "destructive",
      });
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket.IO error:", error);
      setIsConnected(false);
      toast({
        title: "Connection Error",
        description: "A Socket.IO error occurred. Please check your connection and try again.",
        variant: "destructive",
      });
    });

    return () => {
      newSocket.close();
    };
  }, [classId, toast]);

  const updateMoveHistory = (currentGame: Chess) => {
    const history = currentGame.history();
    setMoveHistory(history);
    setCurrentMoveIndex(history.length - 1);
  };

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    if (!isConnected) {
      toast({
        title: "Not Connected",
        description: "Please wait for connection to be established",
        variant: "destructive"
      });
      return false;
    }

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (move === null) return false;

      const newGame = new Chess(game.fen());
      setGame(newGame);
      updateMoveHistory(newGame);

      // Send update to server
      socket?.emit('board_update', {
        fen: newGame.fen(),
      });

      return true;
    } catch (error) {
      console.error('Move error:', error);
      return false;
    }
  };

  const handleFlipBoard = () => {
    setBoardOrientation(current => current === 'white' ? 'black' : 'white');
  };

  const handleReset = () => {
    const newGame = new Chess();
    setGame(newGame);
    updateMoveHistory(newGame);
    socket?.emit('board_update', {
      fen: newGame.fen(),
    });
  };

  const handleLoadPGN = async (pgn: string) => {
    try {
      const newGame = new Chess();
      newGame.loadPgn(pgn);
      setGame(newGame);
      updateMoveHistory(newGame);
      socket?.emit('board_update', {
        fen: newGame.fen(),
      });
    } catch (error) {
      console.error('Error loading PGN:', error);
    }
  };

  const handleLoadPuzzle = async (puzzleId: string) => {
    try {
      const response = await apiRequest("GET", `/api/puzzles/${puzzleId}`);
      const puzzle = await response.json();
      const newGame = new Chess();
      newGame.load(puzzle.fen);
      setGame(newGame);
      updateMoveHistory(newGame);
      socket?.emit('board_update', {
        fen: newGame.fen(),
      });
    } catch (error) {
      console.error('Error loading puzzle:', error);
    }
  };

  const navigateMove = (index: number) => {
    if (!isCoach) return;
    const newGame = new Chess();

    for (let i = 0; i <= index; i++) {
      try {
        newGame.move(moveHistory[i]);
      } catch (error) {
        console.error('Error navigating move:', error);
        break;
      }
    }

    setGame(newGame);
    setCurrentMoveIndex(index);
    socket?.emit('board_update', {
      fen: newGame.fen(),
    });
  };

  const handlePrevMove = () => {
    if (currentMoveIndex > -1) {
      navigateMove(currentMoveIndex - 1);
    }
  };

  const handleNextMove = () => {
    if (currentMoveIndex < moveHistory.length - 1) {
      navigateMove(currentMoveIndex + 1);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 relative">
            {!isConnected && (
              <div className="absolute z-10 inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Connecting to classroom...</p>
                </div>
              </div>
            )}
            <Chessboard
              position={game.fen()}
              onPieceDrop={handleMove}
              boardOrientation={boardOrientation}
            />
          </div>
          <div className="w-full lg:w-80 space-y-6">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleFlipBoard}>
                Flip Board
              </Button>
              {isCoach && (
                <>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Load PGN
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Load PGN</DialogTitle>
                      </DialogHeader>
                      <Textarea
                        placeholder="Paste PGN here..."
                        onChange={(e) => handleLoadPGN(e.target.value)}
                      />
                    </DialogContent>
                  </Dialog>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Load Puzzle
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Load Puzzle</DialogTitle>
                      </DialogHeader>
                      <Input
                        placeholder="Enter puzzle ID..."
                        onChange={(e) => handleLoadPuzzle(e.target.value)}
                      />
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>

            <div className="space-y-2">
              {isCoach && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePrevMove}
                    disabled={currentMoveIndex < 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNextMove}
                    disabled={currentMoveIndex >= moveHistory.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="font-mono text-sm whitespace-pre-wrap">
                {moveHistory.map((move, index) => (
                  <span
                    key={index}
                    className={`${isCoach ? 'cursor-pointer' : ''} ${index === currentMoveIndex ? 'bg-primary/20' : ''}`}
                    onClick={() => isCoach && navigateMove(index)}
                  >
                    {index % 2 === 0 ? `${Math.floor(index / 2 + 1)}. ` : ''}
                    {move}{' '}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}