import { prisma } from '../index.js';
import { groqChat } from '../services/groqService.js';

export interface PatientInsight {
  patientId: string;
  adherenceScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  summary: string;
  recommendations: string[];
}

export interface HospitalAnalytics {
  totalPatients: number;
  totalAppointments: number;
  missedFollowUpRate: number;
  averageAppointmentsPerPatient: number;
  patientComplianceRate: number;
  upcomingAppointmentCount: number;
  appointmentBottlenecks: Array<{
    providerName: string;
    specialty: string;
    pendingCount: number;
    status: string;
  }>;
  complianceBreakdown: {
    compliant: number;
    partiallyCompliant: number;
    nonCompliant: number;
  };
  treatmentTimelines: Array<{
    patientName: string;
    treatment: string;
    startDate: string;
    duration: string;
    status: string;
  }>;
}

export async function generatePatientInsight(patientId: string): Promise<PatientInsight> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new Error('Patient not found');

  const medications = await prisma.medication.findMany({
    where: {
      patientId,
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
  });

  const appointments = await prisma.appointment.findMany({
    where: { patientId },
    include: { provider: true },
  });

  const records = await prisma.medicalRecord.findMany({
    where: { patientId },
    orderBy: { recordDate: 'desc' },
    take: 10,
  });

  const missedAppointments = appointments.filter(
    a => a.status === 'Missed' || (a.status === 'Scheduled' && new Date(a.appointmentDate) < new Date())
  );

  const completedAppointments = appointments.filter(a => a.status === 'Completed');

  const adherenceScore = Math.max(
    30,
    100 - missedAppointments.length * 15 - (medications.length > 5 ? 10 : 0)
  );

  const riskLevel: 'Low' | 'Medium' | 'High' =
    missedAppointments.length >= 3 ? 'High' : missedAppointments.length >= 1 ? 'Medium' : 'Low';

  const medList = medications.map(m => m.name).join(', ');
  const recentRecords = records.map(r => `${r.recordType}: ${r.description}`).join('\n');

  const systemPrompt = `You are a healthcare insights AI. Generate patient care insights including a summary and actionable recommendations. Keep the summary under 3 sentences. Provide 3-5 specific, actionable recommendations. Respond with valid JSON only.`;

  const userPrompt = `Patient: ${patient.firstName} ${patient.lastName}, ${patient.gender}
Active medications: ${medList || 'None'}
Completed appointments: ${completedAppointments.length}
Missed appointments: ${missedAppointments.length}
Recent records: ${recentRecords || 'None'}
Adherence score: ${adherenceScore}%
Risk level: ${riskLevel}`;

  try {
    const result = await groqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt + '\n\nRespond as JSON: {"summary": "...", "recommendations": ["...", "..."]}' },
    ]);

    const jsonMatch = result.match(/```json\s*([\s\S]*?)```/) || result.match(/(\{[\s\S]*\})/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : {};

    return {
      patientId,
      adherenceScore,
      riskLevel,
      summary: parsed.summary || generateDefaultSummary(patient.firstName, missedAppointments.length, medications.length),
      recommendations: parsed.recommendations || generateDefaultRecommendations(missedAppointments.length, medications.length),
    };
  } catch {
    return {
      patientId,
      adherenceScore,
      riskLevel,
      summary: generateDefaultSummary(patient.firstName, missedAppointments.length, medications.length),
      recommendations: generateDefaultRecommendations(missedAppointments.length, medications.length),
    };
  }
}

function generateDefaultSummary(name: string, missed: number, medCount: number): string {
  return `${name} has ${medCount} active medication(s) and has missed ${missed} appointment(s). Overall care adherence is ${missed <= 1 ? 'good' : 'concerning'}. Regular follow-ups are recommended.`;
}

function generateDefaultRecommendations(missed: number, medCount: number): string[] {
  const recs = [];
  if (missed > 0) recs.push('Reschedule missed appointments as soon as possible');
  if (medCount > 0) recs.push('Set up medication reminders to improve adherence');
  recs.push('Upload recent medical documents to keep your records up to date');
  recs.push('Consider scheduling a comprehensive health check-up');
  if (medCount > 3) recs.push('Discuss medication management with your doctor to simplify your regimen');
  return recs;
}

export async function generateHospitalAnalytics(): Promise<HospitalAnalytics> {
  const totalPatients = await prisma.patient.count();
  const appointments = await prisma.appointment.findMany({
    include: { provider: true, patient: true, facility: true },
  });

  const totalAppointments = appointments.length;

  const missedAppointments = appointments.filter(
    a => a.status === 'Missed' || (a.status === 'Scheduled' && new Date(a.appointmentDate) < new Date())
  );
  const completedAppointments = appointments.filter(a => a.status === 'Completed');
  const scheduledAppointments = appointments.filter(a => a.status === 'Scheduled');

  const missedFollowUpRate = totalAppointments > 0
    ? Math.round((missedAppointments.length / totalAppointments) * 100)
    : 0;

  const averageAppointmentsPerPatient = totalPatients > 0
    ? Math.round((totalAppointments / totalPatients) * 10) / 10
    : 0;

  const patientComplianceRate = totalPatients > 0
    ? Math.round(((totalAppointments - missedAppointments.length) / Math.max(totalAppointments, 1)) * 100)
    : 100;

  const upcomingAppointmentCount = scheduledAppointments.filter(
    a => new Date(a.appointmentDate) >= new Date()
  ).length;

  const providerMap = new Map<string, { name: string; specialty: string; count: number }>();
  for (const appt of scheduledAppointments) {
    if (appt.provider) {
      const key = appt.providerId;
      const existing = providerMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        providerMap.set(key, {
          name: `Dr. ${appt.provider.firstName} ${appt.provider.lastName}`,
          specialty: appt.provider.specialty,
          count: 1,
        });
      }
    }
  }

  const appointmentBottlenecks = Array.from(providerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(p => ({
      providerName: p.name,
      specialty: p.specialty,
      pendingCount: p.count,
      status: 'Scheduled',
    }));

  const patientRecords = await prisma.patient.findMany({
    include: {
      appointments: true,
    },
  });

  let compliant = 0;
  let partiallyCompliant = 0;
  let nonCompliant = 0;

  for (const p of patientRecords) {
    const pMissed = p.appointments.filter(
      a => a.status === 'Missed' || (a.status === 'Scheduled' && new Date(a.appointmentDate) < new Date())
    ).length;
    const pTotal = p.appointments.length;

    if (pTotal === 0 || pMissed === 0) compliant++;
    else if (pMissed / pTotal > 0.5) nonCompliant++;
    else partiallyCompliant++;
  }

  const providers = await prisma.provider.findMany({ include: { facility: true } });

  const treatmentTimelines = patientRecords.slice(0, 10).map(p => {
    const firstAppt = p.appointments.sort(
      (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
    )[0];
    const lastAppt = p.appointments.sort(
      (a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()
    )[0];

    return {
      patientName: `${p.firstName} ${p.lastName}`,
      treatment: lastAppt?.reason || 'General Care',
      startDate: firstAppt ? new Date(firstAppt.appointmentDate).toISOString().split('T')[0] : 'N/A',
      duration: firstAppt && lastAppt
        ? `${Math.ceil((new Date(lastAppt.appointmentDate).getTime() - new Date(firstAppt.appointmentDate).getTime()) / (1000 * 60 * 60 * 24))} days`
        : 'N/A',
      status: lastAppt?.status || 'Unknown',
    };
  });

  return {
    totalPatients,
    totalAppointments,
    missedFollowUpRate,
    averageAppointmentsPerPatient,
    patientComplianceRate,
    upcomingAppointmentCount,
    appointmentBottlenecks,
    complianceBreakdown: {
      compliant,
      partiallyCompliant,
      nonCompliant,
    },
    treatmentTimelines,
  };
}
