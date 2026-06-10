import { create } from "zustand";

interface UserPreferencesState {
  dailyGoal: number;
  setDailyGoal: (dailyGoal: number) => void;
}

export const useUserStore = create<UserPreferencesState>((set) => ({
  dailyGoal: 10,
  setDailyGoal: (dailyGoal) => set({ dailyGoal }),
}));
