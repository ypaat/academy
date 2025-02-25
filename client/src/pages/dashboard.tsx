import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreateStudent, User, InsertPuzzle, InsertClassSchedule } from "@shared/schema";
import { useLocation } from "wouter";
import {
  GraduationCap,
  Loader2,
  LogOut,
  PlusSquare,
  BookOpen,
  UserPlus,
  Users,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Gamepad2,
  FlaskConical,
  CalendarDays,
  Video,
  Settings
} from "lucide-react";
import { PuzzleCreator } from "@/components/PuzzleCreator";
import { cn } from "@/lib/utils";
import { PuzzleList } from "@/components/PuzzleList";
import { StudentPuzzles } from "@/components/StudentPuzzles";
import { AnalysisBoard } from "@/components/AnalysisBoard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, formatISO, parseISO, isAfter, isBefore, addMinutes, subDays } from "date-fns";


type Student = {
  _id: string;
  name: string;
};

type NavigationCardProps = {
  icon: React.ElementType;
  label: string;
  section: 'students' | 'puzzles' | 'board-editor' | 'assignments' | 'analysis' | 'schedule' | 'preferences';
  onClick: () => void;
  isActive: boolean;
};

const NavigationCard = ({ icon: Icon, label, section, onClick, isActive }: NavigationCardProps) => (
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

interface ClassScheduleFormData {
  title: string;
  description: string;
  studentIds: string[];
  startTime: string;
  endTime: string;
  meetingProvider: "zoom" | "google_meet";
  meetingUrl: string;
  duration?: number;
}

type ClassSchedule = {
  _id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: "not_started" | "in_progress" | "completed" | "expired";
  timezone: string;
  meetingUrl: string;
  meetingProvider: "zoom" | "google_meet";
  actualStartTime?: string;
  actualEndTime?: string;
  attendees: { userId: string; name: string }[];
  studentIds: string[];
};

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [newStudent, setNewStudent] = useState<{ username: string; name: string }>({ username: "", name: "" });
  const [activeSection, setActiveSection] = useState<'students' | 'puzzles' | 'board-editor' | 'assignments' | 'analysis' | 'schedule' | 'preferences'>('students');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState("30"); 

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ["/api/preferences"],
    enabled: user?.role === "coach",
  });

  const [newSchedule, setNewSchedule] = useState<ClassScheduleFormData>({
    title: "",
    description: "",
    studentIds: [],
    startTime: "",
    endTime: "",
    duration: 60,
    meetingProvider: "zoom",
    meetingUrl: ""
  });

  useEffect(() => {
    if (preferences) {
      setNewSchedule(prev => ({
        ...prev,
        meetingProvider: preferences.defaultMeetingProvider || prev.meetingProvider,
        meetingUrl: preferences.defaultMeetingUrl || prev.meetingUrl
      }));
    }
  }, [preferences]);

  const { data: students, isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    enabled: user?.role === "coach",
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["/api/class-schedules", user?.role],
    queryFn: async () => {
      const endpoint = user?.role === "coach" ? "/api/class-schedules/coach" : "/api/class-schedules/student";
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json();
    },
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: CreateStudent) => {
      const res = await apiRequest("POST", "/api/students", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setNewStudent({ username: "", name: "" });
    },
    onError: (error: Error) => {
    }
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: InsertClassSchedule) => {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log("Dashboard - Creating schedule with timezone:", userTimezone);

      const scheduleData = {
        ...data,
        timezone: userTimezone
      };
      console.log("Dashboard - Schedule data being sent:", scheduleData);

      const res = await apiRequest("POST", "/api/class-schedules", scheduleData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-schedules", user?.role] });
      console.log("Dashboard - Schedule created successfully");
    },
    onError: (error: Error) => {
      console.error("Dashboard - Failed to create schedule:", error);
    }
  });

  const createPuzzleMutation = useMutation({
    mutationFn: async (puzzle: InsertPuzzle) => {
      const res = await apiRequest("POST", "/api/puzzles", puzzle);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/puzzles"] });
    },
  });

  const startClassMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      console.log("Starting class for schedule:", scheduleId);
      const res = await apiRequest("POST", `/api/class-schedules/${scheduleId}/start`, {
        actualStartTime: new Date().toISOString()
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to start class');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-schedules", user?.role] });
      window.open(data.meetingUrl, '_blank');
    },
    onError: (error: Error) => {
      console.error("Failed to start class:", error);
    }
  });

  const endClassMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      console.log("Ending class for schedule:", scheduleId);
      const res = await apiRequest("POST", `/api/class-schedules/${scheduleId}/end`, {
        actualEndTime: new Date().toISOString()
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to end class');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-schedules", user?.role] });
    },
    onError: (error: Error) => {
      console.error("Failed to end class:", error);
    }
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      console.log("Marking attendance for schedule:", scheduleId);
      const res = await apiRequest("POST", `/api/class-schedules/${scheduleId}/attend`, {
        userId: user?._id,
        name: user?.name
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to mark attendance');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-schedules", user?.role] });
    },
    onError: (error: Error) => {
      console.error("Attendance marking failed:", error);
    }
  });

  const hasStudentJoined = (schedule: ClassSchedule) => {
    return schedule.attendees?.some(attendee => attendee.userId === user?._id);
  };

  const canJoinClass = (schedule: ClassSchedule) => {
    if (schedule.status === "expired") return false;
    const now = new Date();
    const startTime = parseISO(schedule.startTime);
    const endTime = parseISO(schedule.endTime);
    return isBefore(now, endTime) &&
           (isAfter(now, startTime) || schedule.actualStartTime);
  };

  const isClassExpired = (schedule: ClassSchedule) => {
    const now = new Date();
    const endTime = parseISO(schedule.endTime);
    return isAfter(now, endTime) &&
           (!schedule.actualStartTime || schedule.attendees?.length === 0);
  };

  const isClassCompleted = (schedule: ClassSchedule) => {
    const now = new Date();
    const endTime = parseISO(schedule.endTime);
    return (
      isAfter(now, endTime) || 
      schedule.actualEndTime || 
      (schedule.actualStartTime && isAfter(now, endTime)) 
    );
  };

  const formatTime = (isoString: string, timezone: string) => {
    const date = parseISO(isoString);
    return format(date, 'MMMM d, h:mm a');
  };

  const isClassActive = (schedule: ClassSchedule) => {
    const now = new Date();
    const startTime = parseISO(schedule.startTime);
    const endTime = parseISO(schedule.endTime);
    return (
      (schedule.actualStartTime && !schedule.actualEndTime && !isClassCompleted(schedule)) || 
      (isAfter(now, startTime) && isBefore(now, endTime)) 
    );
  };

  const activeClasses = (schedules || []).filter(schedule => 
    isClassActive(schedule) && !isClassCompleted(schedule)
  );

  const upcomingClasses = (schedules || []).filter(schedule => {
    const now = new Date();
    const startTime = parseISO(schedule.startTime);
    return (
      !schedule.actualStartTime && 
      !schedule.actualEndTime && 
      isAfter(startTime, now) && 
      !isClassCompleted(schedule) 
    );
  });

  const pastClasses = (schedules || []).filter(schedule => 
    isClassCompleted(schedule)
  ).sort((a, b) => 
    new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
  );

  const canStartClass = (schedule: ClassSchedule) => {
    const now = new Date();
    const startTime = parseISO(schedule.startTime);
    const earlyAccessTime = addMinutes(startTime, -10);
    return isAfter(now, earlyAccessTime) && isBefore(now, startTime);
  };

  useEffect(() => {
    const checkForExpiredClasses = async () => {
      const now = new Date();
      const expiredClasses = activeClasses.filter(schedule => {
        const endTime = parseISO(schedule.endTime);
        return isAfter(now, endTime) && !schedule.actualEndTime;
      });

      for (const schedule of expiredClasses) {
        try {
          await endClassMutation.mutateAsync(schedule._id);
        } catch (error) {
          console.error("Failed to auto-complete class:", error);
        }
      }
    };

    const interval = setInterval(checkForExpiredClasses, 60000);

    checkForExpiredClasses();

    return () => clearInterval(interval);
  }, [activeClasses, endClassMutation]);

  function getClassStatusBadge(status: string) {
    switch (status) {
      case "not_started":
        return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">Not Started</span>;
      case "in_progress":
        return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">In Progress</span>;
      case "completed":
        return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">Completed</span>;
      case "expired":
        return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">Expired</span>;
      default:
        return null;
    }
  }

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Dashboard - Submitting schedule with data:", newSchedule);

    const startDateTime = parseISO(newSchedule.startTime);
    const endDateTime = addMinutes(startDateTime, newSchedule.duration || 60);

    const scheduleData = {
      ...newSchedule,
      startTime: formatISO(startDateTime),
      endTime: formatISO(endDateTime)
    };

    console.log("Dashboard - Schedule data being sent:", scheduleData);

    createScheduleMutation.mutate(scheduleData as InsertClassSchedule);
    setNewSchedule({
      title: "",
      description: "",
      studentIds: [],
      startTime: "",
      endTime: "",
      duration: 60,
      meetingProvider: "zoom",
      meetingUrl: ""
    });
  };

  if (!user) return null;

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

          {user.role === "coach" && (
            <>
              <NavigationCard
                icon={Users}
                label={sidebarCollapsed ? "" : "Students"}
                section="students"
                onClick={() => setActiveSection('students')}
                isActive={activeSection === 'students'}
              />
              <NavigationCard
                icon={PlusSquare}
                label={sidebarCollapsed ? "" : "Create Puzzles"}
                section="puzzles"
                onClick={() => setActiveSection('puzzles')}
                isActive={activeSection === 'puzzles'}
              />
              <NavigationCard
                icon={Gamepad2}
                label={sidebarCollapsed ? "" : "Board Editor"}
                section="board-editor"
                onClick={() => setLocation('/create-puzzle/editor')}
                isActive={activeSection === 'board-editor'}
              />
              <NavigationCard
                icon={BookOpen}
                label={sidebarCollapsed ? "" : "Assignments"}
                section="assignments"
                onClick={() => setActiveSection('assignments')}
                isActive={activeSection === 'assignments'}
              />
              <NavigationCard
                icon={FlaskConical}
                label={sidebarCollapsed ? "" : "Analysis"}
                section="analysis"
                onClick={() => setLocation('/analysis')}
                isActive={activeSection === 'analysis'}
              />
              <NavigationCard
                icon={CalendarDays}
                label={sidebarCollapsed ? "" : "Schedule"}
                section="schedule"
                onClick={() => setActiveSection('schedule')}
                isActive={activeSection === 'schedule'}
              />
              <NavigationCard
                icon={Settings}
                label={sidebarCollapsed ? "" : "Preferences"}
                section="preferences"
                onClick={() => setLocation('/preferences')}
                isActive={activeSection === 'preferences'}
              />
            </>
          )}

          {user.role === "student" && (
            <NavigationCard
              icon={CalendarDays}
              label={sidebarCollapsed ? "" : "My Classes"}
              section="schedule"
              onClick={() => setActiveSection('schedule')}
              isActive={activeSection === 'schedule'}
            />
          )}

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
              <div className="flex items-center gap-2">
                <GraduationCap className="h-6 w-6" />
                <h2 className="text-2xl font-bold">Welcome, {user.name}</h2>
              </div>
            </div>

            {user.role === "coach" && activeSection === "students" && (
              <>
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Add New Student</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createStudentMutation.mutate(newStudent);
                      }}
                      className="flex gap-4"
                    >
                      <Input
                        placeholder="Username"
                        value={newStudent.username}
                        onChange={(e) =>
                          setNewStudent((prev) => ({ ...prev, username: e.target.value }))
                        }
                      />
                      <Input
                        placeholder="Full Name"
                        value={newStudent.name}
                        onChange={(e) =>
                          setNewStudent((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                      <Button type="submit" disabled={createStudentMutation.isPending}>
                        {createStudentMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="mr-2 h-4 w-4" />
                        )}
                        Add Student
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {selectedStudentId ? (
                  <StudentPuzzles
                    studentId={selectedStudentId}
                    studentName={students?.find(s => s._id === selectedStudentId)?.name || "Student"}
                    onBack={() => setSelectedStudentId(null)}
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Students
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {studentsLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : (
                        <div className="grid gap-4">
                          {students?.map((student) => (
                            <div
                              key={student._id}
                              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedStudentId(student._id)}
                            >
                              <div>
                                <p className="font-medium">{student.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  @{student.username}
                                </p>
                              </div>
                              <Button variant="ghost" size="icon">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {user.role === "coach" && activeSection === "puzzles" && (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Puzzle</CardTitle>
                </CardHeader>
                <CardContent>
                  <PuzzleCreator
                    onSave={(puzzle) => createPuzzleMutation.mutate(puzzle)}
                    isSaving={createPuzzleMutation.isPending}
                  />
                </CardContent>
              </Card>
            )}


            {user.role === "coach" && activeSection === "assignments" && (
              <Card>
                <CardHeader>
                  <CardTitle>Manage Assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  <PuzzleList
                    onAssign={async (puzzleIds, studentId) => {
                      try {
                        await Promise.all(
                          puzzleIds.map(puzzleId =>
                            apiRequest("POST", "/api/assignments", {
                              puzzleId,
                              studentId,
                            })
                          )
                        );
                      } catch (error) {
                      }
                    }}
                    students={students?.map(s => ({ _id: s._id, name: s.name })) || []}
                  />
                </CardContent>
              </Card>
            )}

            {activeSection === "schedule" && (
              <div className="space-y-6">
                {user.role === "coach" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Schedule New Class</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleScheduleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Input
                              placeholder="Class Title"
                              value={newSchedule.title}
                              onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Select
                              value={newSchedule.meetingProvider}
                              onValueChange={(value: "zoom" | "google_meet") =>
                                setNewSchedule(prev => ({ ...prev, meetingProvider: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="zoom">Zoom</SelectItem>
                                <SelectItem value="google_meet">Google Meet</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Textarea
                          placeholder="Class Description"
                          value={newSchedule.description}
                          onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            type="datetime-local"
                            value={newSchedule.startTime}
                            onChange={(e) => setNewSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                          />
                          <Input
                            type="number"
                            min="15"
                            max="480"
                            placeholder="Duration (minutes)"
                            value={newSchedule.duration}
                            onChange={(e) => setNewSchedule(prev => ({ ...prev, duration: parseInt(e.target.value, 10) }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Input
                            placeholder="Meeting URL"
                            type="url"
                            value={newSchedule.meetingUrl}
                            onChange={(e) => setNewSchedule(prev => ({ ...prev, meetingUrl: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Select
                            value={newSchedule.studentIds.join(",")}
                            onValueChange={(value) =>
                              setNewSchedule(prev => ({
                                ...prev,
                                studentIds: value ? value.split(",") : []
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select students" />
                            </SelectTrigger>
                            <SelectContent>
                              {students?.map((student) => (
                                <SelectItem key={student._id} value={student._id}>
                                  {student.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button type="submit" disabled={createScheduleMutation.isPending}>
                          {createScheduleMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CalendarDays className="mr-2 h-4 w-4" />
                          )}
                          Schedule Class
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {user.role === "coach" ? "Scheduled Classes" : "My Classes"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {schedulesLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : schedules?.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No scheduled classes
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {activeClasses.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-lg mb-4">Active Classes</h3>
                            <div className="space-y-4">
                              {activeClasses.map((schedule: ClassSchedule) => (
                                <div key={schedule._id} className="border rounded-lg p-4 space-y-2 bg-primary/5">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{schedule.title}</h3>
                                        {getClassStatusBadge(schedule.status)}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {schedule.description}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      {user?.role === "coach" && !isClassCompleted(schedule) && (
                                        <>
                                          <a
                                            href={schedule.meetingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <Button variant="secondary">
                                              <Video className="h-4 w-4 mr-2" />
                                              Rejoin Class
                                            </Button>
                                          </a>
                                          <Button
                                            onClick={() => setLocation(`/classroom/${schedule._id}`)}
                                            variant="outline"
                                          >
                                            <BookOpen className="h-4 w-4 mr-2" />
                                            Open Classroom Board
                                          </Button>
                                          <Button
                                            onClick={() => endClassMutation.mutate(schedule._id)}
                                            disabled={endClassMutation.isPending}
                                            variant="destructive"
                                          >
                                            End Class
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 text-sm text-muted-foreground">
                                    <span>{formatTime(schedule.startTime, schedule.timezone)}</span>
                                    <span>-</span>
                                    <span>{formatTime(schedule.endTime, schedule.timezone)}</span>
                                  </div>
                                  {user?.role === "coach" && (
                                    <div className="space-y-1">
                                      <div className="text-sm">
                                        Students: {schedule.studentIds.map((s: any) => s.name).join(", ")}
                                      </div>
                                      <div className="text-sm">
                                        Attendees: {schedule.attendees?.map((s: any) => s.name).join(", ") || "No attendees yet"}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {upcomingClasses.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-lg mb-4">Upcoming Classes</h3>
                            <div className="space-y-4">
                              {upcomingClasses.map((schedule: ClassSchedule) => (
                                <div key={schedule._id} className="border rounded-lg p-4 space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{schedule.title}</h3>
                                        {getClassStatusBadge(schedule.status)}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {schedule.description}
                                      </p>
                                    </div>
                                    {user?.role === "coach" && canStartClass(schedule) && (
                                      <Button
                                        onClick={() => startClassMutation.mutate(schedule._id)}
                                        disabled={startClassMutation.isPending}
                                      >
                                        <Video className="h-4 w-4 mr-2" />
                                        Start Class
                                      </Button>
                                    )}
                                  </div>
                                  <div className="flex gap-2 text-sm text-muted-foreground">
                                    <span>{formatTime(schedule.startTime, schedule.timezone)}</span>
                                    <span>-</span>
                                    <span>{formatTime(schedule.endTime, schedule.timezone)}</span>
                                  </div>
                                  {user?.role === "coach" && (
                                    <div className="text-sm">
                                      Students: {schedule.studentIds.map((s: any) => s.name).join(", ")}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-lg">Past Classes</h3>
                            <Select
                              value={timePeriod}
                              onValueChange={(value) => setTimePeriod(value)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select time period" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">Past 30 Days</SelectItem>
                                <SelectItem value="60">Past 60 Days</SelectItem>
                                <SelectItem value="90">Past 90 Days</SelectItem>
                                <SelectItem value="120">Past 120 Days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-4">{pastClasses.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                No completed classes in the selected time period
                              </p>
                            ) : (
                              pastClasses.map((schedule: ClassSchedule) => (
                                <div key={schedule._id} className="border rounded-lg p-4 space-y-2">
                                  <div className="flex items-start justifybetween">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{schedule.title}</h3>
                                        {getClassStatusBadge(schedule.status)}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {schedule.description}                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 text-sm text-muted-foreground">
                                    <span>{formatTime(schedule.startTime, schedule.timezone)}</span>
                                    <span>-</span>
                                    <span>{formatTime(schedule.endTime, schedule.timezonespan)}</span>
                                  </div>
                                  {user?.role === "coach" && (
                                    <div className="space-y-1">
                                      <div className="text-sm">
                                        Students: {schedule.studentIds.map((s: any) => s.name).join(", ")}
                                      </div>
                                      <div className="text-sm">
                                        Attendees: {schedule.attendees?.map((s: any) => s.name).join(", ") || "No attendees"}
                                      </div>
                                      {schedule.actualStartTime && (
                                        <div className="text-sm text-muted-foreground">
                                          Started: {formatTime(schedule.actualStartTime, schedule.timezone)}
                                        </div>
                                      )}
                                      {schedule.actualEndTime && (
                                        <div className="text-sm text-muted-foreground">
                                          Ended: {formatTime(schedule.actualEndTime, schedule.timezone)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}