// Mock data provider for demonstration when server handlers are not fully implemented
import type { 
  Partner, 
  Account, 
  Employee, 
  Period, 
  FxRate,
  DashboardBalance,
  DashboardIncomeExpense,
  DashboardSalarySplit,
  DashboardPartnerCapital
} from '../../../server/src/schema';

export const mockPartners: Partner[] = [
  {
    id: 1,
    name: 'Rehan Munawar Gondal',
    usd_account_id: 1,
    pkr_account_id: 2,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 2,
    name: 'Hafiz Muhammad Hamza',
    usd_account_id: 3,
    pkr_account_id: 4,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  }
];

export const mockAccounts: Account[] = [
  {
    id: 1,
    code: '3001',
    name: 'Partner 1 Capital - USD',
    account_type: 'Equity',
    currency: 'USD',
    is_bank: false,
    is_capital: true,
    is_payroll_source: false,
    is_intercompany: false,
    parent_id: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 2,
    code: '3002',
    name: 'Partner 1 Capital - PKR',
    account_type: 'Equity',
    currency: 'PKR',
    is_bank: false,
    is_capital: true,
    is_payroll_source: false,
    is_intercompany: false,
    parent_id: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 3,
    code: '3003',
    name: 'Partner 2 Capital - USD',
    account_type: 'Equity',
    currency: 'USD',
    is_bank: false,
    is_capital: true,
    is_payroll_source: false,
    is_intercompany: false,
    parent_id: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 4,
    code: '3004',
    name: 'Partner 2 Capital - PKR',
    account_type: 'Equity',
    currency: 'PKR',
    is_bank: false,
    is_capital: true,
    is_payroll_source: false,
    is_intercompany: false,
    parent_id: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 5,
    code: '1001',
    name: 'Cash - USD',
    account_type: 'Asset',
    currency: 'USD',
    is_bank: true,
    is_capital: false,
    is_payroll_source: true,
    is_intercompany: false,
    parent_id: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 6,
    code: '1002',
    name: 'Cash - PKR',
    account_type: 'Asset',
    currency: 'PKR',
    is_bank: true,
    is_capital: false,
    is_payroll_source: true,
    is_intercompany: false,
    parent_id: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 7,
    code: '4001',
    name: 'Service Income - USD',
    account_type: 'Income',
    currency: 'USD',
    is_bank: false,
    is_capital: false,
    is_payroll_source: false,
    is_intercompany: false,
    parent_id: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 8,
    code: '4002',
    name: 'Service Income - PKR',
    account_type: 'Income',
    currency: 'PKR',
    is_bank: false,
    is_capital: false,
    is_payroll_source: false,
    is_intercompany: false,
    parent_id: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  }
];

export const mockEmployees: Employee[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@company.com',
    payroll_currency: 'USD',
    payroll_account_id: 5,
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15')
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane.smith@company.com',
    payroll_currency: 'PKR',
    payroll_account_id: 6,
    created_at: new Date('2024-01-20'),
    updated_at: new Date('2024-01-20')
  }
];

export const mockPeriods: Period[] = [
  {
    id: 1,
    year: 2024,
    month: 1,
    status: 'Locked',
    fx_rate_locked: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-02-01')
  },
  {
    id: 2,
    year: 2024,
    month: 2,
    status: 'Open',
    fx_rate_locked: false,
    created_at: new Date('2024-02-01'),
    updated_at: new Date('2024-02-01')
  }
];

export const mockFxRates: FxRate[] = [
  {
    id: 1,
    from_currency: 'USD',
    to_currency: 'PKR',
    rate: 280.5,
    effective_date: new Date('2024-01-01'),
    is_locked: true,
    created_by: 1,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: 2,
    from_currency: 'USD',
    to_currency: 'PKR',
    rate: 282.0,
    effective_date: new Date('2024-02-01'),
    is_locked: false,
    created_by: 1,
    created_at: new Date('2024-02-01'),
    updated_at: new Date('2024-02-01')
  }
];

export const mockDashboardBalances: DashboardBalance[] = [
  {
    currency: 'USD',
    balance: 25000,
    balance_pkr: 7050000
  },
  {
    currency: 'PKR',
    balance: 1500000,
    balance_pkr: 1500000
  }
];

export const mockDashboardIncomeExpense: DashboardIncomeExpense[] = [
  {
    income_mtd: 15000,
    expense_mtd: 8000,
    income_ytd: 45000,
    expense_ytd: 28000,
    currency: 'USD'
  },
  {
    income_mtd: 800000,
    expense_mtd: 600000,
    income_ytd: 2400000,
    expense_ytd: 1800000,
    currency: 'PKR'
  }
];

export const mockDashboardSalarySplit: DashboardSalarySplit = {
  usd_salaries: 5000,
  pkr_salaries: 400000,
  total_pkr: 1810000
};

export const mockDashboardPartnerCapital: DashboardPartnerCapital[] = [
  {
    partner_id: 1,
    partner_name: 'Rehan Munawar Gondal',
    capital_usd: 50000,
    capital_pkr: 2000000,
    pl_share_mtd: 350000,
    pl_share_ytd: 850000
  },
  {
    partner_id: 2,
    partner_name: 'Hafiz Muhammad Hamza',
    capital_usd: 45000,
    capital_pkr: 1800000,
    pl_share_mtd: 320000,
    pl_share_ytd: 780000
  }
];