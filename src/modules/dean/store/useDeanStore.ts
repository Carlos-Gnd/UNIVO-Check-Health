import { create } from 'zustand';
import { fetchDeanData } from '@/modules/dean/services/dean.service';
import type { DeanFilters, DeanGlobalStats, DeanStudent, Location } from '@/modules/dean/types';

interface DeanStore {
  students: DeanStudent[];
  locations: Location[];
  globalStats: DeanGlobalStats;
  filters: DeanFilters;
  selectedStudent: DeanStudent | null;
  selectedLocation: Location | null;
  isLoading: boolean;
  loadData: () => Promise<void>;
  setFilter: <K extends keyof DeanFilters>(key: K, value: DeanFilters[K]) => void;
  setSelectedStudent: (student: DeanStudent | null) => void;
  setSelectedLocation: (location: Location | null) => void;
}

const emptyStats: DeanGlobalStats = {
  totalStudents: 0,
  globalComplianceRate: 0,
  atRiskCount: 0,
  activeLocations: 0,
  riskThreshold: 60,
};

export const useDeanStore = create<DeanStore>((set, get) => ({
  students: [],
  locations: [],
  globalStats: emptyStats,
  filters: { sede: 'all', status: 'all', period: '2026-1', search: '' },
  selectedStudent: null,
  selectedLocation: null,
  isLoading: false,

  // B4: stale-while-revalidate. El spinner a pantalla completa solo aparece en la
  // primera carga; al navegar entre páginas del decano se muestran los datos ya
  // cacheados al instante y se refrescan en segundo plano (sin "flash" de recarga).
  loadData: async () => {
    const hasData = get().students.length > 0 || get().locations.length > 0;
    if (!hasData) set({ isLoading: true });
    const { students, locations, globalStats } = await fetchDeanData();
    set({ students, locations, globalStats, isLoading: false });
  },

  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  setSelectedStudent: (student) => set({ selectedStudent: student }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
}));
