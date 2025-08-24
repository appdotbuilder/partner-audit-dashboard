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
import { trpc } from '@/utils/trpc';
import type { FxRate, CreateFxRateInput, Currency } from '../../../server/src/schema';

interface FxRatesTabProps {
  fxRates: FxRate[];
  onUpdate: () => void;
}

function FxRatesTab({ fxRates, onUpdate }: FxRatesTabProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateFxRateInput>({
    from_currency: 'USD',
    to_currency: 'PKR',
    rate: 0,
    effective_date: new Date(),
    is_locked: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.rate <= 0) return;

    setIsCreating(true);
    try {
      await trpc.createFxRate.mutate(formData);
      setFormData({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: 0,
        effective_date: new Date(),
        is_locked: false
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to create FX rate:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (amount: number, currency: Currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const getCurrencyIcon = (currency: Currency) => {
    return currency === 'USD' ? '💵' : '💴';
  };

  const sortedRates = [...fxRates].sort((a, b) => 
    new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime()
  );

  const currentRate = sortedRates.find(rate => 
    rate.from_currency === 'USD' && 
    rate.to_currency === 'PKR' && 
    new Date(rate.effective_date) <= new Date()
  );

  return (
    <div className="space-y-6">
      {/* Current Rate Alert */}
      {currentRate && (
        <Alert className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
          <div className="flex items-center gap-2">
            <div className="text-2xl">💱</div>
            <div>
              <div className="font-medium text-yellow-800">
                Current USD/PKR Rate: {currentRate.rate.toFixed(4)}
              </div>
              <AlertDescription className="text-yellow-700">
                Effective from {currentRate.effective_date.toLocaleDateString()} 
                {currentRate.is_locked && ' • 🔒 Locked'}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Create FX Rate Form */}
      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700">
            💱 FX Rate Management
          </CardTitle>
          <CardDescription>
            Set and manage foreign exchange rates for multi-currency transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-currency">From Currency</Label>
                <Select
                  value={formData.from_currency}
                  onValueChange={(value: Currency) =>
                    setFormData((prev: CreateFxRateInput) => ({ ...prev, from_currency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">💵 USD</SelectItem>
                    <SelectItem value="PKR">💴 PKR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="to-currency">To Currency</Label>
                <Select
                  value={formData.to_currency}
                  onValueChange={(value: Currency) =>
                    setFormData((prev: CreateFxRateInput) => ({ ...prev, to_currency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">💵 USD</SelectItem>
                    <SelectItem value="PKR">💴 PKR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">Exchange Rate</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={formData.rate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateFxRateInput) => ({ 
                      ...prev, 
                      rate: parseFloat(e.target.value) || 0 
                    }))
                  }
                  placeholder="e.g., 280.5000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effective-date">Effective Date</Label>
                <Input
                  id="effective-date"
                  type="date"
                  value={formData.effective_date.toISOString().split('T')[0]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateFxRateInput) => ({ 
                      ...prev, 
                      effective_date: new Date(e.target.value)
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_locked"
                checked={formData.is_locked}
                onCheckedChange={(checked) =>
                  setFormData((prev: CreateFxRateInput) => ({ ...prev, is_locked: checked }))
                }
              />
              <Label htmlFor="is_locked" className="text-sm">
                🔒 Lock this rate (prevents modifications)
              </Label>
            </div>

            <div className="flex items-center space-x-4">
              <Button type="submit" disabled={isCreating} className="bg-yellow-600 hover:bg-yellow-700">
                {isCreating ? 'Creating...' : '➕ Create FX Rate'}
              </Button>

              {formData.rate > 0 && (
                <div className="text-sm text-slate-600">
                  Preview: 1 {getCurrencyIcon(formData.from_currency)} {formData.from_currency} = 
                  {formatCurrency(formData.rate, formData.to_currency)} {formData.to_currency}
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* FX Rates History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Exchange Rate History</span>
            <Badge variant="outline">{fxRates.length} rates</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fxRates.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <div className="text-4xl mb-4">💱</div>
              <p>No FX rates configured yet. Create one above!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From Currency</TableHead>
                  <TableHead>To Currency</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRates.map((rate: FxRate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {getCurrencyIcon(rate.from_currency)} {rate.from_currency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getCurrencyIcon(rate.to_currency)} {rate.to_currency}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {rate.rate.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      {rate.effective_date.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {rate.is_locked && (
                          <Badge variant="secondary" className="bg-red-100 text-red-700">
                            🔒 Locked
                          </Badge>
                        )}
                        {rate === currentRate && (
                          <Badge className="bg-green-100 text-green-700">
                            ✅ Current
                          </Badge>
                        )}
                        {new Date(rate.effective_date) > new Date() && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-700">
                            📅 Future
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">User #{rate.created_by}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {rate.created_at.toLocaleDateString()} {rate.created_at.toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rate Conversion Examples */}
      {currentRate && (
        <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center gap-2">
              🧮 Conversion Examples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 100, 1000].map(amount => (
                <div key={amount} className="text-center p-4 bg-white rounded-md border">
                  <div className="text-lg font-semibold text-green-600">
                    💵 ${amount.toLocaleString()} USD
                  </div>
                  <div className="text-2xl font-mono font-bold text-slate-700 my-2">
                    ↓
                  </div>
                  <div className="text-lg font-semibold text-blue-600">
                    💴 ₨{(amount * currentRate.rate).toLocaleString()} PKR
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-center text-sm text-slate-600">
              Rate: 1 USD = {currentRate.rate.toFixed(4)} PKR • Last updated: {currentRate.created_at.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default FxRatesTab;