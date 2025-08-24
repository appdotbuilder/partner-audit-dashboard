import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import type { Account, CreateAccountInput, AccountType, Currency } from '../../../server/src/schema';

interface AccountsTabProps {
  accounts: Account[];
  onUpdate: () => void;
}

function AccountsTab({ accounts, onUpdate }: AccountsTabProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateAccountInput>({
    code: '',
    name: '',
    account_type: 'Asset',
    currency: 'PKR',
    is_bank: false,
    is_capital: false,
    is_payroll_source: false,
    is_intercompany: false,
    parent_id: null,
    is_active: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) return;

    setIsCreating(true);
    try {
      await trpc.createAccount.mutate(formData);
      setFormData({
        code: '',
        name: '',
        account_type: 'Asset',
        currency: 'PKR',
        is_bank: false,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to create account:', error);
    } finally {
      setIsCreating(false);
    }
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

  const getCurrencyIcon = (currency: Currency) => {
    return currency === 'USD' ? '💵' : '💴';
  };

  const getAccountsByType = (type: AccountType) => {
    return accounts.filter(acc => acc.account_type === type);
  };

  const parentAccounts = accounts.filter(acc => acc.parent_id === null && acc.is_active);

  return (
    <div className="space-y-6">
      {/* Create Account Form */}
      <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            💰 Account Management
          </CardTitle>
          <CardDescription>
            Create and manage chart of accounts for multi-currency operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Account Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, code: e.target.value }))
                  }
                  placeholder="e.g., 1001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Cash - USD"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value: AccountType) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, account_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asset">💰 Asset</SelectItem>
                    <SelectItem value="Liability">📊 Liability</SelectItem>
                    <SelectItem value="Equity">📈 Equity</SelectItem>
                    <SelectItem value="Income">💵 Income</SelectItem>
                    <SelectItem value="Expense">💸 Expense</SelectItem>
                    <SelectItem value="Other">📋 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value: Currency) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, currency: value }))
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">Parent Account (Optional)</Label>
              <Select
                value={formData.parent_id?.toString() || ''}
                onValueChange={(value) =>
                  setFormData((prev: CreateAccountInput) => ({
                    ...prev,
                    parent_id: value ? parseInt(value) : null
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {parentAccounts.map((account: Account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account Flags */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_bank"
                  checked={formData.is_bank}
                  onCheckedChange={(checked) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, is_bank: checked }))
                  }
                />
                <Label htmlFor="is_bank" className="text-sm">🏦 Bank Account</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_capital"
                  checked={formData.is_capital}
                  onCheckedChange={(checked) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, is_capital: checked }))
                  }
                />
                <Label htmlFor="is_capital" className="text-sm">📈 Capital Account</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_payroll_source"
                  checked={formData.is_payroll_source}
                  onCheckedChange={(checked) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, is_payroll_source: checked }))
                  }
                />
                <Label htmlFor="is_payroll_source" className="text-sm">👥 Payroll Source</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_intercompany"
                  checked={formData.is_intercompany}
                  onCheckedChange={(checked) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, is_intercompany: checked }))
                  }
                />
                <Label htmlFor="is_intercompany" className="text-sm">🔄 Intercompany</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev: CreateAccountInput) => ({ ...prev, is_active: checked }))
                  }
                />
                <Label htmlFor="is_active" className="text-sm">✅ Active</Label>
              </div>
            </div>

            <Button type="submit" disabled={isCreating} className="bg-orange-600 hover:bg-orange-700">
              {isCreating ? 'Creating...' : '➕ Create Account'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Accounts Overview */}
      <Tabs defaultValue="by-type" className="space-y-4">
        <TabsList className="bg-white/70">
          <TabsTrigger value="by-type">By Account Type</TabsTrigger>
          <TabsTrigger value="all-accounts">All Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="by-type" className="space-y-6">
          {(['Asset', 'Liability', 'Equity', 'Income', 'Expense', 'Other'] as AccountType[]).map((type: AccountType) => {
            const typeAccounts = getAccountsByType(type);
            if (typeAccounts.length === 0) return null;

            return (
              <Card key={type} className="bg-gradient-to-r from-white to-gray-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getAccountTypeIcon(type)} {type} Accounts
                    <Badge variant="outline">{typeAccounts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {typeAccounts.map((account: Account) => (
                      <Card key={account.id} className="bg-white border-gray-200">
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">
                                {account.code}
                              </span>
                              <div className="flex gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {getCurrencyIcon(account.currency)} {account.currency}
                                </Badge>
                                {!account.is_active && (
                                  <Badge variant="destructive" className="text-xs">Inactive</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-slate-600">
                              {account.name}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {account.is_bank && (
                                <Badge variant="secondary" className="text-xs">🏦 Bank</Badge>
                              )}
                              {account.is_capital && (
                                <Badge variant="secondary" className="text-xs">📈 Capital</Badge>
                              )}
                              {account.is_payroll_source && (
                                <Badge variant="secondary" className="text-xs">👥 Payroll</Badge>
                              )}
                              {account.is_intercompany && (
                                <Badge variant="secondary" className="text-xs">🔄 Intercompany</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="all-accounts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account: Account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getAccountTypeIcon(account.account_type)} {account.account_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCurrencyIcon(account.currency)} {account.currency}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {account.is_bank && <Badge variant="secondary" className="text-xs">Bank</Badge>}
                          {account.is_capital && <Badge variant="secondary" className="text-xs">Capital</Badge>}
                          {account.is_payroll_source && <Badge variant="secondary" className="text-xs">Payroll</Badge>}
                          {account.is_intercompany && <Badge variant="secondary" className="text-xs">IC</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "destructive"}>
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {account.created_at.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AccountsTab;