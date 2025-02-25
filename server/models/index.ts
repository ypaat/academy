import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },
  avatar: { type: String }, // URL for the avatar image
  role: { type: String, enum: ["coach", "student"], required: true },
  preferences: {
    defaultMeetingProvider: { type: String, enum: ["zoom", "google_meet"] },
    defaultMeetingUrl: { type: String }
  },
  createdAt: { type: Date, default: Date.now }
});

const puzzleSchema = new mongoose.Schema({
  fen: { type: String, required: true },
  solution: [{ type: String }],
  themes: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const assignmentSchema = new mongoose.Schema({
  puzzleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Puzzle', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completed: { type: Boolean, default: false },
  assignedAt: { type: Date, default: Date.now },
  attempts: [{
    moves: [{ type: String }],
    timestamp: { type: Date, default: Date.now }
  }]
});

const classScheduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  coachId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  timezone: { type: String, default: "UTC" },
  meetingUrl: { type: String, required: true },
  meetingProvider: { type: String, enum: ["zoom", "google_meet"], required: true },
  status: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started" },
  actualStartTime: { type: Date },
  actualEndTime: { type: Date },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const transformSchema = {
  transform: function(doc: any, ret: any) {
    ret._id = ret._id.toString();
    if (ret.createdBy) ret.createdBy = ret.createdBy.toString();
    if (ret.puzzleId) ret.puzzleId = ret.puzzleId.toString();
    if (ret.studentId) ret.studentId = ret.studentId.toString();
    if (ret.coachId) ret.coachId = ret.coachId.toString();
    if (ret.studentIds) ret.studentIds = ret.studentIds.map((id: any) => id.toString());
    if (ret.attendees) ret.attendees = ret.attendees.map((id: any) => id.toString());
    return ret;
  }
};

userSchema.set('toJSON', transformSchema);
userSchema.set('toObject', transformSchema);
puzzleSchema.set('toJSON', transformSchema);
puzzleSchema.set('toObject', transformSchema);
assignmentSchema.set('toJSON', transformSchema);
assignmentSchema.set('toObject', transformSchema);
classScheduleSchema.set('toJSON', transformSchema);
classScheduleSchema.set('toObject', transformSchema);

export const UserModel = mongoose.model("User", userSchema);
export const PuzzleModel = mongoose.model("Puzzle", puzzleSchema);
export const AssignmentModel = mongoose.model("Assignment", assignmentSchema);
export const ClassScheduleModel = mongoose.model("ClassSchedule", classScheduleSchema);