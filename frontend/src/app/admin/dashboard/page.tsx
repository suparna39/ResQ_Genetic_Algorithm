'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, Truck, Activity, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, emergencyApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import StatCard from '@/components/dashboard/StatCard';
import { PriorityBadge, StatusBadge } from '@/components/dashboard/PriorityBadge';
import { AdminMetrics, EmergencyRequest } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [recentRequests, setRecentRequests] = useState<EmergencyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && user.role !== 'admin') router.push(`/${user.role}/dashboard`);
  }, [user, authLoading]);

  useEffect(() => {
    const load = async () => {
      try {
        const [metricsRes, reqRes] = await Promise.all([
          adminApi.getMetrics(),
          adminApi.getRecentRequests(8),
        ]);
        if (metricsRes.data.success) setMetrics(metricsRes.data.data);
        if (reqRes.data.success) setRecentRequests(reqRes.data.data || []);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  const chartData = metrics
    ? [
        { name: 'Pending', value: metrics.requests.pending },
        { name: 'Active', value: metrics.requests.active },
        { name: 'Completed', value: metrics.requests.completed },
        { name: 'Critical', value: metrics.requests.critical },
      ]
    : [];

  const ambulanceChart = metrics
    ? [
        { name: 'Available', value: metrics.ambulances.available },
        { name: 'Busy', value: metrics.ambulances.busy },
        { name: 'Offline', value: metrics.ambulances.offline },
      ]
    : [];

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
        <Topbar title="Admin Dashboard" subtitle="System overview and analytics" />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>
          {/* Stat Cards */}
          {metrics && (
            <>
              <div className="grid-cols-stats" style={{ marginBottom: '1.5rem' }}>
                <StatCard
                  label="Total Requests"
                  value={metrics.requests.total}
                  icon={AlertTriangle}
                  description={`${metrics.requests.pending} pending`}
                />
                <StatCard
                  label="Active Emergencies"
                  value={metrics.requests.active}
                  icon={Activity}
                  description="Currently in progress"
                />
                <StatCard
                  label="Available Ambulances"
                  value={metrics.ambulances.available}
                  icon={Truck}
                  description={`${metrics.ambulances.busy} busy · ${metrics.ambulances.offline} offline`}
                />
                <StatCard
                  label="Avg Response ETA"
                  value={`${metrics.assignments.average_eta_minutes} min`}
                  icon={Clock}
                  description="Across all assignments"
                />
              </div>

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card card-padding">
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
                    Request Distribution
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} barSize={28}>
                      <XAxis dataKey="name" tick={{ fill: '#7a7a7a', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#7a7a7a', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#111',
                          border: '1px solid #2a2a2a',
                          borderRadius: 6,
                          color: '#ededed',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" fill="#4a4a4a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card card-padding">
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
                    Ambulance Fleet Status
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={ambulanceChart} barSize={28}>
                      <XAxis dataKey="name" tick={{ fill: '#7a7a7a', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#7a7a7a', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#111',
                          border: '1px solid #2a2a2a',
                          borderRadius: 6,
                          color: '#ededed',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" fill="#4a4a4a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Recent Requests Table */}
          <div className="card">
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Recent Requests</div>
              <a href="/admin/requests" className="btn btn-ghost btn-sm">
                View all →
              </a>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>
                        No requests yet
                      </td>
                    </tr>
                  ) : (
                    recentRequests.map((req) => (
                      <tr key={req.id}>
                        <td style={{ fontWeight: 500 }}>
                          {req.emergency_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </td>
                        <td><StatusBadge status={req.status} /></td>
                        <td><PriorityBadge priority={req.priority} /></td>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                          {new Date(req.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
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
    </div>
  );
}
