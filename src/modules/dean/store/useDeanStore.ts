import { create } from 'zustand';
import { deanLocations, deanStudents } from '@/data/deanMockData';
import type { DeanFilters, DeanGlobalStats, DeanStudent, Location } from '@/modules/dean/types';

interface DeanStore {
  students: DeanStudent[];
  locations: Location[];
  globalStats: DeanGlobalStats;
  filters: DeanFilters;
  selectedStudent: DeanStudent | null;
  selectedLocation: Location | null;
  setFilter: <K extends keyof DeanFilters>(key: K, value: DeanFilters[K]) => void;
  setSelectedStudent: (student: DeanStudent | null) => void;
  setSelectedLocation: (location: Location | null) => void;
}

const globalStats: DeanGlobalStats = {
  totalStudents: deanStudents.length,
  globalComplianceRate: Math.round(deanStudents.reduce((acc, student) => acc + student.compliancePercentage, 0) / deanStudents.length),
  atRiskCount: deanStudents.filter((student) => student.compliancePercentage < 60).length,
  activeLocations: deanLocations.filter((location) => location.status === 'active').length,
};

export const useDeanStore = create<DeanStore>((set) => ({
  students: deanStudents,
  locations: deanLocations,
  globalStats,
  filters: { sede: 'all', status: 'all', period: '2026-1', search: '' },
  selectedStudent: null,
  selectedLocation: null,
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  setSelectedStudent: (student) => set({ selectedStudent: student }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
}));
