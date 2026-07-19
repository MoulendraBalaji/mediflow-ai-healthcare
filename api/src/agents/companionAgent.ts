import { prisma } from '../index.js';
import { groqChat } from '../services/groqService.js';

export interface GeneratedReminder {
  reminderType: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High';
}

export interface CompanionResult {
  reminders: GeneratedReminder[];
  explanations: Record<string, string>;
  missedAppointments: Array<{
    appointmentId: string;
    reason: string;
    date: string;
    providerName: string;
  }>;
  adherenceScore: number;
  aiSummary: string;
}

export async function generateReminders(patientId: string): Promise<CompanionResult> {
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
    include: { provider: true, facility: true },
    orderBy: { appointmentDate: 'desc' },
  });

  const pastDue = appointments.filter(
    a => a.status === 'Scheduled' && new Date(a.appointmentDate) < new Date()
  );

  const upcoming = appointments.filter(
    a => a.status === 'Scheduled' && new Date(a.appointmentDate) >= new Date()
  );

  const reminders: GeneratedReminder[] = [];

  for (const med of medications) {
    reminders.push({
      reminderType: 'Medication',
      title: `Take ${med.name}`,
      description: `Remember to take ${med.name} ${med.dosage || ''} ${med.frequency || 'as prescribed'}`,
      dueDate: new Date().toISOString(),
      priority: 'High',
    });
  }

  for (const appt of upcoming.slice(0, 3)) {
    const daysUntil = Math.ceil(
      (new Date(appt.appointmentDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    reminders.push({
      reminderType: 'Appointment',
      title: `Upcoming: ${appt.reason || 'Appointment'} with Dr. ${appt.provider?.firstName} ${appt.provider?.lastName}`,
      description: `Your appointment is in ${daysUntil} day(s) at ${appt.facility?.name || 'the clinic'}`,
      dueDate: appt.appointmentDate.toISOString(),
      priority: daysUntil <= 3 ? 'High' : 'Medium',
    });
  }

  for (const appt of pastDue.slice(0, 2)) {
    reminders.push({
      reminderType: 'FollowUp',
      title: `Missed: ${appt.reason || 'Appointment'}`,
      description: `You missed an appointment on ${new Date(appt.appointmentDate).toLocaleDateString()}. Please reschedule with Dr. ${appt.provider?.firstName} ${appt.provider?.lastName}.`,
      dueDate: new Date().toISOString(),
      priority: 'High',
    });
  }

  if (medications.length > 0) {
    reminders.push({
      reminderType: 'Refill',
      title: 'Medication refill reminder',
      description: `Check if you need to refill: ${medications.map(m => m.name).join(', ')}`,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'Medium',
    });
  }

  const adherenceScore = Math.max(
    50,
    100 - pastDue.length * 10 - (medications.length > 0 ? 5 : 0)
  );

  const missedAppointments = pastDue.map(a => ({
    appointmentId: a.id,
    reason: a.reason || 'No reason provided',
    date: a.appointmentDate.toISOString(),
    providerName: `Dr. ${a.provider?.firstName || ''} ${a.provider?.lastName || ''}`,
  }));

  const systemPrompt = `You are a friendly healthcare companion AI. Generate a warm, caring summary of the patient's care reminders and adherence. Be encouraging but honest. Keep it under 3 sentences.`;
  const userPrompt = `Patient: ${patient.firstName}. Active medications: ${medications.map(m => m.name).join(', ') || 'None'}. Upcoming appointments: ${upcoming.length}. Missed appointments: ${pastDue.length}. Adherence score: ${adherenceScore}%.`;

  let aiSummary: string;
  try {
    aiSummary = await groqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  } catch {
    aiSummary = `${patient.firstName} has ${medications.length} active medication(s) and ${upcoming.length} upcoming appointment(s). ${pastDue.length > 0 ? `${pastDue.length} appointment(s) were missed and should be rescheduled.` : 'No missed appointments.'} Keep up the good work with your health management!`;
  }

  const explanations: Record<string, string> = {};
  for (const med of medications) {
    explanations[med.name] = await explainMedication(med.name, med.indication || '');
  }

  return {
    reminders,
    explanations,
    missedAppointments,
    adherenceScore,
    aiSummary,
  };
}

async function explainMedication(name: string, indication: string): Promise<string> {
  try {
    return await groqChat([
      {
        role: 'system',
        content: 'Explain a medication in simple, patient-friendly language in 1-2 sentences. No medical jargon.',
      },
      {
        role: 'user',
        content: `What is ${name} used for? It's prescribed for: ${indication}`,
      },
    ]);
  } catch {
    return `${name} is a medication${indication ? ` used to treat ${indication}` : ''}. Take it as directed by your doctor.`;
  }
}
