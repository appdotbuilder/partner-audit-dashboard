import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { Partner, Account, CreatePartnerInput } from '../../../server/src/schema';

interface PartnersTabProps {
  partners: Partner[];
  accounts: Account[];
  onUpdate: () => void;
}

function PartnersTab({ partners, accounts, onUpdate }: PartnersTabProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreatePartnerInput>({
    name: '',
    usd_account_id: null,
    pkr_account_id: null
  });

  const capitalAccounts = accounts.filter(acc => acc.is_capital && acc.is_active);
  const usdCapitalAccounts = capitalAccounts.filter(acc => acc.currency === 'USD');
  const pkrCapitalAccounts = capitalAccounts.filter(acc => acc.currency === 'PKR');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      await trpc.createPartner.mutate(formData);
      setFormData({
        name: '',
        usd_account_id: null,
        pkr_account_id: null
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to create partner:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getAccountName = (accountId: number | null) => {
    if (!accountId) return 'Not assigned';
    const account = accounts.find(acc => acc.id === accountId);
    return account ? `${account.code} - ${account.name}` : 'Unknown account';
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700">
            🤝 Partner Management
          </CardTitle>
          <CardDescription>
            Manage business partners and their capital account assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Partner Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreatePartnerInput) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter partner name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usd-account">USD Capital Account</Label>
                <Select
                  value={formData.usd_account_id?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData((prev: CreatePartnerInput) => ({
                      ...prev,
                      usd_account_id: value ? parseInt(value) : null
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select USD capital account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {usdCapitalAccounts.map((account: Account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pkr-account">PKR Capital Account</Label>
                <Select
                  value={formData.pkr_account_id?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData((prev: CreatePartnerInput) => ({
                      ...prev,
                      pkr_account_id: value ? parseInt(value) : null
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PKR capital account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {pkrCapitalAccounts.map((account: Account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={isCreating} className="bg-purple-600 hover:bg-purple-700">
              {isCreating ? 'Creating...' : '➕ Create Partner'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Partners List */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-slate-700">Current Partners</h3>
        {partners.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-slate-500">
              <div className="text-4xl mb-4">👥</div>
              <p>No partners registered yet. Create one above!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((partner: Partner) => (
              <Card key={partner.id} className="bg-gradient-to-br from-white to-purple-50 border-purple-100">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      👤 {partner.name}
                    </span>
                    <Badge variant="outline" className="text-purple-600 border-purple-200">
                      ID: {partner.id}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-sm text-slate-600">USD Capital Account</Label>
                    <div className="text-sm font-medium">
                      {partner.usd_account_id ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          💵 {getAccountName(partner.usd_account_id)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">
                          Not assigned
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-slate-600">PKR Capital Account</Label>
                    <div className="text-sm font-medium">
                      {partner.pkr_account_id ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          💴 {getAccountName(partner.pkr_account_id)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">
                          Not assigned
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />
                  
                  <div className="text-xs text-slate-500">
                    Created: {partner.created_at.toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Default Partners Info */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-700 flex items-center gap-2">
            ℹ️ Default Partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 mb-3">
            The system is designed for these business partners:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Badge variant="outline" className="justify-center p-3 text-center">
              👨‍💼 Rehan Munawar Gondal
            </Badge>
            <Badge variant="outline" className="justify-center p-3 text-center">
              👨‍💼 Hafiz Muhammad Hamza
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Each partner should have both USD and PKR capital accounts assigned for proper tracking.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default PartnersTab;