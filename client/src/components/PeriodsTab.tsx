import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { Period, CreatePeriodInput, PeriodStatus } from '../../../server/src/schema';

interface PeriodsTabProps {
  periods: Period[];
  onUpdate: () => void;
}

function PeriodsTab({ periods, onUpdate }: PeriodsTabProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [formData, setFormData] = useState<CreatePeriodInput>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    status: 'Open',
    fx_rate_locked: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsCreating(true);
    try {
      await trpc.createPeriod.mutate(formData);
      // Reset form to next month
      const nextMonth = formData.month === 12 ? 1 : formData.month + 1;
      const nextYear = formData.month === 12 ? formData.year + 1 : formData.year;
      
      setFormData({
        year: nextYear,
        month: nextMonth,
        status: 'Open',
        fx_rate_locked: false
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to create period:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClosePeriod = async (periodId: number) => {
    setIsClosing(true);
    try {
      await trpc.closePeriod.mutate({ periodId });
      onUpdate();
    } catch (error) {
      console.error('Failed to close period:', error);
    } finally {
      setIsClosing(false);
    }
  };

  const getStatusBadge = (status: PeriodStatus) => {
    return (
      <Badge 
        variant={status === 'Open' ? 'default' : 'secondary'}
        className={status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
      >
        {status === 'Open' ? '🔓' : '🔒'} {status}
      </Badge>
    );
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const formatPeriodName = (year: number, month: number) => {
    return `${getMonthName(month)} ${year}`;
  };

  const sortedPeriods = [...periods].sort((a, b) => 
    (b.year * 12 + b.month) - (a.year * 12 + a.month)
  );

  const openPeriods = periods.filter(p => p.status === 'Open');
  const currentPeriod = sortedPeriods[0];
  const periodExists = periods.some(p => p.year === formData.year && p.month === formData.month);

  return (
    <div className="space-y-6">
      {/* Current Period Alert */}
      {currentPeriod && (
        <Alert className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
          <div className="flex items-center gap-2">
            <div className="text-2xl">📅</div>
            <div>
              <div className="font-medium text-teal-800">
                Current Period: {formatPeriodName(currentPeriod.year, currentPeriod.month)}
              </div>
              <AlertDescription className="text-teal-700">
                Status: {currentPeriod.status} • FX Rates: {currentPeriod.fx_rate_locked ? '🔒 Locked' : '🔓 Unlocked'}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Create Period Form */}
      <Card className="bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-teal-700">
            📅 Period Management
          </CardTitle>
          <CardDescription>
            Create and manage accounting periods for financial reporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min="2000"
                  max="3000"
                  value={formData.year}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreatePeriodInput) => ({ 
                      ...prev, 
                      year: parseInt(e.target.value) || new Date().getFullYear() 
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="month">Month</Label>
                <Select
                  value={formData.month.toString()}
                  onValueChange={(value) =>
                    setFormData((prev: CreatePeriodInput) => ({ 
                      ...prev, 
                      month: parseInt(value) 
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {month.toString().padStart(2, '0')} - {getMonthName(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: PeriodStatus) =>
                    setFormData((prev: CreatePeriodInput) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">🔓 Open</SelectItem>
                    <SelectItem value="Locked">🔒 Locked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fx-rate-locked" className="text-sm">FX Rate Settings</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="fx_rate_locked"
                    checked={formData.fx_rate_locked}
                    onCheckedChange={(checked) =>
                      setFormData((prev: CreatePeriodInput) => ({ ...prev, fx_rate_locked: checked }))
                    }
                  />
                  <Label htmlFor="fx_rate_locked" className="text-sm">
                    🔒 Lock FX Rates
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-lg font-medium text-teal-700">
                  {formatPeriodName(formData.year, formData.month)}
                </div>
                {periodExists && (
                  <div className="text-sm text-red-600">
                    ⚠️ This period already exists
                  </div>
                )}
              </div>
              
              <Button 
                type="submit" 
                disabled={isCreating || periodExists} 
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isCreating ? 'Creating...' : '➕ Create Period'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Periods List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Accounting Periods</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-green-600 border-green-200">
                {openPeriods.length} Open
              </Badge>
              <Badge variant="outline" className="text-gray-600 border-gray-200">
                {periods.length - openPeriods.length} Locked
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <div className="text-4xl mb-4">📅</div>
              <p>No accounting periods created yet. Create one above!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>FX Rates</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPeriods.map((period: Period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">
                      {formatPeriodName(period.year, period.month)}
                    </TableCell>
                    <TableCell>{period.year}</TableCell>
                    <TableCell>{period.month.toString().padStart(2, '0')}</TableCell>
                    <TableCell>{getStatusBadge(period.status)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={period.fx_rate_locked ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}
                      >
                        {period.fx_rate_locked ? '🔒 Locked' : '🔓 Unlocked'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {period.created_at.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {period.status === 'Open' ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                              🔒 Close Period
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Close Accounting Period</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to close {formatPeriodName(period.year, period.month)}? 
                                This action cannot be undone and will prevent any further journal entries for this period.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleClosePeriod(period.id)}
                                disabled={isClosing}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {isClosing ? 'Closing...' : 'Close Period'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                          🔒 Closed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Period Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-700 flex items-center gap-2">
            📊 Period Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {periods.length}
              </div>
              <div className="text-sm text-slate-600">Total Periods</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {openPeriods.length}
              </div>
              <div className="text-sm text-slate-600">Open Periods</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {periods.length - openPeriods.length}
              </div>
              <div className="text-sm text-slate-600">Closed Periods</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {periods.filter(p => p.fx_rate_locked).length}
              </div>
              <div className="text-sm text-slate-600">FX Locked</div>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-slate-600 text-center">
            💡 Periods should be created in chronological order. Close periods to finalize accounting for that month.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PeriodsTab;