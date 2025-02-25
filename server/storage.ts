import { User, InsertUser, CreateStudent } from "@shared/schema";
import { UserModel } from "./models/index";
import session from "express-session";
import createMemoryStore from "memorystore";
import { hashPassword } from "./auth";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  createStudent(data: CreateStudent): Promise<User>;
  getStudents(): Promise<User[]>;
  updatePreferences(userId: string, preferences: User['preferences']): Promise<User>;
  updateProfile(userId: string, profile: { name?: string; email?: string; avatar?: string }): Promise<User>;
  sessionStore: session.Store;
}

export class MongoStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: string) {
    const user = await UserModel.findById(id);
    if (!user) return null;
    const userData = user.toObject();
    return {
      ...userData,
      preferences: userData.preferences || {}
    };
  }

  async getUserByUsername(username: string) {
    const user = await UserModel.findOne({ username });
    if (!user) return null;
    const userData = user.toObject();
    return {
      ...userData,
      preferences: userData.preferences || {}
    };
  }

  async createUser(userData: InsertUser) {
    const user = await UserModel.create({
      ...userData,
      preferences: userData.preferences || {}
    });
    return user.toObject();
  }

  async createStudent(data: CreateStudent) {
    const password = await hashPassword("student123"); // Default password
    const student = await UserModel.create({
      ...data,
      password,
      role: "student",
      preferences: {}
    });
    return student.toObject();
  }

  async getStudents() {
    const students = await UserModel.find({ role: "student" });
    return students.map(s => ({
      ...s.toObject(),
      preferences: s.preferences || {}
    }));
  }

  async updatePreferences(userId: string, preferences: User['preferences']) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { preferences } },
      { new: true }
    );
    if (!user) throw new Error('User not found');
    return user.toObject();
  }

  async updateProfile(userId: string, profile: { name?: string; email?: string; avatar?: string }) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: profile },
      { new: true }
    );
    if (!user) throw new Error('User not found');
    return user.toObject();
  }
}

export const storage = new MongoStorage();