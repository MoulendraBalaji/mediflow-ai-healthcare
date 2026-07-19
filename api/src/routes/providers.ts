import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { navigateCare } from '../agents/navigatorAgent.js';
import { generatePatientInsight } from '../agents/insightAgent.js';
import { groqChat } from '../services/groqService.js';

const router = Router();

router.get('/patient/:patientId/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        medications: true,
        appointments: {
          include: { provider: true, facility: true },
          orderBy: { appointmentDate: 'desc' },
          take: 10,
        },
        medicalRecords: {
          include: { provider: true, facility: true, medications: true },
          orderBy: { recordDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const activeMedications = patient.medications.filter(
      m => !m.endDate || new Date(m.endDate) > new Date()
    );

    const allergies: string[] = [];
    const diagnoses: string[] = [];
    for (const record of patient.medicalRecords) {
      if (record.extractedData) {
        try {
          const data = JSON.parse(record.extractedData);
          if (data.allergies) allergies.push(...data.allergies);
          if (data.diagnoses) diagnoses.push(...data.diagnoses);
        } catch {}
      }
    }

    const systemPrompt = `You are a clinical summary AI. Generate a brief, structured patient summary for a healthcare provider before a consultation. Include: current conditions, active medications, recent visits, key concerns, and suggested discussion topics. Keep it professional and concise (under 200 words).`;

    const medSummary = activeMedications.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join(', ');
    const visitSummary = patient.appointments.slice(0, 5).map(
      a => `${new Date(a.appointmentDate).toLocaleDateString()} - ${a.reason || 'Visit'} (${a.status})`
    ).join('\n');

    let aiSummary: string;
    try {
      aiSummary = await groqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Patient: ${patient.firstName} ${patient.lastName}, ${patient.gender}, DOB: ${patient.dateOfBirth}\nAllergies: ${[...new Set(allergies)].join(', ') || 'None known'}\nDiagnoses: ${[...new Set(diagnoses)].join(', ') || 'None recorded'}\nActive Medications: ${medSummary || 'None'}\nRecent Visits:\n${visitSummary || 'None'}` },
      ]);
    } catch {
      aiSummary = `Patient: ${patient.firstName} ${patient.lastName}. Active medications: ${activeMedications.length}. Recent visits: ${patient.appointments.length}. Allergies: ${[...new Set(allergies)].join(', ') || 'None known'}.`;
    }

    res.json({
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        contactNumber: patient.contactNumber,
        email: patient.email,
        address: patient.address,
        emergencyContact: patient.emergencyContact,
      },
      activeMedications,
      allergies: [...new Set(allergies)],
      diagnoses: [...new Set(diagnoses)],
      recentRecords: patient.medicalRecords,
      recentAppointments: patient.appointments,
      aiSummary,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate patient summary', message: error.message });
  }
});

router.post('/navigator', authMiddleware, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const { patientId, symptoms, currentConditions } = req.body;

    if (!patientId || !symptoms || !Array.isArray(symptoms)) {
      return res.status(400).json({ error: 'patientId and symptoms array are required' });
    }

    const result = await navigateCare(patientId, symptoms, currentConditions || []);
    const duration = Date.now() - startTime;

    await prisma.agentActivity.create({
      data: {
        patientId,
        agentName: 'Navigator',
        status: 'Completed',
        input: JSON.stringify({ symptoms, currentConditions }),
        output: JSON.stringify(result),
        duration,
      },
    });

    res.json({ success: true, data: result, duration });
  } catch (error: any) {
    res.status(500).json({ error: 'Navigation failed', message: error.message });
  }
});

router.post('/insight/:patientId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const { patientId } = req.params;
    const result = await generatePatientInsight(patientId);
    const duration = Date.now() - startTime;

    await prisma.agentActivity.create({
      data: {
        patientId,
        agentName: 'Insight',
        status: 'Completed',
        input: JSON.stringify({ patientId }),
        output: JSON.stringify(result),
        duration,
      },
    });

    res.json({ success: true, data: result, duration });
  } catch (error: any) {
    res.status(500).json({ error: 'Insight generation failed', message: error.message });
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { specialty } = req.query;
    const where: any = {};
    if (specialty) where.specialty = { contains: specialty as string };

    const providers = await prisma.provider.findMany({
      where,
      include: { facility: true },
      take: 50,
    });

    res.json({ providers, total: providers.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch providers', message: error.message });
  }
});

router.post('/translate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { text, language } = req.body;

    if (!text) return res.status(400).json({ error: 'Text is required' });

    const targetLang = language || 'Spanish';

    const systemPrompt = `You are a medical translator. Translate the following medical text into ${targetLang}. Use simple, easy-to-understand language. Preserve medical accuracy while making it accessible to a layperson.`;

    let translation: string;
    try {
      translation = await groqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ]);
    } catch {
      translation = `[Translation to ${targetLang} unavailable - AI service temporarily offline]`;
    }

    res.json({ original: text, translated: translation, language: targetLang });
  } catch (error: any) {
    res.status(500).json({ error: 'Translation failed', message: error.message });
  }
});

router.post('/explain-prescription', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { text, language } = req.body;

    if (!text) return res.status(400).json({ error: 'Prescription text is required' });

    const lang = language || 'English';

    const systemPrompt = `You are a friendly healthcare explainer. Explain the following prescription or medical text in simple, everyday ${lang} language. Break it down into: what the medication is for, how to take it, important side effects to watch for, and any foods or activities to avoid. Keep it clear and reassuring.`;

    let explanation: string;
    try {
      explanation = await groqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ]);
    } catch {
      explanation = `This is a prescription that your doctor has given you. Please follow the dosage instructions provided and contact your doctor if you have any questions or experience side effects.`;
    }

    res.json({ original: text, explanation, language: lang });
  } catch (error: any) {
    res.status(500).json({ error: 'Explanation failed', message: error.message });
  }
});

export default router;
