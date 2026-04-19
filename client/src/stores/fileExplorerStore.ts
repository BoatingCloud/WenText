import { create } from 'zustand';
import { Document, Repository } from '../services/api';

interface FileExplorerState {
  currentRepository: Repository | null;
  currentPath: string;
  selectedDocuments: Document[];
  viewMode: 'list' | 'grid';
  sortBy: 'name' | 'size' | 'date';
  sortOrder: 'asc' | 'desc';

  setCurrentRepository: (repo: Repository | null) => void;
  setCurrentPath: (path: string) => void;
  setSelectedDocuments: (docs: Document[]) => void;
  toggleSelectDocument: (doc: Document) => void;
  clearSelection: () => void;
  setViewMode: (mode: 'list' | 'grid') => void;
  setSortBy: (field: 'name' | 'size' | 'date') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  navigateTo: (path: string) => void;
  navigateUp: () => void;
}

export const useFileExplorerStore = create<FileExplorerState>((set, get) => ({
  currentRepository: null,
  currentPath: '/',
  selectedDocuments: [],
  viewMode: 'list',
  sortBy: 'name',
  sortOrder: 'asc',

  setCurrentRepository: (repo) => {
    set({ currentRepository: repo, currentPath: '/', selectedDocuments: [] });
  },

  setCurrentPath: (path) => {
    set({ currentPath: path, selectedDocuments: [] });
  },

  setSelectedDocuments: (docs) => {
    set({ selectedDocuments: docs });
  },

  toggleSelectDocument: (doc) => {
    const { selectedDocuments } = get();
    const index = selectedDocuments.findIndex((d) => d.id === doc.id);
    if (index >= 0) {
      set({
        selectedDocuments: selectedDocuments.filter((d) => d.id !== doc.id),
      });
    } else {
      set({ selectedDocuments: [...selectedDocuments, doc] });
    }
  },

  clearSelection: () => {
    set({ selectedDocuments: [] });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  setSortBy: (field) => {
    set({ sortBy: field });
  },

  setSortOrder: (order) => {
    set({ sortOrder: order });
  },

  navigateTo: (path) => {
    set({ currentPath: path, selectedDocuments: [] });
  },

  navigateUp: () => {
    const { currentPath } = get();
    if (currentPath === '/') return;

    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    set({ currentPath: newPath || '/', selectedDocuments: [] });
  },
}));
