import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { hashPassword, verifyPassword, generateToken } from '../utils/auth.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, firstName, lastName, dateOfBirth, gender } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = hashPassword(password);

    // Create user and patient/provider
    let user: any;

    if (role === 'PATIENT') {
      const patient = await prisma.patient.create({
        data: {
          firstName: firstName || name.split(' ')[0],
          lastName: lastName || name.split(' ')[1] || '',
          email,
          dateOfBirth: new Date(dateOfBirth),
          gender: gender || 'Other',
        },
      });

      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'PATIENT',
          patientId: patient.id,
        },
      });
    } else if (role === 'DOCTOR') {
      // For doctors, we need specialty and facility info
      return res.status(400).json({ error: 'Doctor registration not yet implemented' });
    }

    const token = generateToken(user.id, user.email, user.role);

    res.json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        patient: true,
        provider: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.email, user.role);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        patientId: user.patientId,
        providerId: user.providerId,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// Forgot password endpoint
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account exists with this email, you will receive a password reset link shortly.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Session endpoint - verify token
router.get('/session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      include: {
        patient: true,
        provider: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        patientId: user.patientId,
        providerId: user.providerId,
        patient: user.patient,
        provider: user.provider,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Session retrieval failed', message: error.message });
  }
});

export default router;
