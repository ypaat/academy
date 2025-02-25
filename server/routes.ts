import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { connectDB } from "./db";
import { insertClassScheduleSchema, updateProfileSchema, updatePreferencesSchema } from "@shared/schema";
import { PuzzleModel, AssignmentModel, ClassScheduleModel, UserModel } from "./models/index";
import { parseISO, addMinutes, formatISO, isAfter, isBefore } from 'date-fns';
import { comparePasswords, hashPassword } from "./auth";
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseUrl } from 'url';
import { IncomingMessage } from 'http';

const classroomSockets = new Map<string, Set<WebSocket>>();

export async function registerRoutes(app: Express): Promise<Server> {
  await connectDB();
  await setupAuth(app);

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

  // Auth routes
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.user) return res.sendStatus(401);
    res.json(req.user);
  });

  // Coach routes
  function requireCoach(req: Request, res: Response, next: NextFunction) {
    console.log("Auth middleware - User:", req.user);
    if (!req.user || (req.user as any).role !== "coach") {
      console.log("Auth middleware - Access denied, user role:", (req.user as any)?.role);
      return res.status(403).json({ message: "Coach access required" });
    }
    next();
  }

  app.post("/api/students", requireCoach, async (req, res) => {
    try {
      const data = createStudentSchema.parse(req.body);
      const student = await storage.createStudent(data);
      res.status(201).json(student);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get("/api/students", requireCoach, async (req, res) => {
    try {
      const students = await storage.getStudents();
      res.json(students);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Add puzzle creation route
  app.post("/api/puzzles", requireCoach, async (req, res) => {
    try {
      const puzzle = await PuzzleModel.create({
        ...req.body,
        createdBy: (req.user as any)._id,
      });
      res.status(201).json(puzzle);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get("/api/puzzles/ids", requireCoach, async (req, res) => {
    try {
      const themeFilter = (req.query.themes as string)?.split(",").filter(Boolean);
      const query = themeFilter?.length
        ? { themes: { $in: themeFilter } }
        : {};

      const puzzleIds = await PuzzleModel.find(query)
        .select('_id')
        .lean();

      res.json(puzzleIds.map(p => p._id));
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Puzzle routes
  app.get("/api/puzzles", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const themeFilter = (req.query.themes as string)?.split(",").filter(Boolean);

      const query = themeFilter?.length
        ? { themes: { $in: themeFilter } }
        : {};

      const [puzzles, total, themes] = await Promise.all([
        PuzzleModel.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        PuzzleModel.countDocuments(query),
        PuzzleModel.distinct("themes"),
      ]);

      res.json({
        puzzles,
        total,
        themes,
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Assignment routes
  app.post("/api/assignments", requireCoach, async (req, res) => {
    try {
      const { puzzleId, studentId } = req.body;

      // Verify puzzle and student exist
      const [puzzle, student] = await Promise.all([
        PuzzleModel.findById(puzzleId),
        storage.getUser(studentId),
      ]);

      if (!puzzle || !student) {
        return res.status(404).json({ message: "Puzzle or student not found" });
      }

      if (student.role !== "student") {
        return res.status(400).json({ message: "Can only assign to students" });
      }

      const assignment = await AssignmentModel.create({
        puzzleId,
        studentId,
        completed: false,
      });

      res.status(201).json(assignment);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Add new route to fetch student puzzles with attempts
  app.get("/api/students/:studentId/puzzles", requireCoach, async (req, res) => {
    try {
      const assignments = await AssignmentModel.find({
        studentId: req.params.studentId
      })
        .populate({
          path: 'puzzleId',
          select: 'fen solution themes'
        })
        .sort({ assignedAt: -1 })
        .lean();

      const puzzles = assignments.map(assignment => ({
        _id: assignment._id,
        puzzleId: assignment.puzzleId._id,
        completed: assignment.completed,
        assignedAt: assignment.assignedAt,
        attempts: assignment.attempts || [],
        puzzle: {
          fen: assignment.puzzleId.fen,
          solution: assignment.puzzleId.solution,
          themes: assignment.puzzleId.themes,
        }
      }));

      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Student puzzle routes
  app.get("/api/my/assignments", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);
      if ((req.user as any).role !== "student") return res.sendStatus(403);

      const assignments = await AssignmentModel.find({
        studentId: (req.user as any)._id,
        completed: false
      })
        .populate({
          path: 'puzzleId',
          select: 'fen solution themes'
        })
        .sort({ assignedAt: -1 })
        .lean();

      const puzzles = assignments.map(assignment => ({
        _id: assignment._id,
        completed: assignment.completed,
        assignedAt: assignment.assignedAt,
        attempts: assignment.attempts || [],
        puzzle: {
          fen: assignment.puzzleId.fen,
          solution: assignment.puzzleId.solution,
          themes: assignment.puzzleId.themes,
        }
      }));

      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/my/completed", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);
      if ((req.user as any).role !== "student") return res.sendStatus(403);

      const assignments = await AssignmentModel.find({
        studentId: (req.user as any)._id,
        completed: true
      })
        .populate({
          path: 'puzzleId',
          select: 'fen solution themes'
        })
        .sort({ assignedAt: -1 })
        .lean();

      const puzzles = assignments.map(assignment => ({
        _id: assignment._id,
        completed: assignment.completed,
        assignedAt: assignment.assignedAt,
        attempts: assignment.attempts || [],
        puzzle: {
          fen: assignment.puzzleId.fen,
          solution: assignment.puzzleId.solution,
          themes: assignment.puzzleId.themes,
        }
      }));

      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/assignments/:assignmentId/complete", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);
      if ((req.user as any).role !== "student") return res.sendStatus(403);

      const { moves } = req.body;

      const assignment = await AssignmentModel.findOneAndUpdate(
        {
          _id: req.params.assignmentId,
          studentId: (req.user as any)._id,
          completed: false
        },
        {
          $set: { completed: true },
          $push: { attempts: { moves, timestamp: new Date() } }
        },
        { new: true }
      );

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found or already completed" });
      }

      res.json(assignment);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Add new route to record attempt without completing
  app.post("/api/assignments/:assignmentId/attempt", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);
      if ((req.user as any).role !== "student") return res.sendStatus(403);

      const { moves } = req.body;

      const assignment = await AssignmentModel.findOneAndUpdate(
        {
          _id: req.params.assignmentId,
          studentId: (req.user as any)._id,
        },
        {
          $push: { attempts: { moves, timestamp: new Date() } }
        },
        { new: true }
      );

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json(assignment);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Add delete puzzle assignment route
  app.delete("/api/students/:studentId/puzzles/:puzzleId", requireCoach, async (req, res) => {
    try {
      console.log("Deleting puzzle assignment:", req.params);
      const result = await AssignmentModel.findOneAndDelete({
        _id: req.params.puzzleId,
        studentId: req.params.studentId,
        completed: false // Only allow deleting uncompleted assignments
      });

      if (!result) {
        return res.status(404).json({ message: "Assignment not found or already completed" });
      }

      console.log("Successfully deleted puzzle assignment:", result);
      res.json({ message: "Assignment deleted successfully" });
    } catch (error) {
      console.error("Error deleting puzzle assignment:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });


  // Class Schedule Routes
  app.post("/api/class-schedules", requireCoach, async (req, res) => {
    try {
      console.log("Creating class schedule - User:", req.user);
      const userTimezone = req.body.timezone || "UTC";
      console.log("Using timezone:", userTimezone);

      // Convert times to UTC using native Date methods
      const localStartTime = new Date(req.body.startTime);
      const localEndTime = new Date(req.body.endTime);

      // Get UTC ISO strings
      const startTimeUTC = localStartTime.toISOString();
      const endTimeUTC = localEndTime.toISOString();

      console.log("Request body:", req.body);
      console.log("Converted start time to UTC:", startTimeUTC);
      console.log("Converted end time to UTC:", endTimeUTC);

      // Get user's default preferences
      const user = await UserModel.findById((req.user as any)._id);
      console.log("User preferences:", user?.preferences);
      const preferences = user?.preferences || {};

      const data = insertClassScheduleSchema.parse({
        ...req.body,
        coachId: (req.user as any)._id,
        startTime: startTimeUTC,
        endTime: endTimeUTC,
        timezone: userTimezone,
        // Use default meeting settings if not provided
        meetingProvider: req.body.meetingProvider || preferences.defaultMeetingProvider,
        meetingUrl: req.body.meetingUrl || preferences.defaultMeetingUrl,
      });

      console.log("Parsed schedule data:", data);
      const schedule = await ClassScheduleModel.create(data);
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating class schedule:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get("/api/class-schedules/coach", requireCoach, async (req, res) => {
    try {
      const schedules = await ClassScheduleModel.find({
        coachId: (req.user as any)._id
      })
        .populate('studentIds', 'name username')
        .populate('attendees', 'name username')
        .sort({ startTime: 1 })
        .lean();

      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/class-schedules/student", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);
      if ((req.user as any).role !== "student") return res.sendStatus(403);

      const schedules = await ClassScheduleModel.find({
        studentIds: (req.user as any)._id
      })
        .populate('coachId', 'name')
        .sort({ startTime: 1 })
        .lean();

      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/class-schedules/:scheduleId/start", requireCoach, async (req, res) => {
    try {
      const now = new Date();
      const schedule = await ClassScheduleModel.findOne({
        _id: req.params.scheduleId,
        coachId: (req.user as any)._id
      });

      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      const userTimezone = schedule.timezone || "UTC";
      const startTime = new Date(schedule.startTime);
      const earlyAccessTime = addMinutes(startTime, -10);

      if (isBefore(now, earlyAccessTime)) {
        return res.status(400).json({ message: "Too early to start class" });
      }

      if (schedule.status === "completed") {
        return res.status(400).json({ message: "Class is already completed" });
      }

      schedule.status = "in_progress";
      schedule.actualStartTime = now;
      await schedule.save();

      const populatedSchedule = await ClassScheduleModel.findById(schedule._id)
        .populate('studentIds', 'name username')
        .populate('attendees', 'name username')
        .lean();

      if (!populatedSchedule) {
        return res.status(404).json({ message: "Schedule not found after update" });
      }

      res.json(populatedSchedule);
    } catch (error) {
      console.error("Error starting class:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/class-schedules/:scheduleId/end", requireCoach, async (req, res) => {
    try {
      const schedule = await ClassScheduleModel.findOneAndUpdate(
        {
          _id: req.params.scheduleId,
          coachId: (req.user as any)._id,
          status: "in_progress"
        },
        {
          $set: {
            status: "completed",
            actualEndTime: new Date()
          }
        },
        { new: true }
      ).populate('studentIds', 'name username')
       .populate('attendees', 'name username');

      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found or cannot be ended" });
      }

      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/class-schedules/:scheduleId/attend", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);
      if ((req.user as any).role !== "student") return res.sendStatus(403);

      const schedule = await ClassScheduleModel.findOneAndUpdate(
        {
          _id: req.params.scheduleId,
          status: "in_progress",
          studentIds: (req.user as any)._id,
          attendees: { $ne: (req.user as any)._id }
        },
        {
          $addToSet: { attendees: (req.user as any)._id }
        },
        { new: true }
      ).populate('studentIds', 'name username')
       .populate('attendees', 'name username');

      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found or attendance already marked" });
      }

      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });


  // Profile and preferences routes
  app.put("/api/profile", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);

      const data = updateProfileSchema.parse(req.body);
      const userId = (req.user as any)._id;

      // If password update is requested
      if (data.currentPassword && data.newPassword) {
        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isValidPassword = await comparePasswords(data.currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Update password
        const hashedPassword = await hashPassword(data.newPassword);
        await UserModel.findByIdAndUpdate(userId, {
          name: data.name,
          email: data.email,
          password: hashedPassword,
        });
      } else {
        // Update profile without password
        await UserModel.findByIdAndUpdate(userId, {
          name: data.name,
          email: data.email,
        });
      }

      const updatedUser = await UserModel.findById(userId);
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.put("/api/preferences", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);
      if ((req.user as any).role !== "coach") return res.sendStatus(403);

      const data = updatePreferencesSchema.parse(req.body);
      const userId = (req.user as any)._id;

      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        {
          preferences: {
            defaultMeetingProvider: data.defaultMeetingProvider,
            defaultMeetingUrl: data.defaultMeetingUrl,
          }
        },
        { new: true }
      );

      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Get coach preferences
  app.get("/api/preferences", async (req, res) => {
    try {
      if (!req.user) return res.sendStatus(401);
      if ((req.user as any).role !== "coach") return res.sendStatus(403);

      const user = await UserModel.findById((req.user as any)._id);
      res.json(user?.preferences || {});
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/puzzles/update", requireCoach, async (req, res) => {
    try {
      const { puzzleId, solution, themes } = req.body;

      if (!puzzleId || !solution || !themes) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const updatedPuzzle = await PuzzleModel.findByIdAndUpdate(
        puzzleId,
        { $set: { solution, themes } },
        { new: true }
      );

      if (!updatedPuzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }

      res.json(updatedPuzzle);
    } catch (error) {
      console.error("Error updating puzzle:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/puzzles/delete", requireCoach, async (req, res) => {
    try {
      const { puzzleId } = req.body;

      if (!puzzleId) {
        return res.status(400).json({ message: "Missing puzzle ID" });
      }

      const deletedPuzzle = await PuzzleModel.findByIdAndDelete(puzzleId);

      if (!deletedPuzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }

      res.json({ message: "Puzzle deleted successfully" });
    } catch (error) {
      console.error("Error deleting puzzle:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  return httpServer;
}
