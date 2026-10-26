/**
 * Development seed for MediFlow.
 *
 * - Reads DEMO_PASSWORD (falls back to a local-only default and warns).
 * - Never prints passwords.
 * - All dates are stored as UTC; appointmentDate is midnight UTC and
 *   appointmentTime is canonical 24h "HH:mm".
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';
const usingFallbackPassword = !process.env.DEMO_PASSWORD;

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

function daysAgo(days: number): Date {
  return new Date(now - days * DAY_MS);
}

function daysFromNow(days: number): Date {
  return new Date(now + days * DAY_MS);
}

function dateOnly(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function main() {
  if (usingFallbackPassword) {
    console.warn('DEMO_PASSWORD is not set; using the local development default. Do not use this seed in production.');
  }

  await prisma.medicationDose.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.agentActivity.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.accessGrant.deleteMany();
  await prisma.emergencyProfile.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.user.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.facility.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // -------------------------------------------------------------------------
  // Facilities
  // -------------------------------------------------------------------------
  const facilities = await Promise.all(
    [
      {
        name: 'Metropolitan General Hospital',
        facilityType: 'Hospital',
        address: '123 Main Street, New York, NY 10001',
        contactNumber: '+1 212 555 0100',
        email: 'contact@metropolitan-general.example',
      },
      {
        name: 'Sunshine Family Clinic',
        facilityType: 'Clinic',
        address: '456 Oak Avenue, Los Angeles, CA 90001',
        contactNumber: '+1 213 555 0140',
        email: 'hello@sunshine-clinic.example',
      },
      {
        name: 'Northside Cardiology Centre',
        facilityType: 'Clinic',
        address: '654 Pine Road, Houston, TX 77001',
        contactNumber: '+1 713 555 0188',
        email: 'reception@northside-cardiology.example',
      },
      {
        name: 'Central Diagnostics Laboratory',
        facilityType: 'Laboratory',
        address: '321 Maple Drive, Boston, MA 02101',
        contactNumber: '+1 617 555 0122',
        email: 'labs@central-diagnostics.example',
      },
      {
        name: 'Riverside Urgent Care',
        facilityType: 'Urgent Care',
        address: '159 Cedar Way, Denver, CO 80201',
        contactNumber: '+1 303 555 0199',
        email: 'desk@riverside-urgent.example',
      },
      {
        name: 'Westside Pulmonary Institute',
        facilityType: 'Clinic',
        address: '987 Birch Lane, Seattle, WA 98101',
        contactNumber: '+1 206 555 0177',
        email: 'team@westside-pulmonary.example',
      },
    ].map((data) => prisma.facility.create({ data }))
  );

  const [metro, sunshine, cardiology, diagnostics, urgent, pulmonary] = facilities;

  // -------------------------------------------------------------------------
  // Providers
  // -------------------------------------------------------------------------
  const providers = await Promise.all(
    [
      {
        firstName: 'John',
        lastName: 'Smith',
        specialty: 'General Practitioner',
        licenseNumber: 'MD-1001',
        contactNumber: '+1 212 555 1001',
        email: 'john.smith@mediflow.dev',
        facilityId: metro.id,
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        specialty: 'Cardiologist',
        licenseNumber: 'MD-1002',
        contactNumber: '+1 713 555 1002',
        email: 'sarah.johnson@mediflow.dev',
        facilityId: cardiology.id,
      },
      {
        firstName: 'Michael',
        lastName: 'Chen',
        specialty: 'Endocrinologist',
        licenseNumber: 'MD-1003',
        contactNumber: '+1 213 555 1003',
        email: 'michael.chen@mediflow.dev',
        facilityId: sunshine.id,
      },
      {
        firstName: 'Emily',
        lastName: 'Williams',
        specialty: 'Pulmonologist',
        licenseNumber: 'MD-1004',
        contactNumber: '+1 206 555 1004',
        email: 'emily.williams@mediflow.dev',
        facilityId: pulmonary.id,
      },
      {
        firstName: 'Priya',
        lastName: 'Nair',
        specialty: 'Emergency Physician',
        licenseNumber: 'MD-1005',
        contactNumber: '+1 303 555 1005',
        email: 'priya.nair@mediflow.dev',
        facilityId: urgent.id,
      },
      {
        firstName: 'Daniel',
        lastName: 'Okafor',
        specialty: 'Internal Medicine',
        licenseNumber: 'MD-1006',
        contactNumber: '+1 212 555 1006',
        email: 'daniel.okafor@mediflow.dev',
        facilityId: metro.id,
      },
    ].map((data) => prisma.provider.create({ data }))
  );

  const [drSmith, drJohnson, drChen, drWilliams, drNair, drOkafor] = providers;

  // -------------------------------------------------------------------------
  // Patients + users
  // -------------------------------------------------------------------------
  const patientSeeds = [
    {
      firstName: 'Robert',
      lastName: 'Anderson',
      dateOfBirth: new Date('1965-03-15'),
      gender: 'MALE' as const,
      email: 'robert.anderson@mediflow.dev',
      contactNumber: '+1 555 010 1001',
      address: '12 Hudson Street, New York, NY 10013',
      emergencyContact: 'Alice Anderson (spouse) +1 555 010 2001',
    },
    {
      firstName: 'Jennifer',
      lastName: 'Martinez',
      dateOfBirth: new Date('1978-07-22'),
      gender: 'FEMALE' as const,
      email: 'jennifer.martinez@mediflow.dev',
      contactNumber: '+1 555 010 1002',
      address: '88 Sunset Boulevard, Los Angeles, CA 90028',
      emergencyContact: 'Carlos Martinez (brother) +1 555 010 2002',
    },
    {
      firstName: 'Marcus',
      lastName: 'Johnson',
      dateOfBirth: new Date('1972-09-12'),
      gender: 'MALE' as const,
      email: 'marcus.johnson@mediflow.dev',
      contactNumber: '+1 555 010 1003',
      address: '410 Rainier Avenue, Seattle, WA 98104',
      emergencyContact: 'Diana Johnson (spouse) +1 555 010 2003',
    },
  ];

  const patients = [];
  for (const seed of patientSeeds) {
    const patient = await prisma.patient.create({ data: seed });
    await prisma.user.create({
      data: {
        email: seed.email,
        password: passwordHash,
        name: `${seed.firstName} ${seed.lastName}`,
        role: 'PATIENT',
        patientId: patient.id,
      },
    });
    await prisma.userPreference.create({
      data: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: seed.email } })).id },
    });
    patients.push(patient);
  }

  for (const provider of providers) {
    await prisma.user.create({
      data: {
        email: provider.email,
        password: passwordHash,
        name: `${provider.firstName} ${provider.lastName}`,
        role: 'DOCTOR',
        providerId: provider.id,
      },
    });
  }

  await prisma.user.create({
    data: {
      email: 'admin@mediflow.dev',
      password: passwordHash,
      name: 'MediFlow Administrator',
      role: 'ADMIN',
    },
  });

  const [robert, jennifer, marcus] = patients;

  // Robert explicitly shares read access with Dr. Smith, beyond the link created
  // by records and appointments.
  await prisma.accessGrant.create({
    data: {
      patientId: robert.id,
      providerId: drSmith.id,
      scope: 'READ',
      expiresAt: daysFromNow(365),
    },
  });

  // -------------------------------------------------------------------------
  // Medical records + medications
  // -------------------------------------------------------------------------
  const robertPrescription = await prisma.medicalRecord.create({
    data: {
      patientId: robert.id,
      providerId: drSmith.id,
      facilityId: metro.id,
      recordType: 'PRESCRIPTION',
      recordDate: daysAgo(30),
      description: 'Diabetes and blood-pressure review. Continue current medicines.',
      fileName: 'robert-prescription.pdf',
      extractedData: {
        patientName: 'Robert Anderson',
        providerName: 'John Smith',
        facilityName: 'Metropolitan General Hospital',
        allergies: ['Penicillin'],
        diagnoses: ['Type 2 diabetes', 'Essential hypertension'],
        notes: ['HbA1c discussed.', 'Continue lifestyle measures.'],
        confidence: { medications: 0.9, allergies: 0.85, diagnoses: 0.9, encounters: 0.8, notes: 0.8, overall: 0.85 },
      },
    },
  });

  await prisma.medication.createMany({
    data: [
      {
        patientId: robert.id,
        recordId: robertPrescription.id,
        name: 'Metformin',
        dosage: '500 mg',
        frequency: 'Twice daily with meals',
        indication: 'Type 2 diabetes',
        prescribedBy: 'Dr. John Smith',
        startDate: daysAgo(365),
      },
      {
        patientId: robert.id,
        recordId: robertPrescription.id,
        name: 'Lisinopril',
        dosage: '10 mg',
        frequency: 'Once daily',
        indication: 'Hypertension',
        prescribedBy: 'Dr. John Smith',
        startDate: daysAgo(200),
      },
    ],
  });

  const robertLabs = await prisma.medicalRecord.create({
    data: {
      patientId: robert.id,
      providerId: drChen.id,
      facilityId: diagnostics.id,
      recordType: 'LAB_REPORT',
      recordDate: daysAgo(20),
      description: 'HbA1c 7.2 percent; fasting glucose 145 mg/dL; creatinine 1.1 mg/dL.',
      fileName: 'robert-labs.pdf',
      extractedData: {
        allergies: [],
        diagnoses: ['Type 2 diabetes'],
        notes: ['HbA1c above target.', 'Renal function within recorded reference range.'],
        vitalSigns: { bloodPressure: '132/84', heartRate: '72', temperature: null, respiratoryRate: null },
        confidence: { medications: 0.6, allergies: 0.5, diagnoses: 0.85, encounters: 0.8, notes: 0.85, overall: 0.72 },
      },
    },
  });

  const robertOldPrescription = await prisma.medicalRecord.create({
    data: {
      patientId: robert.id,
      providerId: drSmith.id,
      facilityId: metro.id,
      recordType: 'PRESCRIPTION',
      recordDate: daysAgo(95),
      description: 'Earlier diabetes prescription. Metformin continued at the same dose.',
      fileName: 'robert-old-prescription.pdf',
      extractedData: {
        allergies: ['Penicillin'],
        diagnoses: ['Type 2 diabetes'],
        notes: ['Previous course.'],
      },
    },
  });

  await prisma.medication.createMany({
    data: [
      {
        patientId: robert.id,
        recordId: robertOldPrescription.id,
        name: 'Metformin',
        dosage: '500 mg',
        frequency: 'Twice daily with meals',
        indication: 'Type 2 diabetes',
        prescribedBy: 'Dr. John Smith',
        startDate: daysAgo(95),
        endDate: daysAgo(60),
      },
      {
        patientId: robert.id,
        recordId: robertOldPrescription.id,
        name: 'Ibuprofen',
        dosage: '400 mg',
        frequency: 'As needed for pain',
        indication: 'Knee pain',
        prescribedBy: 'Dr. John Smith',
        startDate: daysAgo(40),
      },
    ],
  });

  const jenniferPrescription = await prisma.medicalRecord.create({
    data: {
      patientId: jennifer.id,
      providerId: drChen.id,
      facilityId: sunshine.id,
      recordType: 'PRESCRIPTION',
      recordDate: daysAgo(25),
      description: 'Thyroid replacement therapy review.',
      fileName: 'jennifer-prescription.pdf',
      extractedData: {
        allergies: [],
        diagnoses: ['Hypothyroidism'],
        notes: ['TSH within range on current dose.'],
      },
    },
  });

  await prisma.medication.createMany({
    data: [
      {
        patientId: jennifer.id,
        recordId: jenniferPrescription.id,
        name: 'Levothyroxine',
        dosage: '75 mcg',
        frequency: 'Once daily before breakfast',
        indication: 'Hypothyroidism',
        prescribedBy: 'Dr. Michael Chen',
        startDate: daysAgo(600),
      },
    ],
  });

  const marcusPrescription = await prisma.medicalRecord.create({
    data: {
      patientId: marcus.id,
      providerId: drWilliams.id,
      facilityId: pulmonary.id,
      recordType: 'PRESCRIPTION',
      recordDate: daysAgo(18),
      description: 'COPD maintenance and reliever inhalers reviewed.',
      fileName: 'marcus-prescription.pdf',
      extractedData: {
        allergies: ['Dust mites'],
        diagnoses: ['COPD', 'Asthma'],
        notes: ['Inhaler technique checked.'],
      },
    },
  });

  await prisma.medication.createMany({
    data: [
      {
        patientId: marcus.id,
        recordId: marcusPrescription.id,
        name: 'Albuterol',
        dosage: '100 mcg inhaler',
        frequency: 'Two puffs as needed',
        indication: 'Asthma and COPD relief',
        prescribedBy: 'Dr. Emily Williams',
        startDate: daysAgo(365),
      },
      {
        patientId: marcus.id,
        recordId: marcusPrescription.id,
        name: 'Fluticasone/Salmeterol',
        dosage: '45/21 mcg inhaler',
        frequency: 'One puff twice daily',
        indication: 'COPD maintenance',
        prescribedBy: 'Dr. Emily Williams',
        startDate: daysAgo(200),
        refillDueDate: daysFromNow(10),
      },
    ],
  });

  await prisma.medicalRecord.create({
    data: {
      patientId: marcus.id,
      providerId: drWilliams.id,
      facilityId: pulmonary.id,
      recordType: 'LAB_REPORT',
      recordDate: daysAgo(8),
      description: 'Spirometry: FEV1 65 percent of predicted.',
      fileName: 'marcus-spirometry.pdf',
      extractedData: {
        allergies: [],
        diagnoses: ['COPD'],
        notes: ['FEV1 reduced compared with predicted values.'],
        confidence: { medications: 0.5, allergies: 0.5, diagnoses: 0.8, encounters: 0.7, notes: 0.85, overall: 0.67 },
      },
    },
  });

  // A deliberately old record so the timeline shows an ongoing care gap.
  await prisma.medicalRecord.create({
    data: {
      patientId: jennifer.id,
      providerId: drChen.id,
      facilityId: sunshine.id,
      recordType: 'ENCOUNTER',
      recordDate: daysAgo(420),
      description: 'Initial thyroid assessment. Follow-up recommended in six months.',
      fileName: 'jennifer-initial-note.pdf',
      extractedData: { allergies: [], diagnoses: ['Hypothyroidism'], notes: ['Baseline visit.'] },
    },
  });

  await prisma.emergencyProfile.create({
    data: {
      patientId: robert.id,
      bloodGroup: 'O+',
      allergies: ['Penicillin'],
      conditions: ['Type 2 diabetes', 'Essential hypertension'],
      contacts: [{ name: 'Alice Anderson', relation: 'Spouse', phone: '+1 555 010 2001' }],
      organDonor: true,
    },
  });

  // -------------------------------------------------------------------------
  // Appointments
  // -------------------------------------------------------------------------
  await prisma.appointment.createMany({
    data: [
      {
        patientId: robert.id,
        providerId: drSmith.id,
        facilityId: metro.id,
        appointmentDate: dateOnly(daysFromNow(7)),
        appointmentTime: '10:00',
        status: 'SCHEDULED',
        reason: 'Diabetes and blood-pressure follow-up',
        urgency: 'MEDIUM',
      },
      {
        patientId: robert.id,
        providerId: drJohnson.id,
        facilityId: cardiology.id,
        appointmentDate: dateOnly(daysAgo(14)),
        appointmentTime: '14:30',
        status: 'COMPLETED',
        reason: 'Cardiology review',
        urgency: 'LOW',
        notes: 'Blood pressure acceptable. Continue current plan.',
      },
      {
        patientId: robert.id,
        providerId: drSmith.id,
        facilityId: metro.id,
        appointmentDate: dateOnly(daysAgo(45)),
        appointmentTime: '09:30',
        status: 'NOSHOW',
        reason: 'Medication review',
        urgency: 'MEDIUM',
      },
      {
        patientId: jennifer.id,
        providerId: drChen.id,
        facilityId: sunshine.id,
        appointmentDate: dateOnly(daysFromNow(14)),
        appointmentTime: '11:00',
        status: 'SCHEDULED',
        reason: 'Thyroid check-up',
        urgency: 'LOW',
      },
      {
        patientId: jennifer.id,
        providerId: drChen.id,
        facilityId: sunshine.id,
        appointmentDate: dateOnly(daysAgo(60)),
        appointmentTime: '16:00',
        status: 'CANCELLED',
        reason: 'Routine review',
        urgency: 'LOW',
        cancelledAt: daysAgo(61),
      },
      {
        patientId: marcus.id,
        providerId: drWilliams.id,
        facilityId: pulmonary.id,
        appointmentDate: dateOnly(daysFromNow(5)),
        appointmentTime: '09:00',
        status: 'SCHEDULED',
        reason: 'Pulmonary function review',
        urgency: 'MEDIUM',
      },
      {
        patientId: marcus.id,
        providerId: drNair.id,
        facilityId: urgent.id,
        appointmentDate: dateOnly(daysAgo(90)),
        appointmentTime: '10:30',
        status: 'COMPLETED',
        reason: 'Urgent breathing assessment',
        urgency: 'HIGH',
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Reminders
  // -------------------------------------------------------------------------
  await prisma.reminder.createMany({
    data: [
      {
        patientId: robert.id,
        reminderType: 'MEDICATION',
        title: 'Take Metformin',
        description: '500 mg twice daily with meals.',
        dueDate: new Date(`${new Date().toISOString().slice(0, 10)}T08:00:00.000Z`),
        status: 'PENDING',
      },
      {
        patientId: robert.id,
        reminderType: 'FOLLOW_UP',
        title: 'Book a blood-pressure review',
        description: 'The last medication review was not attended. Contact the clinic to rebook.',
        dueDate: daysAgo(2),
        status: 'PENDING',
      },
      {
        patientId: jennifer.id,
        reminderType: 'APPOINTMENT',
        title: 'Thyroid check-up in two weeks',
        description: 'Bring your current levothyroxine pack and any recent blood tests.',
        dueDate: daysFromNow(14),
        status: 'PENDING',
      },
      {
        patientId: marcus.id,
        reminderType: 'REFILL',
        title: 'Refill Fluticasone/Salmeterol',
        description: 'The recorded supply is due for review. Ask the clinic or pharmacist about a refill.',
        dueDate: daysFromNow(10),
        status: 'PENDING',
      },
      {
        patientId: marcus.id,
        reminderType: 'MEDICATION',
        title: 'Take Fluticasone/Salmeterol',
        description: 'One puff twice daily.',
        dueDate: daysAgo(1),
        status: 'ACKNOWLEDGED',
      },
    ],
  });

  // Keep the referenced include results alive for clarity in future edits.
  void robertPrescription;
  void robertLabs;
  void robertOldPrescription;
  void jenniferPrescription;
  void marcusPrescription;

  console.log('Seed complete.');
  console.log(`Facilities: ${facilities.length} | Providers: ${providers.length} | Patients: ${patients.length}`);
  console.log('Accounts (password from DEMO_PASSWORD):');
  console.log('  Patient: robert.anderson@mediflow.dev');
  console.log('  Patient: jennifer.martinez@mediflow.dev');
  console.log('  Patient: marcus.johnson@mediflow.dev');
  console.log('  Doctor:  john.smith@mediflow.dev');
  console.log('  Doctor:  sarah.johnson@mediflow.dev');
  console.log('  Doctor:  michael.chen@mediflow.dev');
  console.log('  Admin:   admin@mediflow.dev');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
