'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { ambulanceApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { Ambulance, AmbulanceStatus } from '@/types';

const statusColors: Record<AmbulanceStatus, string> = {
  available: 'var(--status-completed)',
  busy: 'var(--status-en-route)',
  offline: 'var(--status-cancelled)',
};

export default function AdminAmbulancesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await ambulanceApi.getAll();
        if (res.data.success) setAmbulances(res.data.data || []);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  const handleStatusChange = async (id: string, status: AmbulanceStatus) => {
    setUpdating(id);
    try {
      const res = await ambulanceApi.updateStatus(id, status);
      if (res.data.success) {
        setAmbulances((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        );
        toast.success('Status updated');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(null);
    }
  };

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
        <Topbar title="Ambulance Fleet" subtitle={`${ambulances.length} vehicles`} />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>
          {/* Summary strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {(['available', 'busy', 'offline'] as AmbulanceStatus[]).map((s) => (
              <div key={s} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColors[s],
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {ambulances.filter((a) => a.status === s).length}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {s}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ambulances.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '3rem' }}>
                      No ambulances registered
                    </td>
                  </tr>
                ) : (
                  ambulances.map((amb) => (
                    <tr key={amb.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Truck size={14} color="var(--text-muted)" />
                          <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>
                            {amb.vehicle_number}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${amb.status === 'available' ? 'completed' : amb.status === 'busy' ? 'en_route' : 'cancelled'}`}>
                          {amb.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {amb.latitude.toFixed(4)}, {amb.longitude.toFixed(4)}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(amb.last_updated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <select
                          className="input"
                          value={amb.status}
                          onChange={(e) => handleStatusChange(amb.id, e.target.value as AmbulanceStatus)}
                          disabled={updating === amb.id}
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.8125rem', width: 'auto' }}
                          aria-label={`Change status for ${amb.vehicle_number}`}
                        >
                          <option value="available">Available</option>
                          <option value="busy">Busy</option>
                          <option value="offline">Offline</option>
                        </select>
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
