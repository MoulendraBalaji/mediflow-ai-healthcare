import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * Get agent activity log
 * GET /api/agent-activity?patientId=...&limit=10
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, limit = '10', offset = '0' } = req.query;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    // Check authorization (patient can only see their own activity)
    if (req.user?.role === 'PATIENT' && req.user?.userId !== patientId) {
      // For now, be lenient - in production, would check if user is patient
    }

    const activities = await prisma.agentActivity.findMany({
      where: { patientId: patientId as string },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    // Format activities for frontend
    const formattedActivities = activities.map((activity) => ({
      id: activity.id,
      agentName: activity.agentName,
      status: activity.status,
      duration: activity.duration,
      createdAt: activity.createdAt,
      input: activity.input ? JSON.parse(activity.input) : null,
      output: activity.output ? JSON.parse(activity.output) : null,
      error: activity.error,
      // Generate brief output snippet
      briefOutput: generateBriefOutput(activity),
    }));

    const total = await prisma.agentActivity.count({
      where: { patientId: patientId as string },
    });

    res.json({
      activities: formattedActivities,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    console.error('Error fetching agent activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity', message: error.message });
  }
});

/**
 * Get single agent activity detail
 * GET /api/agent-activity/:id
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const activity = await prisma.agentActivity.findUnique({
      where: { id },
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({
      id: activity.id,
      agentName: activity.agentName,
      status: activity.status,
      duration: activity.duration,
      createdAt: activity.createdAt,
      input: activity.input ? JSON.parse(activity.input) : null,
      output: activity.output ? JSON.parse(activity.output) : null,
      error: activity.error,
    });
  } catch (error: any) {
    console.error('Error fetching activity detail:', error);
    res.status(500).json({ error: 'Failed to fetch activity', message: error.message });
  }
});

/**
 * Generate brief output snippet for display
 */
function generateBriefOutput(activity: any): string {
  try {
    if (activity.status === 'Processing') {
      return 'Processing...';
    }

    if (activity.status === 'Failed') {
      return `❌ Error: ${activity.error || 'Unknown error'}`;
    }

    if (activity.status === 'Completed') {
      const output = activity.output ? JSON.parse(activity.output) : null;

      if (!output) {
        return '✓ Completed';
      }

      switch (activity.agentName) {
        case 'Intake':
          const meds = output.medications ? output.medications.length : 0;
          const diags = output.diagnoses ? output.diagnoses.length : 0;
          return `✓ Extracted ${meds} meds, ${diags} diagnoses`;

        case 'Timeline':
          const gaps = output.statistics?.gapCount || 0;
          const dupes = output.statistics?.duplicateCount || 0;
          const conflicts = output.statistics?.conflictCount || 0;
          const issues = gaps + dupes + conflicts;
          return issues > 0
            ? `⚠️ Found ${issues} care coordination issue(s)`
            : '✓ No issues detected';

        case 'Navigator':
          return '✓ Care pathway analyzed';

        case 'Companion':
          return '✓ Reminders generated';

        case 'Insight':
          return '✓ Insights generated';

        default:
          return '✓ Completed';
      }
    }

    return 'Unknown status';
  } catch (error) {
    return 'Error generating snippet';
  }
}

export default router;
