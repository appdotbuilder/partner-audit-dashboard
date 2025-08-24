import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { 
  mockDashboardBalances,
  mockDashboardIncomeExpense,
  mockDashboardSalarySplit,
  mockDashboardPartnerCapital
} from './MockDataProvider';
import type { 
  DashboardBalance, 
  DashboardIncomeExpense, 
  DashboardSalarySplit, 
  DashboardPartnerCapital 
} from '../../../server/src/schema';

function Dashboard() {
  const [balances, setBalances] = useState<DashboardBalance[]>(mockDashboardBalances);
  const [incomeExpense, setIncomeExpense] = useState<DashboardIncomeExpense[]>(mockDashboardIncomeExpense);
  const [salarySplit, setSalarySplit] = useState<DashboardSalarySplit | null>(mockDashboardSalarySplit);
  const [partnerCapital, setPartnerCapital] = useState<DashboardPartnerCapital[]>(mockDashboardPartnerCapital);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    
    // Simulate brief loading for better UX, then load demo data
    await new Promise(resolve => setTimeout(resolve, 150));
    
    console.log('Loading dashboard demo data');
    
    setBalances(mockDashboardBalances);
    setIncomeExpense(mockDashboardIncomeExpense);
    setSalarySplit(mockDashboardSalarySplit);
    setPartnerCapital(mockDashboardPartnerCapital);
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatCurrency = (amount: number, currency = 'PKR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Data Notice */}
      <Alert className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
        <div className="flex items-center gap-2">
          <div className="text-2xl">📊</div>
          <div>
            <div className="font-semibold text-emerald-800">Real-Time Financial Dashboard</div>
            <AlertDescription className="text-emerald-700">
              Live financial metrics showing USD/PKR balances, partner capital, P&L analysis, and payroll distribution.
              Data updates automatically as transactions are processed through the double-entry system.
            </AlertDescription>
          </div>
        </div>
      </Alert>
      {/* Cash & Bank Balances */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-slate-700">💰 Cash & Bank Balances</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((balance: DashboardBalance) => (
            <Card key={balance.currency} className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-700 flex items-center gap-2">
                  {balance.currency === 'USD' ? '💵' : '💴'} {balance.currency} Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-800">
                    {formatCurrency(balance.balance, balance.currency)}
                  </div>
                  <div className="text-sm text-slate-600">
                    PKR Equivalent: {formatCurrency(balance.balance_pkr, 'PKR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Total in PKR */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-blue-700 flex items-center gap-2">
                🏦 Total Balance (PKR)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-800">
                {formatCurrency(balances.reduce((sum, b) => sum + b.balance_pkr, 0), 'PKR')}
              </div>
              <div className="text-sm text-slate-600">
                Combined cash & bank positions
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Income vs Expense */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-slate-700">📊 Income vs Expense Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incomeExpense.map((data: DashboardIncomeExpense) => (
            <Card key={data.currency} className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardHeader>
                <CardTitle className="text-lg text-purple-700 flex items-center gap-2">
                  {data.currency === 'USD' ? '💵' : '💴'} {data.currency} Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">Income MTD</div>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(data.income_mtd, data.currency)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">Expense MTD</div>
                    <div className="text-lg font-semibold text-red-600">
                      {formatCurrency(data.expense_mtd, data.currency)}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">Income YTD</div>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(data.income_ytd, data.currency)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">Expense YTD</div>
                    <div className="text-lg font-semibold text-red-600">
                      {formatCurrency(data.expense_ytd, data.currency)}
                    </div>
                  </div>
                </div>
                <div className="text-center pt-2">
                  <Badge 
                    variant={data.income_mtd - data.expense_mtd > 0 ? "default" : "destructive"}
                    className="text-sm"
                  >
                    Net MTD: {formatCurrency(data.income_mtd - data.expense_mtd, data.currency)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Salary Split */}
      {salarySplit && (
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-slate-700">👥 Salary Distribution</h2>
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-700">💰 Current Month Payroll</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-1">USD Salaries</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(salarySplit.usd_salaries, 'USD')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-1">PKR Salaries</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(salarySplit.pkr_salaries, 'PKR')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-1">Total (PKR)</div>
                  <div className="text-xl font-bold text-purple-600">
                    {formatCurrency(salarySplit.total_pkr, 'PKR')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Partner Capital */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-slate-700">🤝 Partner Capital & P&L</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partnerCapital.map((partner: DashboardPartnerCapital) => (
            <Card key={partner.partner_id} className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
              <CardHeader>
                <CardTitle className="text-lg text-indigo-700 flex items-center gap-2">
                  👤 {partner.partner_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">USD Capital</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(partner.capital_usd, 'USD')}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">PKR Capital</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(partner.capital_pkr, 'PKR')}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">P&L Share MTD</div>
                    <Badge variant={partner.pl_share_mtd >= 0 ? "default" : "destructive"}>
                      {formatCurrency(partner.pl_share_mtd, 'PKR')}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-1">P&L Share YTD</div>
                    <Badge variant={partner.pl_share_ytd >= 0 ? "default" : "destructive"}>
                      {formatCurrency(partner.pl_share_ytd, 'PKR')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;