import { useState, useEffect } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  parseISO,
  isAfter,
  isBefore,
  addMinutes,
  subDays
} from "date-fns";

import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Trophy,
  CheckCircle2,
  BookOpen,
  Video,
  CalendarDays,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { StudentPuzzleSolver } from "@/components/StudentPuzzleSolver";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast"; // Changed import location

type ClassStatus = "not_started" | "in_progress" | "completed";

type ClassSchedule = {
  _id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: ClassStatus;
  timezone: string;
  meetingUrl: string;
  meetingProvider: "zoom" | "google_meet";
  actualStartTime?: string;
  actualEndTime?: string;
};

type Attendance = {
  scheduleId: string;
  // Add other attendance fields as needed
};


export default function StudentDashboard() {
  const { user, logoutMutation } = useAuth();
  const [activeSection, setActiveSection] = useState<'puzzles' | 'completed' | 'schedule' | 'preferences'>('schedule');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [puzzleSolverOpen, setPuzzleSolverOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"30" | "60" | "90" | "120">("30");
  const [joinedClasses, setJoinedClasses] = useState<Set<string>>(() => new Set());
  const [, setLocation] = useLocation();

  console.log("StudentDashboard - User:", user);

  const markAttendanceMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      console.log("Marking attendance for schedule:", scheduleId);
      const res = await apiRequest("POST", `/api/class-schedules/${scheduleId}/attend`, {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to mark attendance');
      }
      return res.json();
    },
    onSuccess: (data, scheduleId) => {
      // Update both queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/class-schedules/student"] });
      queryClient.invalidateQueries({ queryKey: ["/api/class-schedules/attendance"] });
      setJoinedClasses(prev => new Set([...Array.from(prev), scheduleId]));
    },
    onError: (error: Error) => {
      console.error("Attendance marking failed:", error);
      toast({
        title: "Failed to join class",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const {
    data: assignedPuzzles = [],
    isLoading: isLoadingAssigned
  } = useQuery<Assignment[]>({
    queryKey: ["/api/my/assignments"],
  });

  const {
    data: completedPuzzles = [],
    isLoading: isLoadingCompleted
  } = useQuery<Assignment[]>({
    queryKey: ["/api/my/completed"],
  });

  const {
    data: schedules = [],
    isLoading: isLoadingSchedules
  } = useQuery<ClassSchedule[]>({
    queryKey: ["/api/class-schedules/student"],
  });

  // Add attendance data query
  const {
    data: attendanceData = [],
    isLoading: isLoadingAttendance
  } = useQuery<Attendance[]>({
    queryKey: ["/api/class-schedules/attendance"],
  });

  useEffect(() => {
    // Update joinedClasses when attendance data changes
    setJoinedClasses(new Set(attendanceData.map(a => a.scheduleId)));
  }, [attendanceData]);


  const uncompletedPuzzles = assignedPuzzles.filter(
    puzzle => !completedPuzzles.some(
      completed => completed.puzzle._id === puzzle.puzzle._id
    )
  );

  console.log('Assigned Puzzles:', assignedPuzzles);
  console.log('Completed Puzzles:', completedPuzzles);
  console.log('Uncompleted Puzzles:', uncompletedPuzzles);
  console.log('Class Schedules:', schedules);

  const handlePuzzleComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/my/assignments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/my/completed"] });

    if (currentPuzzleIndex === assignedPuzzles.length - 1) {
      setPuzzleSolverOpen(false);
      setCurrentPuzzleIndex(0);
    }
  };

  const handleNextPuzzle = () => {
    if (currentPuzzleIndex < assignedPuzzles.length - 1) {
      setCurrentPuzzleIndex(prev => prev + 1);
    }
  };

  const handlePrevPuzzle = () => {
    if (currentPuzzleIndex > 0) {
      setCurrentPuzzleIndex(prev => prev - 1);
    }
  };

  const processedSchedules = schedules.map(schedule => updateClassStatus(schedule));
  const activeClasses = filterSchedulesByStatus(processedSchedules, "in_progress");
  const pastClasses = filterSchedulesByDate(filterSchedulesByStatus(processedSchedules, "completed"), parseInt(timePeriod));
  const upcomingClasses = filterSchedulesByStatus(processedSchedules, "not_started");

  const timeOptions = [
    { value: '30', label: 'Past 30 Days' },
    { value: '60', label: 'Past 60 Days' },
    { value: '90', label: 'Past 90 Days' },
    { value: '120', label: 'Past 120 Days' },
  ];

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log("User's timezone:", userTimezone);

  const handleJoinClass = async (schedule: ClassSchedule, e: React.MouseEvent) => {
    e.preventDefault();
    if (hasStudentJoined(schedule)) {
      if (schedule.meetingUrl) {
        window.open(schedule.meetingUrl, '_blank');
      }
    } else {
      try {
        await markAttendanceMutation.mutateAsync(schedule._id);
        if (schedule.meetingUrl) {
          window.open(schedule.meetingUrl, '_blank');
        }
      } catch (error) {
        console.error("Failed to join class:", error);
        toast({
          title: "Failed to join class",
          description: (error as Error).message,
          variant: "destructive"
        });
      }
    }
  };

  const hasStudentJoined = (schedule: ClassSchedule) => {
    const isJoined = joinedClasses.has(schedule._id) || 
                    attendanceData.some(a => a.scheduleId === schedule._id);
    console.log(`Checking if joined class ${schedule._id}:`, isJoined);
    return isJoined;
  };

  if (isLoadingAssigned || isLoadingCompleted || isLoadingSchedules || isLoadingAttendance) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const currentPuzzle = assignedPuzzles[currentPuzzleIndex];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <div className={cn(
          "border-r p-4 space-y-2 transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
          <div className="flex items-center gap-2 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
            {!sidebarCollapsed && (
              <>
                <ChevronsUpDown className="h-6 w-6" />
                <h1 className="text-xl font-bold">Chess Training</h1>
              </>
            )}
          </div>

          <NavigationCard
            icon={CalendarDays}
            label={sidebarCollapsed ? "" : "My Classes"}
            section="schedule"
            onClick={() => setActiveSection('schedule')}
            isActive={activeSection === 'schedule'}
          />
          <NavigationCard
            icon={BookOpen}
            label={sidebarCollapsed ? "" : "Assigned Puzzles"}
            section="puzzles"
            onClick={() => setActiveSection('puzzles')}
            isActive={activeSection === 'puzzles'}
          />
          <NavigationCard
            icon={Trophy}
            label={sidebarCollapsed ? "" : "Completed Puzzles"}
            section="completed"
            onClick={() => setActiveSection('completed')}
            isActive={activeSection === 'completed'}
          />
          <NavigationCard
            icon={Settings}
            label={sidebarCollapsed ? "" : "Profile Settings"}
            section="preferences"
            onClick={() => setLocation("/preferences")}
            isActive={activeSection === 'preferences'}
          />

          <div className="mt-auto pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-4 w-4" />
              {!sidebarCollapsed && <span className="ml-2">Logout</span>}
            </Button>
          </div>
        </div>

        <div className={cn(
          "flex-1 p-6 transition-all duration-300",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}>
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold">Welcome back, {user?.name}!</h1>
                <p className="text-muted-foreground mt-1">
                  Continue your chess training journey
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">
                    <span className="mr-2">{assignedPuzzles?.length || 0}</span>
                    <BookOpen className="h-5 w-5 inline-block text-blue-500" />
                  </CardTitle>
                  <CardDescription>Puzzles to Solve</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">
                    <span className="mr-2">{completedPuzzles?.length || 0}</span>
                    <Trophy className="h-5 w-5 inline-block text-yellow-500" />
                  </CardTitle>
                  <CardDescription>Total Completed</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">
                    <span className="mr-2">{activeClasses.length}</span>
                    <Video className="h-5 w-5 inline-block text-green-500" />
                  </CardTitle>
                  <CardDescription>Active Classes</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">
                    <span className="mr-2">{upcomingClasses.length}</span>
                    <CalendarDays className="h-5 w-5 inline-block text-purple-500" />
                  </CardTitle>
                  <CardDescription>Upcoming Classes</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {activeSection === 'schedule' && (
              <div className="space-y-6">
                {activeClasses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-green-500" />
                        Active Classes
                      </CardTitle>
                      <CardDescription>Classes that are currently in session</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {activeClasses.map((schedule: ClassSchedule) => (
                          <div key={schedule._id} className="border rounded-lg p-4 space-y-4 bg-primary/5">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{schedule.title}</h3>
                                  {getClassStatusBadge(schedule.status, schedule.startTime)}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {schedule.description}
                                </p>
                                <div className="flex gap-2 text-sm text-muted-foreground mt-2">
                                  <span>
                                    {new Date(schedule.startTime) > new Date()
                                      ? "Starts at: "
                                      : "Started at: "
                                    }
                                    {formatScheduleTime(schedule.startTime, schedule.timezone || userTimezone)}
                                  </span>
                                  <span>•</span>
                                  <span>Ends at: {formatScheduleTime(schedule.endTime, schedule.timezone || userTimezone)}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="lg"
                                  className="gap-2"
                                  onClick={(e) => handleJoinClass(schedule, e)}
                                >
                                  <Video className="h-4 w-4 mr-2" />
                                  {hasStudentJoined(schedule) ? "Rejoin Class" : "Join Class"}
                                </Button>
                                {hasStudentJoined(schedule) && (
                                  <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => setLocation(`/classroom/${schedule._id}`)}
                                  >
                                    <BookOpen className="h-4 w-4 mr-2" />
                                    Open Classroom Board
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {upcomingClasses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Upcoming Classes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {upcomingClasses.map((schedule: ClassSchedule) => (
                          <div
                            key={schedule._id}
                            className="border rounded-lg p-4 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{schedule.title}</h3>
                                  {getClassStatusBadge(schedule.status, schedule.startTime)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {schedule.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 text-sm text-muted-foreground">
                              <span>{formatScheduleTime(schedule.startTime, schedule.timezone || userTimezone)}</span>
                              <span>-</span>
                              <span>{formatScheduleTime(schedule.endTime, schedule.timezone || userTimezone)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Past Classes</span>
                      <Select
                        value={timePeriod}
                        onValueChange={(value: "30" | "60" | "90" | "120") => setTimePeriod(value)}
                      >
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
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pastClasses.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No completed classes in the selected time period
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {filterSchedulesByDate(pastClasses, parseInt(timePeriod)).map((schedule: ClassSchedule) => (
                          <div
                            key={schedule._id}
                            className="border rounded-lg p-4 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{schedule.title}</h3>
                                  {getClassStatusBadge(schedule.status, schedule.startTime)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {schedule.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 text-sm text-muted-foreground">
                              <span>{formatScheduleTime(schedule.startTime, schedule.timezone || userTimezone)}</span>
                              <span>-</span>
                              <span>{formatScheduleTime(schedule.endTime, schedule.timezone || userTimezone)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'puzzles' && (
              <div className="space-y-4">
                {!assignedPuzzles || assignedPuzzles.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Puzzles Assigned</h3>
                      <p className="text-muted-foreground">
                        You're all caught up! Check back later for new puzzles from your coach.
                      </p>
                    </CardContent>
                  </Card>
                ) : puzzleSolverOpen && assignedPuzzles[currentPuzzleIndex] ? (
                  <div className="fixed inset-0 bg-background z-50">
                    <div className="container max-w-7xl mx-auto py-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            onClick={() => setPuzzleSolverOpen(false)}
                            className="group"
                          >
                            <ChevronLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
                            Back to Dashboard
                          </Button>
                          <div>
                            <h2 className="text-2xl font-bold">Puzzle Solving</h2>
                            <p className="text-muted-foreground">
                              Puzzle {currentPuzzleIndex + 1} of {assignedPuzzles.length}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={handlePrevPuzzle}
                            disabled={currentPuzzleIndex === 0}
                          >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleNextPuzzle}
                            disabled={currentPuzzleIndex === assignedPuzzles.length - 1}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                      <StudentPuzzleSolver
                        puzzle={{
                          _id: assignedPuzzles[currentPuzzleIndex]._id,
                          puzzleId: assignedPuzzles[currentPuzzleIndex].puzzle._id,
                          fen: assignedPuzzles[currentPuzzleIndex].puzzle.fen,
                          solution: assignedPuzzles[currentPuzzleIndex].puzzle.solution,
                          themes: assignedPuzzles[currentPuzzleIndex].puzzle.themes,
                          playerMovesFirst: true
                        }}
                        onComplete={handlePuzzleComplete}
                        onNext={handleNextPuzzle}
                      />
                    </div>
                  </div>
                ) : assignedPuzzles[currentPuzzleIndex] ? (
                  <Card
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setPuzzleSolverOpen(true)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="w-32 h-32">
                      </div>
                      <div>
                        <div className="flex gap-2 mb-2">
                          {assignedPuzzles[currentPuzzleIndex].puzzle.themes.map((theme: string) => (
                            <Badge key={theme} variant="secondary">{theme}</Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Click to start solving puzzles ({assignedPuzzles.length} remaining)
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Assigned: {new Date(assignedPuzzles[currentPuzzleIndex].assignedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            )}

            {activeSection === 'completed' && (
              <div className="space-y-4">
                {!completedPuzzles || completedPuzzles.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Completed Puzzles</h3>
                      <p className="text-muted-foreground">
                        Start solving puzzles to track your progress here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div>
                    <Select value={timePeriod} onValueChange={(value: "30" | "60" | "90" | "120") => setTimePeriod(value)}>
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
                    {filterCompletedPuzzlesByTime(completedPuzzles, parseInt(timePeriod)).map((puzzle: Assignment) => (
                      <Card key={puzzle._id}>
                        <CardContent className="flex items-center gap-4 p-4">
                          <div className="w-32 h-32">
                          </div>
                          <div>
                            <div className="flex gap-2 mb-2">
                              {puzzle.puzzle.themes.map((theme: string) => (
                                <Badge key={theme} variant="secondary">{theme}</Badge>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Completed: {new Date(puzzle.assignedAt).toLocaleDateString()}
                            </p>
                            <Badge variant="outline">
                              Solved in {puzzle.attempts.length} attempt{puzzle.attempts.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type PuzzleAttempt = {
  moves: string[];
  timestamp: string;
};

type Puzzle = {
  _id: string;
  fen: string;
  solution: string[];
  themes: string[];
};

type Assignment = {
  _id: string;
  puzzleId?: string;
  completed: boolean;
  assignedAt: string;
  attempts: PuzzleAttempt[];
  puzzle: Puzzle;
};

type NavigationCardProps = {
  icon: React.ElementType;
  label: string;
  section: 'puzzles' | 'completed' | 'schedule' | 'preferences';
  onClick: () => void;
  isActive: boolean;
};

const NavigationCard = ({ icon: Icon, label, onClick, isActive }: NavigationCardProps) => (
  <Card
    className={`cursor-pointer transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-muted'}`}
    onClick={onClick}
  >
    <CardContent className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
    </CardContent>
  </Card>
);

const filterSchedulesByStatus = (schedules: ClassSchedule[], status?: string): ClassSchedule[] => {
  if (!status) return schedules;
  return schedules.filter(s => s.status === status);
};

const filterSchedulesByDate = (schedules: ClassSchedule[], days: number = 30): ClassSchedule[] => {
  const now = new Date();
  const cutoff = new Date(now.setDate(now.getDate() - days));
  return schedules.filter(schedule => {
    const scheduleDate = new Date(schedule.startTime);
    return scheduleDate >= cutoff;
  });
};

const getClassStatusBadge = (status: string, startTime: string) => {
  const now = new Date();
  const classStart = new Date(startTime);
  const isEarlyAccess = now >= new Date(classStart.getTime() - 10 * 60 * 1000) && now < classStart;

  switch (status) {
    case "not_started":
      return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">Not Started</span>;
    case "in_progress":
      return (
        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
          {isEarlyAccess ? "Early Access" : "In Progress"}
        </span>
      );
    case "completed":
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">Completed</span>;
    default:
      return null;
  }
};

const formatScheduleTime = (isoString: string, timezone: string) => {
  const date = parseISO(isoString);
  return format(date, 'MMMM d, h:mm a');
};

const updateClassStatus = (schedule: ClassSchedule) => {
  const now = new Date();
  const startTime = parseISO(schedule.startTime);
  const endTime = parseISO(schedule.endTime);
  const earlyAccessTime = addMinutes(startTime, -10);

  if (isAfter(now, endTime)) {
    return { ...schedule, status: "completed" };
  } else if (isAfter(now, earlyAccessTime)) {
    return { ...schedule, status: "in_progress" };
  }
  return { ...schedule, status: "not_started" };
};

const filterCompletedPuzzlesByTime = (puzzles: Assignment[] = [], days: number): Assignment[] => {
  const now = new Date();
  const cutoff = subDays(now, days);
  return puzzles.filter(puzzle => {
    const completedDate = parseISO(puzzle.assignedAt);
    return isAfter(completedDate, cutoff);
  });
};