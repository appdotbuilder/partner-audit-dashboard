import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { 
  Account, 
  Period, 
  TrialBalanceReport, 
  GeneralLedgerReport,
  AccountType
} from '../../../server/src/schema';

interface ReportsTabProps {
  accounts: Account[];
  periods: Period[];
}

function ReportsTab({ accounts, periods }: ReportsTabProps) {
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport[]>([]);
  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerReport[]>([]);
  const [isLoadingTB, setIsLoadingTB] = useState(false);
  const [isLoadingGL, setIsLoadingGL] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>(undefined);
  const [selectedAccount, setSelectedAccount] = useState<number | undefined>(undefined);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const loadTrialBalance = useCallback(async (periodId?: number) => {
    setIsLoadingTB(true);
    try {
      const data = await trpc.getTrialBalanceReport.query({ periodId });
      setTrialBalance(data);
    } catch (error) {
      console.error('Failed to load trial balance:', error);
    } finally {
      setIsLoadingTB(false);
    }
  }, []);

  const loadGeneralLedger = useCallback(async (accountId?: number, fromDateStr?: string, toDateStr?: string) => {
    setIsLoadingGL(true);
    try {
      const data = await trpc.getGeneralLedgerReport.query({ 
        accountId,
        fromDate: fromDateStr ? new Date(fromDateStr) : undefined,
        toDate: toDateStr ? new Date(toDateStr) : undefined
      });
      setGeneralLedger(data);
    } catch (error) {
      console.error('Failed to load general ledger:', error);
    } finally {
      setIsLoadingGL(false);
    }
  }, []);

  const handleRunTrialBalance = () => {
    loadTrialBalance(selectedPeriod);
  };

  const handleRunGeneralLedger = () => {
    loadGeneralLedger(selectedAccount, fromDate, toDate);
  };

  const formatCurrency = (amount: number, currency = 'PKR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getPeriodName = (periodId: number) => {
    const period = periods.find(p => p.id === periodId);
    if (!period) return 'Unknown';
    return `${period.year}-${period.month.toString().padStart(2, '0')}`;
  };

  const getAccountName = (accountId: number) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? `${account.code} - ${account.name}` : 'Unknown account';
  };

  const getAccountTypeIcon = (type: AccountType) => {
    const icons = {
      Asset: '💰',
      Liability: '📊',
      Equity: '📈',
      Income: '💵',
      Expense: '💸',
      Other: '📋'
    };
    return icons[type];
  };

  const getCurrencyIcon = (currency: string) => {
    return currency === 'USD' ? '💵' : '💴';
  };

  // Group trial balance by account type
  const groupedTrialBalance = trialBalance.reduce((groups, item) => {
    const type = item.account_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(item);
    return groups;
  }, {} as Record<AccountType, TrialBalanceReport[]>);

  // Calculate totals
  const totalDebits = trialBalance.reduce((sum, item) => sum + item.debit_balance_base, 0);
  const totalCredits = trialBalance.reduce((sum, item) => sum + item.credit_balance_base, 0);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            📋 Financial Reports
          </CardTitle>
          <CardDescription>
            Generate comprehensive financial reports for audit and analysis
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="trial-balance" className="space-y-4">
        <TabsList className="bg-white/70">
          <TabsTrigger value="trial-balance">📊 Trial Balance</TabsTrigger>
          <TabsTrigger value="general-ledger">📚 General Ledger</TabsTrigger>
          <TabsTrigger value="audit-pack">📦 Audit Pack</TabsTrigger>
        </TabsList>

        {/* Trial Balance Tab */}
        <TabsContent value="trial-balance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance Report</CardTitle>
              <CardDescription>
                Shows all accounts with their debit and credit balances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tb-period">Period (Optional)</Label>
                  <Select
                    value={selectedPeriod?.toString() || ''}
                    onValueChange={(value) => setSelectedPeriod(value ? parseInt(value) : undefined)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="All periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All periods</SelectItem>
                      {periods.map((period: Period) => (
                        <SelectItem key={period.id} value={period.id.toString()}>
                          {getPeriodName(period.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={handleRunTrialBalance} disabled={isLoadingTB}>
                  {isLoadingTB ? 'Loading...' : '▶️ Run Report'}
                </Button>
              </div>

              {isLoadingTB ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Generating trial balance...</p>
                </div>
              ) : trialBalance.length > 0 ? (
                <div className="space-y-6">
                  {/* Report Header */}
                  <div className="text-center">
                    <h3 className="text-xl font-bold">Trial Balance Report</h3>
                    <p className="text-sm text-slate-600">
                      {selectedPeriod ? `For period: ${getPeriodName(selectedPeriod)}` : 'All periods'} • 
                      Generated on {new Date().toLocaleString()}
                    </p>
                  </div>

                  {/* Grouped by Account Type */}
                  {Object.entries(groupedTrialBalance).map(([type, items]) => (
                    <div key={type}>
                      <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        {getAccountTypeIcon(type as AccountType)} {type} Accounts
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account Code</TableHead>
                            <TableHead>Account Name</TableHead>
                            <TableHead>Currency</TableHead>
                            <TableHead className="text-right">Debit Balance</TableHead>
                            <TableHead className="text-right">Credit Balance</TableHead>
                            <TableHead className="text-right">Debit (PKR)</TableHead>
                            <TableHead className="text-right">Credit (PKR)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item: TrialBalanceReport) => (
                            <TableRow key={item.account_id}>
                              <TableCell className="font-medium">{item.account_code}</TableCell>
                              <TableCell>{item.account_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {getCurrencyIcon(item.currency)} {item.currency}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {item.debit_balance > 0 ? formatCurrency(item.debit_balance, item.currency) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.credit_balance > 0 ? formatCurrency(item.credit_balance, item.currency) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.debit_balance_base > 0 ? formatCurrency(item.debit_balance_base) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.credit_balance_base > 0 ? formatCurrency(item.credit_balance_base) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <Separator className="my-4" />
                    </div>
                  ))}

                  {/* Totals */}
                  <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(totalDebits)}
                          </div>
                          <div className="text-sm text-slate-600">Total Debits (PKR)</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-blue-600">
                            {formatCurrency(totalCredits)}
                          </div>
                          <div className="text-sm text-slate-600">Total Credits (PKR)</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${totalDebits === totalCredits ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(totalDebits - totalCredits)}
                          </div>
                          <div className="text-sm text-slate-600">Difference</div>
                        </div>
                      </div>
                      {totalDebits === totalCredits && (
                        <div className="text-center mt-2">
                          <Badge className="bg-green-100 text-green-700">
                            ✅ Trial Balance is Balanced
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-4xl mb-4">📊</div>
                  <p>Click "Run Report" to generate trial balance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Ledger Tab */}
        <TabsContent value="general-ledger" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Ledger Report</CardTitle>
              <CardDescription>
                Detailed transaction history for accounts with running balances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gl-account">Account (Optional)</Label>
                  <Select
                    value={selectedAccount?.toString() || ''}
                    onValueChange={(value) => setSelectedAccount(value ? parseInt(value) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All accounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All accounts</SelectItem>
                      {accounts.map((account: Account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from-date">From Date</Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to-date">To Date</Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={toDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button onClick={handleRunGeneralLedger} disabled={isLoadingGL} className="w-full">
                    {isLoadingGL ? 'Loading...' : '▶️ Run Report'}
                  </Button>
                </div>
              </div>

              {isLoadingGL ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Generating general ledger...</p>
                </div>
              ) : generalLedger.length > 0 ? (
                <div className="space-y-4">
                  {/* Report Header */}
                  <div className="text-center">
                    <h3 className="text-xl font-bold">General Ledger Report</h3>
                    <p className="text-sm text-slate-600">
                      {selectedAccount ? `Account: ${getAccountName(selectedAccount)}` : 'All accounts'} • 
                      {fromDate && toDate ? `${fromDate} to ${toDate}` : 'All dates'} • 
                      Generated on {new Date().toLocaleString()}
                    </p>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generalLedger.map((entry: GeneralLedgerReport, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{entry.account_code}</div>
                              <div className="text-slate-500">{entry.account_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>{entry.journal_date.toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{entry.journal_reference}</TableCell>
                          <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                          <TableCell className="text-right">
                            {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(entry.running_balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-4xl mb-4">📚</div>
                  <p>Click "Run Report" to generate general ledger</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Pack Tab */}
        <TabsContent value="audit-pack" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Pack Generation</CardTitle>
              <CardDescription>
                Generate comprehensive audit packages for period close
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500">
                <div className="text-4xl mb-4">📦</div>
                <p className="mb-4">Audit pack generation will be available after period close functionality is implemented.</p>
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">Audit pack will include:</div>
                  <div className="space-y-1 text-sm">
                    <div>• Trial Balance</div>
                    <div>• General Ledger</div>
                    <div>• Balance Sheet</div>
                    <div>• Profit & Loss</div>
                    <div>• Capital Rollforward</div>
                    <div>• FX Summary</div>
                    <div>• Supporting Journal Entries</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ReportsTab;