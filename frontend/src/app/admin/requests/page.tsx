'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { emergencyApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { PriorityBadge, StatusBadge } from '@/components/dashboard/PriorityBadge';
import { EmergencyRequest } from '@/types';

export default function AdminRequestsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [filtered, setFiltered] = useState<EmergencyRequest[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await emergencyApi.getAll();
        if (res.data.success) {
          setRequests(res.data.data || []);
          setFiltered(res.data.data || []);
        }
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  useEffect(() => {
    let result = requests;
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.emergency_type.includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.id.includes(q)
      );
    }
    setFiltered(result);
  }, [search, statusFilter, requests]);

  if (authLoading || isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <Sidebar role="admin" userName={user?.name || 'Admin'} onLogout={logout} />
      <div className="main-content">
        <Topbar title="Emergency Requests" subtitle={`${filtered.length} requests`} />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>
          {/* Filters */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                id="requests-search"
              />
            </div>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 'auto', minWidth: 140 }}
              id="status-filter"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="accepted">Accepted</option>
              <option value="en_route">En Route</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Table */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Location</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '3rem' }}>
                      No requests found
                    </td>
                  </tr>
                ) : (
                  filtered.map((req) => (
                    <tr key={req.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {req.id.slice(0, 8)}...
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {req.emergency_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </td>
                      <td><StatusBadge status={req.status} /></td>
                      <td><PriorityBadge priority={req.priority} /></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {req.latitude.toFixed(3)}, {req.longitude.toFixed(3)}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(req.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
