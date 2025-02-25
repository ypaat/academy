import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Search, Check, Square, RotateCcw, CheckCircle2, Trash2, Edit } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Puzzle {
  _id: string;
  fen: string;
  themes: string[];
  solution: string[];
  createdAt: string;
}

interface PuzzleListProps {
  onAssign?: (puzzleIds: string[], studentId: string) => void;
  students?: { _id: string; name: string }[];
}

export function PuzzleList({ onAssign, students }: PuzzleListProps) {
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedPuzzles, setSelectedPuzzles] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState(false);
  const [editingPuzzle, setEditingPuzzle] = useState<Puzzle | null>(null);
  const [editedSolution, setEditedSolution] = useState("");
  const [editedThemes, setEditedThemes] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: puzzlesData, isLoading } = useQuery<{
    puzzles: Puzzle[];
    total: number;
    themes: string[];
  }>({
    queryKey: ["/api/puzzles", page, selectedThemes],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        themes: selectedThemes.join(","),
      });
      const res = await fetch(`/api/puzzles?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch puzzles");
      return res.json();
    },
  });

  const updatePuzzleMutation = useMutation({
    mutationFn: async (puzzle: { _id: string, solution: string[], themes: string[] }) => {
      console.log("Sending update request for puzzle:", puzzle._id);

      const updateData = {
        puzzleId: puzzle._id,
        solution: puzzle.solution,
        themes: puzzle.themes
      };

      console.log("Update payload:", JSON.stringify(updateData));

      const response = await apiRequest("POST", `/api/puzzles/update`, updateData);

      if (!response.ok) {
        const text = await response.text();
        console.error("Failed response:", text);
        throw new Error(`Failed to update puzzle: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      setEditingPuzzle(null); 
      queryClient.invalidateQueries({ queryKey: ["/api/puzzles"] }); 
    },
    onError: (error) => {
      console.error("Update failed:", error);
    }
  });

  const deletePuzzleMutation = useMutation({
    mutationFn: async (puzzleId: string) => {
      console.log("Attempting to delete puzzle:", puzzleId);
      const response = await apiRequest("POST", `/api/puzzles/delete`, {
        puzzleId
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Delete failed response:", text);
        throw new Error(`Failed to delete puzzle: ${response.statusText}`);
      }
      return puzzleId;
    },
    onSuccess: (deletedPuzzleId) => {
      console.log("Successfully deleted puzzle:", deletedPuzzleId);
      queryClient.invalidateQueries({ queryKey: ["/api/puzzles"] });
    },
    onError: (error) => {
      console.error("Delete failed:", error);
    }
  });

  const rowVirtualizer = useVirtualizer({
    count: puzzlesData?.puzzles.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  const handleEdit = (puzzle: Puzzle) => {
    setEditingPuzzle(puzzle);
    setEditedSolution(puzzle.solution.join(" "));
    setEditedThemes(puzzle.themes.join(", "));
  };

  const handleSaveEdit = () => {
    if (!editingPuzzle) return;

    const solution = editedSolution.split(/\s+/).filter(move => move.length > 0);
    const themes = editedThemes.split(",").map(theme => theme.trim()).filter(theme => theme.length > 0);

    const updateData = {
      _id: editingPuzzle._id,
      solution,
      themes
    };

    console.log("Submitting update:", updateData);
    updatePuzzleMutation.mutate(updateData);
  };

  const togglePuzzleSelection = (puzzleId: string) => {
    setSelectedPuzzles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(puzzleId)) {
        newSet.delete(puzzleId);
      } else {
        newSet.add(puzzleId);
      }
      return newSet;
    });
  };

  const toggleAllCurrentPage = () => {
    if (!puzzlesData) return;

    if (selectedPuzzles.size === puzzlesData.puzzles.length) {
      setSelectedPuzzles(prev => {
        const newSet = new Set(prev);
        puzzlesData.puzzles.forEach(p => newSet.delete(p._id));
        return newSet;
      });
    } else {
      setSelectedPuzzles(prev => {
        const newSet = new Set(prev);
        puzzlesData.puzzles.forEach(p => newSet.add(p._id));
        return newSet;
      });
    }
  };

  const selectPuzzleRange = () => {
    if (!puzzlesData) return;

    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);

    if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > puzzlesData.puzzles.length) {
      return;
    }

    setSelectedPuzzles(prev => {
      const newSet = new Set(prev);
      puzzlesData.puzzles.forEach((p, index) => {
        const puzzleNumber = index + 1;
        if (puzzleNumber >= start && puzzleNumber <= end) {
          newSet.add(p._id);
        }
      });
      return newSet;
    });

    setRangeStart("");
    setRangeEnd("");
  };

  const handleBulkAssign = async () => {
    if (!onAssign || !selectedStudent || selectedPuzzles.size === 0) return;

    try {
      await onAssign(Array.from(selectedPuzzles), selectedStudent);
      setSelectedPuzzles(new Set());
      setAssignmentSuccess(true);
    } catch (error) {
      console.error('Error assigning puzzles:', error);
    }
  };

  useEffect(() => {
    if (assignmentSuccess) {
      const timer = setTimeout(() => {
        setAssignmentSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [assignmentSuccess]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {assignmentSuccess && (
        <div className="bg-green-50 text-green-800 px-4 py-2 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span>Puzzles assigned successfully!</span>
        </div>
      )}
      <div className="flex gap-4 items-start">
        <div className="flex-1 space-y-2">
          <h3 className="text-sm font-medium">Filter by Themes</h3>
          <div className="flex gap-2 flex-wrap">
            {puzzlesData?.themes.map((theme) => (
              <Badge
                key={theme}
                variant={selectedThemes.includes(theme) ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedThemes((prev) =>
                    prev.includes(theme)
                      ? prev.filter((t) => t !== theme)
                      : [...prev, theme]
                  );
                  setPage(1);
                  setSelectedPuzzles(new Set());
                }}
              >
                {theme}
              </Badge>
            ))}
          </div>
        </div>

        {students && (
          <div className="w-64">
            <h3 className="text-sm font-medium mb-2">Assign to Student</h3>
            <Select
              value={selectedStudent}
              onValueChange={setSelectedStudent}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student._id} value={student._id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={puzzlesData?.puzzles.length === selectedPuzzles.size}
              onClick={toggleAllCurrentPage}
            />
            <span className="text-sm text-muted-foreground">
              {selectedPuzzles.size} puzzles selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Start"
              className="w-20"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              min="1"
            />
            <span>to</span>
            <Input
              type="number"
              placeholder="End"
              className="w-20"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              min={rangeStart || "1"}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={selectPuzzleRange}
              disabled={!rangeStart || !rangeEnd}
            >
              Select Range
            </Button>
          </div>
        </div>
        {selectedPuzzles.size > 0 && selectedStudent && (
          <Button
            onClick={handleBulkAssign}
            className="ml-auto"
          >
            Assign {selectedPuzzles.size} puzzles to selected student
          </Button>
        )}
      </div>

      <div
        ref={parentRef}
        className="h-[600px] overflow-auto border rounded-lg bg-muted/50"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const puzzle = puzzlesData?.puzzles[virtualRow.index];
            if (!puzzle) return null;

            return (
              <div
                key={puzzle._id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={`absolute top-0 left-0 w-full`}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="p-4 border-b">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedPuzzles.has(puzzle._id)}
                        onClick={() => togglePuzzleSelection(puzzle._id)}
                      />
                      <span className="text-sm font-medium">#{virtualRow.index + 1}</span>
                    </div>
                    <div className="w-64 h-64">
                      <Chessboard
                        position={puzzle.fen}
                        boardWidth={256}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {puzzle.themes.map((theme) => (
                          <Badge key={theme} variant="secondary">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Solution: {puzzle.solution.join(" ")}
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Created: {new Date(puzzle.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(puzzle)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deletePuzzleMutation.mutate(puzzle._id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPuzzle} onOpenChange={(open) => !open && setEditingPuzzle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Puzzle</DialogTitle>
            <DialogDescription>
              Modify the puzzle's solution and themes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Solution (space-separated moves)</label>
              <Input
                value={editedSolution}
                onChange={(e) => setEditedSolution(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Themes (comma-separated)</label>
              <Input
                value={editedThemes}
                onChange={(e) => setEditedThemes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPuzzle(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updatePuzzleMutation.isPending}>
              {updatePuzzleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}