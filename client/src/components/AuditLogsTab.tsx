import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import type { AuditLog } from '../../../server/src/schema';

function AuditLogsTab() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadAuditLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.getAuditLogs.query();
      setAuditLogs(data);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const getActionBadge = (action: string) => {
    const colorMap: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-700',
      UPDATE: 'bg-blue-100 text-blue-700',
      DELETE: 'bg-red-100 text-red-700',
      POST: 'bg-purple-100 text-purple-700',
      CLOSE: 'bg-orange-100 text-orange-700'
    };

    const iconMap: Record<string, string> = {
      CREATE: '➕',
      UPDATE: '✏️',
      DELETE: '🗑️',
      POST: '✅',
      CLOSE: '🔒'
    };

    return (
      <Badge variant="secondary" className={colorMap[action] || 'bg-gray-100 text-gray-700'}>
        {iconMap[action] || '📝'} {action}
      </Badge>
    );
  };

  const getTableIcon = (tableName: string) => {
    const iconMap: Record<string, string> = {
      partners: '🤝',
      accounts: '💰',
      employees: '👥',
      journals: '📝',
      journal_lines: '📄',
      periods: '📅',
      fx_rates: '💱',
      capital_movements: '💼',
      users: '👤'
    };

    return iconMap[tableName] || '📋';
  };

  const formatJsonData = (jsonString: string | null) => {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return jsonString;
    }
  };

  const filteredLogs = auditLogs.filter(log =>
    log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.record_id.toString().includes(searchTerm)
  );

  const sortedLogs = [...filteredLogs].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-700">
            🔍 Audit Trail
          </CardTitle>
          <CardDescription>
            Complete audit trail of all system changes and activities
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Search and Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label htmlFor="search">Search Audit Logs</Label>
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  placeholder="Search by table, action, or record ID..."
                  className="w-64"
                />
              </div>
              <Button variant="outline" onClick={loadAuditLogs} disabled={isLoading}>
                🔄 Refresh
              </Button>
            </div>
            
            <div className="flex gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{auditLogs.length}</div>
                <div className="text-sm text-slate-600">Total Logs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {auditLogs.filter(log => log.action === 'CREATE').length}
                </div>
                <div className="text-sm text-slate-600">Creates</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {auditLogs.filter(log => log.action === 'UPDATE').length}
                </div>
                <div className="text-sm text-slate-600">Updates</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log Entries</CardTitle>
          <CardDescription>
            {filteredLogs.length} of {auditLogs.length} entries
            {searchTerm && ` (filtered by "${searchTerm}")`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading audit logs...</p>
            </div>
          ) : sortedLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <div className="text-4xl mb-4">🔍</div>
              <p>{searchTerm ? `No audit logs found matching "${searchTerm}"` : 'No audit logs available'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLogs.map((log: AuditLog) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      <div>{log.timestamp.toLocaleDateString()}</div>
                      <div className="text-slate-500">{log.timestamp.toLocaleTimeString()}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <span>{getTableIcon(log.table_name)}</span>
                        {log.table_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      #{log.record_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        👤 User #{log.user_id}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {log.ip_address || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLog(log)}
                          >
                            👁️ View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Audit Log Details - {log.action} on {log.table_name}
                            </DialogTitle>
                            <DialogDescription>
                              Record ID: #{log.record_id} • {log.timestamp.toLocaleString()}
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedLog && selectedLog.id === log.id && (
                            <div className="space-y-4">
                              {/* Basic Info */}
                              <Card>
                                <CardContent className="p-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <Label>Table</Label>
                                      <div className="font-medium flex items-center gap-1">
                                        <span>{getTableIcon(log.table_name)}</span>
                                        {log.table_name}
                                      </div>
                                    </div>
                                    <div>
                                      <Label>Action</Label>
                                      <div>{getActionBadge(log.action)}</div>
                                    </div>
                                    <div>
                                      <Label>User ID</Label>
                                      <div className="font-medium">#{log.user_id}</div>
                                    </div>
                                    <div>
                                      <Label>IP Address</Label>
                                      <div className="font-mono text-xs">{log.ip_address || 'Unknown'}</div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Old Values */}
                              {log.old_values && (
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Old Values</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <pre className="bg-red-50 p-4 rounded-md text-sm overflow-auto">
                                      {JSON.stringify(formatJsonData(log.old_values), null, 2)}
                                    </pre>
                                  </CardContent>
                                </Card>
                              )}

                              {/* New Values */}
                              {log.new_values && (
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">New Values</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <pre className="bg-green-50 p-4 rounded-md text-sm overflow-auto">
                                      {JSON.stringify(formatJsonData(log.new_values), null, 2)}
                                    </pre>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-700 flex items-center gap-2">
            📊 Activity Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['CREATE', 'UPDATE', 'DELETE', 'POST'].map(action => {
              const count = auditLogs.filter(log => log.action === action).length;
              return (
                <div key={action} className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{count}</div>
                  <div className="text-sm text-slate-600">{action} Actions</div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 text-center">
            <div className="text-sm text-slate-600">
              💡 All system changes are automatically logged for audit compliance
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuditLogsTab;