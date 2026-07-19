import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { extractMedicalData, validateExtraction, parseUploadedFile } from '../agents/intakeAgent.js';
import { analyzeTimeline } from '../agents/timelineAgent.js';
import { navigateCare } from '../agents/navigatorAgent.js';
import { generateReminders } from '../agents/companionAgent.js';
import { generatePatientInsight, generateHospitalAnalytics } from '../agents/insightAgent.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/intake/parse', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    let patientId = req.body.patientId || (req.query.patientId as string);
    let fileType = req.body.fileType || (req.query.fileType as string);
    let fileName: string;
    let fileBuffer: Buffer;

    if (req.file) {
      fileName = req.file.originalname;
      fileBuffer = req.file.buffer;
      fileType = fileType || 'Prescription';
    } else if (req.body.fileBuffer) {
      fileName = req.body.fileName;
      fileBuffer = Buffer.from(req.body.fileBuffer, 'base64');
    } else {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!patientId || !fileName) {
      return res.status(400).json({ error: 'Missing required fields: patientId' });
    }

    const activityId = await createActivityLog(patientId, 'Intake', 'Processing', { fileType, fileName });

    try {
      const extractedData = await parseUploadedFile(fileBuffer, fileType, fileName);
      const validation = validateExtraction(extractedData);
      if (!validation.valid) throw new Error(`Extraction validation failed: ${validation.errors.join(', ')}`);

      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Completed', extractedData, duration);

      res.json({ success: true, data: extractedData, duration, activityId });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Failed', null, duration, error.message);
      throw error;
    }
  } catch (error: any) {
    console.error('Intake agent error:', error);
    res.status(400).json({ error: 'Parsing failed', message: error.message });
  }
});

router.post('/timeline/analyze', authMiddleware, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });

    const activityId = await createActivityLog(patientId, 'Timeline', 'Processing', { patientId });

    try {
      const analysis = await analyzeTimeline(patientId);
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Completed', analysis, duration);
      res.json({ success: true, data: analysis, duration });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Failed', null, duration, error.message);
      throw error;
    }
  } catch (error: any) {
    console.error('Timeline agent error:', error);
    res.status(400).json({ error: 'Analysis failed', message: error.message });
  }
});

router.post('/navigator/recommend', authMiddleware, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const { patientId, symptoms, currentConditions } = req.body;
    if (!patientId || !symptoms) return res.status(400).json({ error: 'patientId and symptoms are required' });

    const activityId = await createActivityLog(patientId, 'Navigator', 'Processing', { symptoms, currentConditions });

    try {
      const result = await navigateCare(patientId, symptoms, currentConditions || []);
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Completed', result, duration);
      res.json({ success: true, data: result, duration });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Failed', null, duration, error.message);
      throw error;
    }
  } catch (error: any) {
    res.status(400).json({ error: 'Navigation failed', message: error.message });
  }
});

router.post('/companion/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });

    const activityId = await createActivityLog(patientId, 'Companion', 'Processing', { patientId });

    try {
      const result = await generateReminders(patientId);
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Completed', result, duration);
      res.json({ success: true, data: result, duration });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Failed', null, duration, error.message);
      throw error;
    }
  } catch (error: any) {
    res.status(400).json({ error: 'Companion generation failed', message: error.message });
  }
});

router.post('/insight/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });

    const activityId = await createActivityLog(patientId, 'Insight', 'Processing', { patientId });

    try {
      const result = await generatePatientInsight(patientId);
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Completed', result, duration);
      res.json({ success: true, data: result, duration });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await updateActivityLog(activityId, 'Failed', null, duration, error.message);
      throw error;
    }
  } catch (error: any) {
    res.status(400).json({ error: 'Insight generation failed', message: error.message });
  }
});

router.get('/insight/analytics', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const analytics = await generateHospitalAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error: any) {
    res.status(500).json({ error: 'Analytics generation failed', message: error.message });
  }
});

async function createActivityLog(patientId: string, agentName: string, status: string, input: any): Promise<string> {
  const activity = await prisma.agentActivity.create({
    data: { patientId, agentName, status, input: JSON.stringify(input) },
  });
  return activity.id;
}

async function updateActivityLog(activityId: string, status: string, output: any, duration: number, error?: string): Promise<void> {
  await prisma.agentActivity.update({
    where: { id: activityId },
    data: { status, output: output ? JSON.stringify(output) : null, duration, error },
  });
}

export default router;
