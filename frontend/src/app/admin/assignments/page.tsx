'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { assignmentApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { StatusBadge, PriorityBadge } from '@/components/dashboard/PriorityBadge';
import { Assignment } from '@/types';

export default function AdminAssignmentsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await assignmentApi.getAll();
        if (res.data.success) setAssignments(res.data.data || []);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) load();
  }, [user]);

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
        <Topbar title="Assignments" subtitle={`${assignments.length} total assignments`} />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Assignment ID</th>
                  <th>Emergency Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>ETA</th>
                  <th>Assigned At</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '3rem' }}>
                      No assignments yet
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {a.id.slice(0, 8)}...
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {(a.emergency_requests?.emergency_type || '—')
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </td>
                      <td>
                        <PriorityBadge priority={a.emergency_requests?.priority ?? null} />
                      </td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem' }}>
                          <Clock size={12} color="var(--text-muted)" />
                          {a.eta} min
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(a.assigned_at).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {a.completed_at
                          ? new Date(a.completed_at).toLocaleDateString('en-IN')
                          : '—'}
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
