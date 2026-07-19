import { Router, Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Configure multer for file uploads (memory storage)
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Accepted: PDF, JPEG, PNG, TIFF, TXT, DOC, DOCX`));
    }
  },
});

// Get patient's medical records
router.get('/patient/:patientId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    // Authorization: patients can only access their own records
    if (req.user?.role === 'PATIENT') {
      const userPatient = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { patientId: true },
      });
      if (userPatient?.patientId !== patientId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only access your own records' });
      }
    }

    const records = await prisma.medicalRecord.findMany({
      where: { patientId },
      include: {
        provider: true,
        facility: true,
        medications: true,
      },
      orderBy: { recordDate: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.medicalRecord.count({
      where: { patientId },
    });

    res.json({
      records,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    console.error('Error fetching medical records:', error);
    res.status(500).json({ error: 'Failed to fetch records', message: error.message });
  }
});

// Upload medical record file and parse with Intake Agent
router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, recordType = 'Prescription' } = req.body;

    if (!patientId || !req.file) {
      return res.status(400).json({ error: 'Missing required fields: patientId or file' });
    }

    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    // Call Intake Agent to parse file
    const API_URL = process.env.API_URL || 'http://localhost:3001';
    const intakeResponse = await axios.post(`${API_URL}/api/agents/intake/parse`, {
      patientId,
      fileType: recordType,
      fileName,
      fileBuffer: fileBuffer.toString('base64'),
    });

    if (!intakeResponse.data.success) {
      return res.status(400).json({
        error: 'Intake agent failed',
        message: intakeResponse.data.error,
      });
    }

    const extractedData = intakeResponse.data.data;
    const activityId = intakeResponse.data.activityId;

    // Get default facility (first facility or create placeholder)
    let facility = await prisma.facility.findFirst();
    if (!facility) {
      facility = await prisma.facility.create({
        data: {
          name: 'Default Facility',
          facilityType: 'Clinic',
          address: 'Unknown',
        },
      });
    }

    // Create medical record
    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        patientId,
        facilityId: facility.id,
        recordType,
        recordDate: new Date(),
        description: extractedData.notes?.join('; ') || 'Uploaded medical record',
        fileName,
        extractedData: JSON.stringify(extractedData),
      },
      include: {
        medications: true,
        facility: true,
      },
    });

    // Create medication entries from extracted data
    if (extractedData.medications && Array.isArray(extractedData.medications)) {
      await Promise.all(
        extractedData.medications.map((med: any) =>
          prisma.medication.create({
            data: {
              patientId,
              recordId: medicalRecord.id,
              name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              startDate: med.startDate ? new Date(med.startDate) : new Date(),
              indication: med.indication,
              prescribedBy: med.prescribedBy,
            },
          })
        )
      );
    }

    res.status(201).json({
      message: 'Medical record uploaded and parsed successfully',
      recordId: medicalRecord.id,
      extractedData,
      agentActivityId: activityId,
    });
  } catch (error: any) {
    console.error('Error uploading medical record:', error);
    res.status(500).json({
      error: 'Failed to upload record',
      message: error.message,
    });
  }
});

// Create medical record (from intake agent)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      patientId,
      providerId,
      facilityId,
      recordType,
      recordDate,
      description,
      fileName,
      filePath,
      extractedData,
      medications,
    } = req.body;

    if (!patientId || !facilityId || !recordType || !recordDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const record = await prisma.medicalRecord.create({
      data: {
        patientId,
        providerId,
        facilityId,
        recordType,
        recordDate: new Date(recordDate),
        description,
        fileName,
        filePath,
        extractedData: extractedData ? JSON.stringify(extractedData) : null,
      },
      include: {
        medications: true,
        provider: true,
        facility: true,
      },
    });

    // Add medications if provided
    if (medications && Array.isArray(medications)) {
      await Promise.all(
        medications.map((med: any) =>
          prisma.medication.create({
            data: {
              patientId,
              recordId: record.id,
              name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              startDate: new Date(med.startDate || recordDate),
              endDate: med.endDate ? new Date(med.endDate) : null,
              indication: med.indication,
              prescribedBy: med.prescribedBy,
            },
          })
        )
      );
    }

    res.status(201).json({
      message: 'Medical record created successfully',
      record,
    });
  } catch (error: any) {
    console.error('Error creating medical record:', error);
    res.status(500).json({ error: 'Failed to create record', message: error.message });
  }
});

// Get medication history
router.get('/medications/:patientId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    const medications = await prisma.medication.findMany({
      where: { patientId },
      include: {
        record: true,
      },
      orderBy: { startDate: 'desc' },
    });

    // Separate active and inactive
    const now = new Date();
    const active = medications.filter((m) => !m.endDate || m.endDate > now);
    const inactive = medications.filter((m) => m.endDate && m.endDate <= now);

    res.json({
      active,
      inactive,
      total: medications.length,
    });
  } catch (error: any) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications', message: error.message });
  }
});

// Get dashboard metrics for patient
router.get('/:patientId/dashboard-metrics', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    // Get completed consultations (Completed appointments)
    const completedAppointments = await prisma.appointment.count({
      where: {
        patientId,
        status: 'Completed',
      },
    });

    // Get pending appointments
    const pendingAppointments = await prisma.appointment.count({
      where: {
        patientId,
        status: 'Scheduled',
      },
    });

    // Get active medications
    const now = new Date();
    const activeMedications = await prisma.medication.count({
      where: {
        patientId,
        OR: [
          { endDate: null },
          { endDate: { gt: now } },
        ],
      },
    });

    // Get upcoming follow-ups (appointments within next 30 days)
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const upcomingFollowUps = await prisma.appointment.count({
      where: {
        patientId,
        status: 'Scheduled',
        appointmentDate: {
          lte: thirtyDaysFromNow,
        },
      },
    });

    res.json({
      completedConsultations: completedAppointments,
      pendingAppointments,
      activeMedications,
      upcomingFollowUps,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics', message: error.message });
  }
});

// Get timeline preview (last N medical records with agent analysis)
router.get('/:patientId/timeline-preview', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const { limit = '20' } = req.query;

    const records = await prisma.medicalRecord.findMany({
      where: { patientId },
      include: {
        medications: true,
        provider: true,
        facility: true,
      },
      orderBy: { recordDate: 'desc' },
      take: parseInt(limit as string),
    });

    // Get medications for duplicate/conflict detection
    const allMedications = await prisma.medication.findMany({
      where: { patientId },
    });

    // Basic duplicate detection: medications appearing multiple times
    const medMap = new Map<string, number>();
    allMedications.forEach((med) => {
      const key = med.name.toLowerCase();
      medMap.set(key, (medMap.get(key) || 0) + 1);
    });

    const duplicateMeds = Array.from(medMap.entries())
      .filter(([_, count]) => count > 1)
      .map(([name]) => name);

    res.json({
      records,
      duplicateFlags: duplicateMeds,
      recordCount: records.length,
    });
  } catch (error: any) {
    console.error('Error fetching timeline preview:', error);
    res.status(500).json({ error: 'Failed to fetch timeline', message: error.message });
  }
});

export default router;
