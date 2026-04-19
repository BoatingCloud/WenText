import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { userApi, systemConfigApi, CompanyCatalogItem } from '../services/api';

interface CompanyScopeState {
  // 系统配置的所有公司
  allCompanies: CompanyCatalogItem[];
  // 当前用户有权访问的公司代码列表
  userCompanyCodes: string[];
  // 用户是否有所有公司权限
  isAllCompanies: boolean;
  // 当前用户有权访问的仓库
  userRepositories: Array<{
    id: string;
    code: string;
    name: string;
    companyCode: string | null;
  }>;
  // 用户是否有所有仓库权限
  isAllRepositories: boolean;
  // 当前选择的公司代码
  selectedCompanyCode: string | null;
  // 加载状态
  isLoading: boolean;

  // 获取当前用户的有效公司列表（系统公司与用户权限的交集）
  getEffectiveCompanies: () => CompanyCatalogItem[];
  // 获取当前选择公司下的仓库列表
  getRepositoriesForSelectedCompany: () => Array<{
    id: string;
    code: string;
    name: string;
    companyCode: string | null;
  }>;
  // 判断用户是否可访问某公司
  hasCompanyAccess: (companyCode: string) => boolean;
  // 判断用户是否可访问某仓库
  hasRepositoryAccess: (repositoryId: string) => boolean;

  // Actions
  fetchCompanyData: (userId: string) => Promise<void>;
  setSelectedCompanyCode: (code: string | null) => void;
  reset: () => void;
}

const initialState = {
  allCompanies: [],
  userCompanyCodes: [],
  isAllCompanies: false,
  userRepositories: [],
  isAllRepositories: false,
  selectedCompanyCode: null,
  isLoading: false,
};

export const useCompanyScopeStore = create<CompanyScopeState>()(
  persist(
    (set, get) => ({
      ...initialState,

      getEffectiveCompanies: () => {
        const { allCompanies, userCompanyCodes, isAllCompanies } = get();
        if (isAllCompanies) {
          return allCompanies;
        }
        return allCompanies.filter((c) => userCompanyCodes.includes(c.code));
      },

      getRepositoriesForSelectedCompany: () => {
        const { selectedCompanyCode, userRepositories } = get();
        if (!selectedCompanyCode) {
          // 如果没有选择公司，返回所有可访问的仓库
          return userRepositories;
        }
        // 返回选择公司下的仓库
        return userRepositories.filter((r) => r.companyCode === selectedCompanyCode);
      },

      hasCompanyAccess: (companyCode: string) => {
        const { userCompanyCodes, isAllCompanies } = get();
        if (isAllCompanies) return true;
        return userCompanyCodes.includes(companyCode);
      },

      hasRepositoryAccess: (repositoryId: string) => {
        const { userRepositories, isAllRepositories } = get();
        if (isAllRepositories) return true;
        return userRepositories.some((r) => r.id === repositoryId);
      },

      fetchCompanyData: async (userId: string) => {
        set({ isLoading: true });
        try {
          // 并行获取系统公司列表和用户权限
          const [publicConfigRes, companyScopesRes, repoScopesRes] = await Promise.all([
            systemConfigApi.getPublicTheme(),
            userApi.getCompanyScopes(userId),
            userApi.getRepositoryScopes(userId),
          ]);

          const allCompanies = publicConfigRes.data.data?.companyCatalog || [];
          const companyScopeData = companyScopesRes.data.data;
          const repoScopeData = repoScopesRes.data.data;

          // 判断用户有效公司列表
          const isAllCompanies = companyScopeData?.isAllCompanies || false;
          const userCompanyCodes = companyScopeData?.companyCodes || [];

          // 用户仓库权限
          const isAllRepositories = repoScopeData?.isAllRepositories || false;
          const userRepositories = repoScopeData?.repositories || [];

          // 确定默认选择的公司
          let selectedCompanyCode = get().selectedCompanyCode;
          const effectiveCompanies = isAllCompanies
            ? allCompanies
            : allCompanies.filter((c) => userCompanyCodes.includes(c.code));

          // 如果当前选择的公司不在有效列表中，自动选择第一个
          if (
            selectedCompanyCode &&
            !effectiveCompanies.some((c) => c.code === selectedCompanyCode)
          ) {
            selectedCompanyCode = null;
          }

          // 如果没有选择且有多个公司，默认选择第一个
          if (!selectedCompanyCode && effectiveCompanies.length > 0) {
            selectedCompanyCode = effectiveCompanies[0].code;
          }

          set({
            allCompanies,
            userCompanyCodes,
            isAllCompanies,
            userRepositories,
            isAllRepositories,
            selectedCompanyCode,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to fetch company data:', error);
          set({ isLoading: false });
        }
      },

      setSelectedCompanyCode: (code: string | null) => {
        set({ selectedCompanyCode: code });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'company-scope-storage',
      partialize: (state) => ({
        selectedCompanyCode: state.selectedCompanyCode,
      }),
    }
  )
);
