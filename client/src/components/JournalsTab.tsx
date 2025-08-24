import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import type { 
  Journal, 
  JournalLine, 
  Account, 
  Period, 
  FxRate, 
  CreateJournalInput,
  CreateJournalLineInput,
  JournalStatus
} from '../../../server/src/schema';

interface JournalsTabProps {
  accounts: Account[];
  periods: Period[];
  fxRates: FxRate[];
}

function JournalsTab({ accounts, periods, fxRates }: JournalsTabProps) {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLinesDialog, setShowLinesDialog] = useState(false);

  const [journalFormData, setJournalFormData] = useState<CreateJournalInput>({
    reference: '',
    description: '',
    journal_date: new Date(),
    period_id: 0,
    fx_rate_id: null
  });

  const [lineFormData, setLineFormData] = useState<CreateJournalLineInput>({
    journal_id: 0,
    account_id: 0,
    description: '',
    debit_amount: 0,
    credit_amount: 0,
    debit_amount_base: 0,
    credit_amount_base: 0,
    line_number: 1
  });

  const loadJournals = useCallback(async () => {
    try {
      setIsLoading(true);
      const journalsData = await trpc.getJournals.query();
      setJournals(journalsData);
    } catch (error) {
      console.error('Failed to load journals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadJournalLines = useCallback(async (journalId: number) => {
    try {
      const linesData = await trpc.getJournalLines.query({ journalId });
      setJournalLines(linesData);
    } catch (error) {
      console.error('Failed to load journal lines:', error);
    }
  }, []);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalFormData.reference.trim() || !journalFormData.description.trim() || journalFormData.period_id === 0) return;

    setIsCreating(true);
    try {
      await trpc.createJournal.mutate(journalFormData);
      setJournalFormData({
        reference: '',
        description: '',
        journal_date: new Date(),
        period_id: 0,
        fx_rate_id: null
      });
      setShowCreateDialog(false);
      loadJournals();
    } catch (error) {
      console.error('Failed to create journal:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePostJournal = async (journalId: number) => {
    try {
      await trpc.postJournal.mutate({ journalId });
      loadJournals();
    } catch (error) {
      console.error('Failed to post journal:', error);
    }
  };

  const handleViewLines = async (journal: Journal) => {
    setSelectedJournal(journal);
    await loadJournalLines(journal.id);
    setShowLinesDialog(true);
  };

  const getAccountName = (accountId: number) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? `${account.code} - ${account.name}` : 'Unknown account';
  };

  const getPeriodName = (periodId: number) => {
    const period = periods.find(p => p.id === periodId);
    return period ? `${period.year}-${period.month.toString().padStart(2, '0')}` : 'Unknown period';
  };

  const getFxRateName = (fxRateId: number | null) => {
    if (!fxRateId) return 'No FX rate';
    const rate = fxRates.find(r => r.id === fxRateId);
    return rate ? `${rate.from_currency}/${rate.to_currency} @ ${rate.rate}` : 'Unknown rate';
  };

  const getStatusBadge = (status: JournalStatus) => {
    return (
      <Badge 
        variant={status === 'Posted' ? 'default' : 'secondary'}
        className={status === 'Posted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
      >
        {status === 'Posted' ? '✅' : '📝'} {status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const openPeriods = periods.filter(p => p.status === 'Open');

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-green-700">
                📝 Journal Management
              </CardTitle>
              <CardDescription>
                Create and manage double-entry journal entries with multi-currency support
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  ➕ Create Journal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Journal Entry</DialogTitle>
                  <DialogDescription>
                    Enter journal details. Lines will be added after creation.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateJournal} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reference">Reference</Label>
                      <Input
                        id="reference"
                        value={journalFormData.reference}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setJournalFormData((prev: CreateJournalInput) => ({ ...prev, reference: e.target.value }))
                        }
                        placeholder="e.g., JV-2024-001"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="journal-date">Journal Date</Label>
                      <Input
                        id="journal-date"
                        type="date"
                        value={journalFormData.journal_date.toISOString().split('T')[0]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setJournalFormData((prev: CreateJournalInput) => ({ 
                            ...prev, 
                            journal_date: new Date(e.target.value)
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={journalFormData.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setJournalFormData((prev: CreateJournalInput) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Enter journal description"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="period">Period</Label>
                      <Select
                        value={journalFormData.period_id.toString()}
                        onValueChange={(value) =>
                          setJournalFormData((prev: CreateJournalInput) => ({
                            ...prev,
                            period_id: parseInt(value)
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                          {openPeriods.map((period: Period) => (
                            <SelectItem key={period.id} value={period.id.toString()}>
                              {getPeriodName(period.id)} - {period.status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fx-rate">FX Rate (Optional)</Label>
                      <Select
                        value={journalFormData.fx_rate_id?.toString() || ''}
                        onValueChange={(value) =>
                          setJournalFormData((prev: CreateJournalInput) => ({
                            ...prev,
                            fx_rate_id: value ? parseInt(value) : null
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select FX rate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No FX rate</SelectItem>
                          {fxRates.map((rate: FxRate) => (
                            <SelectItem key={rate.id} value={rate.id.toString()}>
                              {getFxRateName(rate.id)} - {rate.effective_date.toLocaleDateString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? 'Creating...' : 'Create Journal'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Journals List */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading journals...</p>
            </div>
          ) : journals.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <div className="text-4xl mb-4">📝</div>
              <p>No journal entries yet. Create one above!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Debit</TableHead>
                  <TableHead>Total Credit</TableHead>
                  <TableHead>FX Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journals.map((journal: Journal) => (
                  <TableRow key={journal.id}>
                    <TableCell className="font-medium">{journal.reference}</TableCell>
                    <TableCell>{journal.journal_date.toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-xs truncate">{journal.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getPeriodName(journal.period_id)}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(journal.status)}</TableCell>
                    <TableCell>{formatCurrency(journal.total_debit)}</TableCell>
                    <TableCell>{formatCurrency(journal.total_credit)}</TableCell>
                    <TableCell className="text-sm">{getFxRateName(journal.fx_rate_id)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewLines(journal)}
                        >
                          👁️ Lines
                        </Button>
                        {journal.status === 'Draft' && (
                          <Button
                            size="sm"
                            onClick={() => handlePostJournal(journal.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            ✅ Post
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Journal Lines Dialog */}
      <Dialog open={showLinesDialog} onOpenChange={setShowLinesDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Journal Lines - {selectedJournal?.reference}
            </DialogTitle>
            <DialogDescription>
              {selectedJournal?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedJournal && (
            <div className="space-y-4">
              {/* Journal Summary */}
              <Card className="bg-gray-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label>Reference</Label>
                      <div className="font-medium">{selectedJournal.reference}</div>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <div className="font-medium">{selectedJournal.journal_date.toLocaleDateString()}</div>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <div>{getStatusBadge(selectedJournal.status)}</div>
                    </div>
                    <div>
                      <Label>Period</Label>
                      <div className="font-medium">{getPeriodName(selectedJournal.period_id)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Journal Lines */}
              {journalLines.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-4xl mb-4">📄</div>
                  <p>No journal lines yet. Lines should be added to complete this entry.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Line #</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Debit</TableHead>
                        <TableHead>Credit</TableHead>
                        <TableHead>Debit (Base)</TableHead>
                        <TableHead>Credit (Base)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {journalLines.map((line: JournalLine) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.line_number}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {getAccountName(line.account_id)}
                            </div>
                          </TableCell>
                          <TableCell>{line.description}</TableCell>
                          <TableCell>
                            {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                          </TableCell>
                          <TableCell>
                            {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                          </TableCell>
                          <TableCell>
                            {line.debit_amount_base > 0 ? formatCurrency(line.debit_amount_base) : '-'}
                          </TableCell>
                          <TableCell>
                            {line.credit_amount_base > 0 ? formatCurrency(line.credit_amount_base) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="text-center">
                          <Label>Total Debit</Label>
                          <div className="font-bold text-green-600">
                            {formatCurrency(selectedJournal.total_debit)}
                          </div>
                        </div>
                        <div className="text-center">
                          <Label>Total Credit</Label>
                          <div className="font-bold text-blue-600">
                            {formatCurrency(selectedJournal.total_credit)}
                          </div>
                        </div>
                        <div className="text-center">
                          <Label>Difference</Label>
                          <div className={`font-bold ${selectedJournal.total_debit === selectedJournal.total_credit ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(selectedJournal.total_debit - selectedJournal.total_credit)}
                          </div>
                        </div>
                        <div className="text-center">
                          <Label>Balance Status</Label>
                          <div>
                            {selectedJournal.total_debit === selectedJournal.total_credit ? (
                              <Badge className="bg-green-100 text-green-700">✅ Balanced</Badge>
                            ) : (
                              <Badge variant="destructive">❌ Unbalanced</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JournalsTab;