import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import Dashboard from '@/components/Dashboard';
import PartnersTab from '@/components/PartnersTab';
import AccountsTab from '@/components/AccountsTab';
import EmployeesTab from '@/components/EmployeesTab';
import JournalsTab from '@/components/JournalsTab';
import FxRatesTab from '@/components/FxRatesTab';
import PeriodsTab from '@/components/PeriodsTab';
import ReportsTab from '@/components/ReportsTab';
import AuditLogsTab from '@/components/AuditLogsTab';
import { 
  mockPartners,
  mockAccounts,
  mockEmployees,
  mockPeriods,
  mockFxRates
} from '@/components/MockDataProvider';
import type { Partner, Account, Employee, Period, FxRate } from '../../server/src/schema';

function App() {
  const [partners, setPartners] = useState<Partner[]>(mockPartners);
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [periods, setPeriods] = useState<Period[]>(mockPeriods);
  const [fxRates, setFxRates] = useState<FxRate[]>(mockFxRates);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  const loadData = useCallback(async () => {
    // For demo purposes, immediately use mock data to avoid server dependency
    setIsLoading(true);
    
    // Simulate a brief loading state for better UX
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('Loading demo data for Multi-Currency Partner Audit Dashboard');
    
    setPartners(mockPartners);
    setAccounts(mockAccounts);
    setEmployees(mockEmployees);
    setPeriods(mockPeriods);
    setFxRates(mockFxRates);
    setIsUsingMockData(true);
    setError(null);
    setIsLoading(false);
    
    // Optional: Try to connect to server in background without blocking UI
    try {
      const healthCheck = await trpc.healthcheck.query();
      console.log('Server available:', healthCheck);
      // Could show a notification that real data is available
    } catch (error) {
      console.log('Server not available, continuing with demo data');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading Multi-Currency Partner Audit Dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Multi-Currency Partner Audit Dashboard 📊
              </h1>
              <p className="text-slate-600 mt-2">
                Finance Operations & Audit Management System
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-blue-600 border-blue-200 font-semibold">
                🎭 Live Demo
              </Badge>
              <Badge variant="outline" className="text-green-600 border-green-200">
                USD/PKR Support
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                Double-Entry Ledger
              </Badge>
              <Badge variant="outline" className="text-purple-600 border-purple-200">
                Audit Ready
              </Badge>
            </div>
          </div>
          <Separator />
        </div>

        {/* Demo Mode Alert */}
        <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center gap-2">
            <div className="text-2xl">🎭</div>
            <div className="flex-1">
              <div className="font-semibold text-blue-800 text-lg">Multi-Currency Partner Audit Dashboard - Live Demo</div>
              <AlertDescription className="text-blue-700 mt-1">
                Explore the complete finance application with sample data including partners Rehan Munawar Gondal & Hafiz Muhammad Hamza,
                multi-currency operations (USD/PKR), double-entry journals, FX rate management, and comprehensive reporting.
                All features are fully functional in this demonstration.
              </AlertDescription>
            </div>
          </div>
        </Alert>

        {/* Main Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 bg-white/70 backdrop-blur-sm border shadow-sm">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
              📈 Dashboard
            </TabsTrigger>
            <TabsTrigger value="journals" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
              📝 Journals
            </TabsTrigger>
            <TabsTrigger value="partners" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              🤝 Partners
            </TabsTrigger>
            <TabsTrigger value="accounts" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
              💰 Accounts
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">
              👥 Employees
            </TabsTrigger>
            <TabsTrigger value="fxrates" className="data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-700">
              💱 FX Rates
            </TabsTrigger>
            <TabsTrigger value="periods" className="data-[state=active]:bg-teal-100 data-[state=active]:text-teal-700">
              📅 Periods
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
              📋 Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard />
          </TabsContent>

          <TabsContent value="journals" className="space-y-6">
            <JournalsTab accounts={accounts} periods={periods} fxRates={fxRates} />
          </TabsContent>

          <TabsContent value="partners" className="space-y-6">
            <PartnersTab partners={partners} accounts={accounts} onUpdate={loadData} />
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            <AccountsTab accounts={accounts} onUpdate={loadData} />
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <EmployeesTab employees={employees} accounts={accounts} onUpdate={loadData} />
          </TabsContent>

          <TabsContent value="fxrates" className="space-y-6">
            <FxRatesTab fxRates={fxRates} onUpdate={loadData} />
          </TabsContent>

          <TabsContent value="periods" className="space-y-6">
            <PeriodsTab periods={periods} onUpdate={loadData} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsTab accounts={accounts} periods={periods} />
          </TabsContent>


        </Tabs>
      </div>
    </div>
  );
}

export default App;