import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { Employee, Account, CreateEmployeeInput, Currency } from '../../../server/src/schema';

interface EmployeesTabProps {
  employees: Employee[];
  accounts: Account[];
  onUpdate: () => void;
}

function EmployeesTab({ employees, accounts, onUpdate }: EmployeesTabProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateEmployeeInput>({
    name: '',
    email: null,
    payroll_currency: 'PKR',
    payroll_account_id: 0
  });

  const payrollAccounts = accounts.filter(acc => acc.is_payroll_source && acc.is_active);
  const usdPayrollAccounts = payrollAccounts.filter(acc => acc.currency === 'USD');
  const pkrPayrollAccounts = payrollAccounts.filter(acc => acc.currency === 'PKR');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || formData.payroll_account_id === 0) return;

    setIsCreating(true);
    try {
      await trpc.createEmployee.mutate(formData);
      setFormData({
        name: '',
        email: null,
        payroll_currency: 'PKR',
        payroll_account_id: 0
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to create employee:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getAccountName = (accountId: number) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? `${account.code} - ${account.name}` : 'Unknown account';
  };

  const getCurrencyIcon = (currency: Currency) => {
    return currency === 'USD' ? '💵' : '💴';
  };

  const currentPayrollAccounts = formData.payroll_currency === 'USD' ? usdPayrollAccounts : pkrPayrollAccounts;

  return (
    <div className="space-y-6">
      {/* Create Employee Form */}
      <Card className="bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-pink-700">
            👥 Employee Management
          </CardTitle>
          <CardDescription>
            Manage employees and their payroll settings for multi-currency operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Employee Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateEmployeeInput) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter employee name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateEmployeeInput) => ({
                      ...prev,
                      email: e.target.value || null
                    }))
                  }
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payroll-currency">Payroll Currency</Label>
                <Select
                  value={formData.payroll_currency}
                  onValueChange={(value: Currency) =>
                    setFormData((prev: CreateEmployeeInput) => ({
                      ...prev,
                      payroll_currency: value,
                      payroll_account_id: 0 // Reset account when currency changes
                    }))
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
                <Label htmlFor="payroll-account">Payroll Source Account</Label>
                <Select
                  value={formData.payroll_account_id.toString()}
                  onValueChange={(value) =>
                    setFormData((prev: CreateEmployeeInput) => ({
                      ...prev,
                      payroll_account_id: parseInt(value)
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payroll account" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentPayrollAccounts.length === 0 ? (
                      <SelectItem value="0" disabled>
                        No {formData.payroll_currency} payroll accounts available
                      </SelectItem>
                    ) : (
                      currentPayrollAccounts.map((account: Account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isCreating || formData.payroll_account_id === 0} 
              className="bg-pink-600 hover:bg-pink-700"
            >
              {isCreating ? 'Creating...' : '➕ Create Employee'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Employees List */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-slate-700">Current Employees</h3>
        {employees.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-slate-500">
              <div className="text-4xl mb-4">👥</div>
              <p>No employees registered yet. Create one above!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee: Employee) => (
              <Card key={employee.id} className="bg-gradient-to-br from-white to-pink-50 border-pink-100">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      👤 {employee.name}
                    </span>
                    <Badge variant="outline" className="text-pink-600 border-pink-200">
                      ID: {employee.id}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-sm text-slate-600">Email</Label>
                    <div className="text-sm font-medium">
                      {employee.email ? (
                        <span className="text-blue-600">{employee.email}</span>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">
                          Not provided
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-slate-600">Payroll Currency</Label>
                    <div className="text-sm font-medium">
                      <Badge 
                        variant="secondary" 
                        className={employee.payroll_currency === 'USD' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                        }
                      >
                        {getCurrencyIcon(employee.payroll_currency)} {employee.payroll_currency}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-slate-600">Payroll Account</Label>
                    <div className="text-sm font-medium">
                      <Badge variant="outline" className="text-purple-600 border-purple-200">
                        💼 {getAccountName(employee.payroll_account_id)}
                      </Badge>
                    </div>
                  </div>

                  <Separator />
                  
                  <div className="text-xs text-slate-500">
                    Created: {employee.created_at.toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Payroll Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-700 flex items-center gap-2">
            📊 Payroll Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {employees.length}
              </div>
              <div className="text-sm text-slate-600">Total Employees</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {employees.filter(emp => emp.payroll_currency === 'USD').length}
              </div>
              <div className="text-sm text-slate-600">💵 USD Payroll</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {employees.filter(emp => emp.payroll_currency === 'PKR').length}
              </div>
              <div className="text-sm text-slate-600">💴 PKR Payroll</div>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            <h4 className="font-medium text-slate-700">Available Payroll Accounts:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label className="text-sm text-slate-600">USD Payroll Sources ({usdPayrollAccounts.length})</Label>
                <div className="space-y-1">
                  {usdPayrollAccounts.length === 0 ? (
                    <Badge variant="outline" className="text-slate-500">None configured</Badge>
                  ) : (
                    usdPayrollAccounts.map((account: Account) => (
                      <Badge key={account.id} variant="outline" className="block text-center text-xs">
                        {account.code} - {account.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm text-slate-600">PKR Payroll Sources ({pkrPayrollAccounts.length})</Label>
                <div className="space-y-1">
                  {pkrPayrollAccounts.length === 0 ? (
                    <Badge variant="outline" className="text-slate-500">None configured</Badge>
                  ) : (
                    pkrPayrollAccounts.map((account: Account) => (
                      <Badge key={account.id} variant="outline" className="block text-center text-xs">
                        {account.code} - {account.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeesTab;