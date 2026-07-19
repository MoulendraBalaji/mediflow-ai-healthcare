import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Activity {
  id: string;
  agentName: string;
  status: string;
  duration?: number;
  createdAt: string;
  briefOutput: string;
}

interface AgentActivityLogProps {
  patientId: string;
}

export default function AgentActivityLog({ patientId }: AgentActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any>(null);

  useEffect(() => {
    const fetchActivityLog = async () => {
      try {
        const response = await api.getAgentActivity(patientId, 10);
        setActivities(response.data.activities || []);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityLog();
    const interval = setInterval(fetchActivityLog, 2000);
    return () => clearInterval(interval);
  }, [patientId]);

  useEffect(() => {
    if (!selectedActivity) { setDetailData(null); return; }
    const fetchDetail = async () => {
      try {
        const response = await api.getActivityDetail(selectedActivity);
        setDetailData(response.data);
      } catch (err: any) {
        console.error('Error fetching activity detail:', err);
      }
    };
    fetchDetail();
  }, [selectedActivity]);

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'Processing':
        return <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />;
      case 'Completed':
        return <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />;
      case 'Failed':
        return <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />;
      default:
        return <div className="w-2.5 h-2.5 bg-navy-300 rounded-full" />;
    }
  };

  const getAgentStyle = (agentName: string) => {
    const styles: Record<string, string> = {
      Intake: 'bg-blue-50 text-blue-700 border-blue-100',
      Timeline: 'bg-medical-50 text-medical-700 border-medical-100',
      Navigator: 'bg-purple-50 text-purple-700 border-purple-100',
      Companion: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      Insight: 'bg-amber-50 text-amber-700 border-amber-100',
    };
    return styles[agentName] || 'bg-navy-50 text-navy-700 border-navy-100';
  };

  return (
    <div className="card-blur overflow-hidden">
      <div className="bg-gradient-to-r from-brand-50/80 to-medical-50/80 px-5 py-4 border-b border-navy-100/50">
        <h3 className="font-semibold text-navy-900 text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-brand-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          Agent Activity
        </h3>
        <p className="text-[11px] text-navy-400 mt-1">Real-time updates (last 10)</p>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading && activities.length === 0 ? (
          <div className="p-5 text-center">
            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
            <p className="mt-2 text-xs text-navy-400">Loading...</p>
          </div>
        ) : error && activities.length === 0 ? (
          <div className="p-4 text-red-500 text-xs">{error}</div>
        ) : activities.length === 0 ? (
          <div className="p-5 text-center text-navy-400 text-xs">No activity yet</div>
        ) : (
          <div className="divide-y divide-navy-50">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="p-3 hover:bg-navy-50/50 cursor-pointer transition-colors"
                onClick={() => setSelectedActivity(selectedActivity === activity.id ? null : activity.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1.5">{getStatusIndicator(activity.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${getAgentStyle(activity.agentName)}`}>
                        {activity.agentName}
                      </span>
                      <span className="text-[10px] text-navy-400">
                        {new Date(activity.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-navy-600 mt-1 line-clamp-2">{activity.briefOutput}</p>
                    {activity.duration && (
                      <p className="text-[10px] text-navy-400 mt-0.5">{activity.duration}ms</p>
                    )}
                  </div>
                  <div className="text-navy-300 flex-shrink-0 transition-transform duration-200" style={{ transform: selectedActivity === activity.id ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {selectedActivity === activity.id && detailData && (
                  <div className="mt-3 pt-3 border-t border-navy-100/50 bg-navy-50/50 rounded-xl p-3 text-xs animate-slide-down">
                    <div className="space-y-2">
                      {detailData.input && (
                        <div>
                          <p className="font-semibold text-navy-700 mb-1">Input</p>
                          <pre className="bg-white/60 p-2 rounded-lg border border-navy-100/50 overflow-auto max-h-28 text-navy-600 text-[10px]">
                            {JSON.stringify(detailData.input, null, 2)}
                          </pre>
                        </div>
                      )}
                      {detailData.output && (
                        <div>
                          <p className="font-semibold text-navy-700 mb-1">Output</p>
                          <pre className="bg-white/60 p-2 rounded-lg border border-navy-100/50 overflow-auto max-h-28 text-navy-600 text-[10px]">
                            {JSON.stringify(detailData.output, null, 2)}
                          </pre>
                        </div>
                      )}
                      {detailData.error && (
                        <div>
                          <p className="font-semibold text-red-700 mb-1">Error</p>
                          <p className="text-red-600">{detailData.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
