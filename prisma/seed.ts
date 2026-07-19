import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.agentActivity.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.user.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.facility.deleteMany();

  // Create facilities
  console.log('Creating facilities...');
  const facilityData = [
    {
      name: 'Metropolitan Hospital',
      facilityType: 'Hospital',
      address: '123 Main St, New York, NY 10001',
      contactNumber: '(212) 555-1234',
      email: 'admin@metrohospital.com',
    },
    {
      name: 'Sunshine Clinic',
      facilityType: 'Clinic',
      address: '456 Oak Ave, Los Angeles, CA 90001',
      contactNumber: '(213) 555-5678',
      email: 'info@sunshineclinic.com',
    },
    {
      name: 'Central Pharmacy',
      facilityType: 'Pharmacy',
      address: '789 Elm St, Chicago, IL 60601',
      contactNumber: '(312) 555-9999',
      email: 'pharmacy@central.com',
    },
    {
      name: 'Diagnostic Lab Center',
      facilityType: 'Lab',
      address: '321 Maple Dr, Boston, MA 02101',
      contactNumber: '(617) 555-4321',
      email: 'labs@diagcenter.com',
    },
    {
      name: 'Cardiology Specialists',
      facilityType: 'Clinic',
      address: '654 Pine Rd, Houston, TX 77001',
      contactNumber: '(713) 555-8765',
      email: 'info@cardiospecialists.com',
    },
    {
      name: 'Westside Medical Center',
      facilityType: 'Hospital',
      address: '987 Birch Ln, Seattle, WA 98101',
      contactNumber: '(206) 555-1111',
      email: 'admin@westsidemedical.com',
    },
    {
      name: 'Urgent Care Plus',
      facilityType: 'Clinic',
      address: '159 Cedar Way, Denver, CO 80201',
      contactNumber: '(303) 555-2222',
      email: 'info@urgentcareplus.com',
    },
    {
      name: 'Health Analytics Lab',
      facilityType: 'Lab',
      address: '753 Spruce St, Miami, FL 33101',
      contactNumber: '(305) 555-3333',
      email: 'labs@healthanalytics.com',
    },
    {
      name: 'North Star Pharmacy',
      facilityType: 'Pharmacy',
      address: '852 Willow Ave, Minneapolis, MN 55401',
      contactNumber: '(612) 555-4444',
      email: 'rx@northstarpharmacy.com',
    },
    {
      name: 'Family Medicine Clinic',
      facilityType: 'Clinic',
      address: '456 Walnut St, Austin, TX 78701',
      contactNumber: '(512) 555-5555',
      email: 'contact@familymedicineclinic.com',
    },
  ];

  const facilities = await Promise.all(
    facilityData.map((f) =>
      prisma.facility.create({
        data: f,
      })
    )
  );

  console.log(`✓ Created ${facilities.length} facilities`);

  // Create providers
  console.log('Creating providers...');
  const providerData = [
    {
      firstName: 'John',
      lastName: 'Smith',
      specialty: 'General Practitioner',
      licenseNumber: 'MD001',
      email: 'j.smith@metrohospital.com',
      contactNumber: '(212) 555-1001',
      facilityId: facilities[0].id,
    },
    {
      firstName: 'Sarah',
      lastName: 'Johnson',
      specialty: 'Cardiologist',
      licenseNumber: 'MD002',
      email: 's.johnson@cardiospecialists.com',
      contactNumber: '(713) 555-1002',
      facilityId: facilities[4].id,
    },
    {
      firstName: 'Michael',
      lastName: 'Chen',
      specialty: 'Endocrinologist',
      licenseNumber: 'MD003',
      email: 'm.chen@sunshineclinic.com',
      contactNumber: '(213) 555-1003',
      facilityId: facilities[1].id,
    },
    {
      firstName: 'Emily',
      lastName: 'Williams',
      specialty: 'Nurse Practitioner',
      licenseNumber: 'NP001',
      email: 'e.williams@urgentcareplus.com',
      contactNumber: '(303) 555-1004',
      facilityId: facilities[6].id,
    },
    {
      firstName: 'David',
      lastName: 'Martinez',
      specialty: 'Pharmacist',
      licenseNumber: 'PH001',
      email: 'd.martinez@centralpharmacy.com',
      contactNumber: '(312) 555-1005',
      facilityId: facilities[2].id,
    },
  ];

  const providers = await Promise.all(
    providerData.map((p) =>
      prisma.provider.create({
        data: p,
      })
    )
  );

  console.log(`✓ Created ${providers.length} providers`);

  // Hash password
  const hashedPassword = bcrypt.hashSync('demo123', 10);

  // Create 5 patients with detailed medical records
  console.log('Creating patients...');

  const patients = await Promise.all([
    // Patient 1: Robert Anderson
    prisma.patient.create({
      data: {
        firstName: 'Robert',
        lastName: 'Anderson',
        email: 'robert.anderson@email.com',
        dateOfBirth: new Date('1965-03-15'),
        gender: 'Male',
        contactNumber: '(555) 001-1001',
        address: '123 Main St, New York, NY 10001',
        emergencyContact: 'Alice Anderson (Wife)',
      },
    }),
    // Patient 2: Jennifer Martinez
    prisma.patient.create({
      data: {
        firstName: 'Jennifer',
        lastName: 'Martinez',
        email: 'jennifer.martinez@email.com',
        dateOfBirth: new Date('1978-07-22'),
        gender: 'Female',
        contactNumber: '(555) 002-2002',
        address: '456 Oak Ave, Los Angeles, CA 90001',
        emergencyContact: 'Carlos Martinez (Brother)',
      },
    }),
    // Patient 3: David Thompson
    prisma.patient.create({
      data: {
        firstName: 'David',
        lastName: 'Thompson',
        email: 'david.thompson@email.com',
        dateOfBirth: new Date('1955-11-08'),
        gender: 'Male',
        contactNumber: '(555) 003-3003',
        address: '789 Elm St, Chicago, IL 60601',
        emergencyContact: 'Mary Thompson (Daughter)',
      },
    }),
    // Patient 4: Lisa Chen
    prisma.patient.create({
      data: {
        firstName: 'Lisa',
        lastName: 'Chen',
        email: 'lisa.chen@email.com',
        dateOfBirth: new Date('1982-05-30'),
        gender: 'Female',
        contactNumber: '(555) 004-4004',
        address: '321 Maple Dr, Boston, MA 02101',
        emergencyContact: 'Wei Chen (Brother)',
      },
    }),
    // Patient 5: Marcus Johnson
    prisma.patient.create({
      data: {
        firstName: 'Marcus',
        lastName: 'Johnson',
        email: 'marcus.johnson@email.com',
        dateOfBirth: new Date('1972-09-12'),
        gender: 'Male',
        contactNumber: '(555) 005-5005',
        address: '654 Pine Rd, Houston, TX 77001',
        emergencyContact: 'Diana Johnson (Wife)',
      },
    }),
  ]);

  console.log(`✓ Created ${patients.length} patients`);

  // Create user accounts for patients
  console.log('Creating patient user accounts...');
  await Promise.all(
    patients.map((p, i) =>
      prisma.user.create({
        data: {
          email: p.email,
          password: hashedPassword,
          name: `${p.firstName} ${p.lastName}`,
          role: 'PATIENT',
          patientId: p.id,
        },
      })
    )
  );

  // Create user accounts for providers
  console.log('Creating provider user accounts...');
  await Promise.all(
    providers.map((p, i) =>
      prisma.user.create({
        data: {
          email: p.email,
          password: hashedPassword,
          name: `${p.firstName} ${p.lastName}`,
          role: 'DOCTOR',
          providerId: p.id,
        },
      })
    )
  );

  console.log('Creating medical records and medications...');

  // Medical records for Patient 1 (Robert Anderson - 58, Type 2 Diabetes + Hypertension)
  const robertRecords = await Promise.all([
    prisma.medicalRecord.create({
      data: {
        patientId: patients[0].id,
        providerId: providers[0].id,
        facilityId: facilities[0].id,
        recordType: 'Prescription',
        recordDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        description: 'Diabetes and hypertension management prescription',
        fileName: 'prescription_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[0].id,
        providerId: providers[1].id,
        facilityId: facilities[4].id,
        recordType: 'Lab Report',
        recordDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        description: 'HbA1c: 7.2%, Glucose: 145 mg/dL, Creatinine: 1.1 mg/dL',
        fileName: 'lab_report_2024_01.pdf',
      },
    }),
    // DUPLICATE: Same medication twice (simulating duplicate record)
    prisma.medicalRecord.create({
      data: {
        patientId: patients[0].id,
        providerId: providers[0].id,
        facilityId: facilities[0].id,
        recordType: 'Prescription',
        recordDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        description: 'Previous diabetes prescription (duplicate entry)',
        fileName: 'prescription_2023_12.pdf',
      },
    }),
    // MISSED FOLLOW-UP: Old appointment with no subsequent records
    prisma.medicalRecord.create({
      data: {
        patientId: patients[0].id,
        providerId: providers[0].id,
        facilityId: facilities[0].id,
        recordType: 'Note',
        recordDate: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
        description: 'Last visit 10 months ago - follow-up recommended',
        fileName: 'note_2023_05.pdf',
      },
    }),
  ]);

  // Medications for Robert
  await Promise.all([
    // Active medications
    prisma.medication.create({
      data: {
        patientId: patients[0].id,
        recordId: robertRecords[0].id,
        name: 'Metformin',
        dosage: '500mg',
        frequency: 'Twice daily',
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        indication: 'Type 2 Diabetes',
        prescribedBy: 'Dr. John Smith',
      },
    }),
    prisma.medication.create({
      data: {
        patientId: patients[0].id,
        recordId: robertRecords[0].id,
        name: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        startDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        indication: 'Hypertension',
        prescribedBy: 'Dr. Sarah Johnson',
      },
    }),
    // DUPLICATE: Metformin from old record
    prisma.medication.create({
      data: {
        patientId: patients[0].id,
        recordId: robertRecords[2].id,
        name: 'Metformin',
        dosage: '500mg',
        frequency: 'Twice daily',
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        indication: 'Type 2 Diabetes',
        prescribedBy: 'Dr. John Smith',
      },
    }),
    // CONFLICT: NSAIDs with ACE inhibitor
    prisma.medication.create({
      data: {
        patientId: patients[0].id,
        recordId: robertRecords[1].id,
        name: 'Ibuprofen',
        dosage: '400mg',
        frequency: 'As needed',
        startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        indication: 'Pain management',
        prescribedBy: 'Dr. John Smith',
      },
    }),
  ]);

  // Medical records for Patient 2 (Jennifer Martinez)
  const jenniferRecords = await Promise.all([
    prisma.medicalRecord.create({
      data: {
        patientId: patients[1].id,
        providerId: providers[2].id,
        facilityId: facilities[1].id,
        recordType: 'Prescription',
        recordDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        description: 'Thyroid replacement therapy',
        fileName: 'prescription_jennifer_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[1].id,
        providerId: providers[0].id,
        facilityId: facilities[0].id,
        recordType: 'Lab Report',
        recordDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        description: 'TSH: 2.1 mIU/L (normal), Glucose: 95 mg/dL',
        fileName: 'lab_jennifer_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[1].id,
        providerId: providers[2].id,
        facilityId: facilities[1].id,
        recordType: 'Discharge Summary',
        recordDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        description: 'Thyroid ultrasound: normal, nodule monitoring recommended',
        fileName: 'discharge_jennifer_2023_10.pdf',
      },
    }),
  ]);

  // Medications for Jennifer
  await Promise.all([
    prisma.medication.create({
      data: {
        patientId: patients[1].id,
        recordId: jenniferRecords[0].id,
        name: 'Levothyroxine',
        dosage: '75mcg',
        frequency: 'Once daily',
        startDate: new Date(Date.now() - 600 * 24 * 60 * 60 * 1000),
        indication: 'Hypothyroidism',
        prescribedBy: 'Dr. Michael Chen',
      },
    }),
    prisma.medication.create({
      data: {
        patientId: patients[1].id,
        recordId: jenniferRecords[0].id,
        name: 'Prenatal Vitamin',
        dosage: '1 tablet',
        frequency: 'Once daily',
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        indication: 'Pregnancy support',
        prescribedBy: 'OB/GYN',
      },
    }),
  ]);

  // Medical records for Patient 3 (David Thompson - 69, post-op)
  const davidRecords = await Promise.all([
    prisma.medicalRecord.create({
      data: {
        patientId: patients[2].id,
        providerId: providers[0].id,
        facilityId: facilities[5].id,
        recordType: 'Discharge Summary',
        recordDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        description: 'Appendectomy - successful surgery, patient discharged in good condition',
        fileName: 'discharge_david_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[2].id,
        providerId: providers[0].id,
        facilityId: facilities[5].id,
        recordType: 'Prescription',
        recordDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        description: 'Post-operative antibiotics and pain management',
        fileName: 'prescription_david_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[2].id,
        providerId: providers[0].id,
        facilityId: facilities[0].id,
        recordType: 'Note',
        recordDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        description: 'Pre-operative clearance for appendectomy',
        fileName: 'note_david_2023_08.pdf',
      },
    }),
  ]);

  // Medications for David
  await Promise.all([
    prisma.medication.create({
      data: {
        patientId: patients[2].id,
        recordId: davidRecords[1].id,
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times daily',
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        indication: 'Post-operative infection prevention',
        prescribedBy: 'Dr. John Smith',
      },
    }),
    prisma.medication.create({
      data: {
        patientId: patients[2].id,
        recordId: davidRecords[1].id,
        name: 'Acetaminophen',
        dosage: '500mg',
        frequency: 'Every 6 hours as needed',
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        indication: 'Post-operative pain',
        prescribedBy: 'Dr. John Smith',
      },
    }),
  ]);

  // Medical records for Patient 4 (Lisa Chen - 42, hypertension management)
  const lisaRecords = await Promise.all([
    prisma.medicalRecord.create({
      data: {
        patientId: patients[3].id,
        providerId: providers[1].id,
        facilityId: facilities[4].id,
        recordType: 'Prescription',
        recordDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        description: 'Hypertension management - blood pressure control regimen',
        fileName: 'prescription_lisa_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[3].id,
        providerId: providers[1].id,
        facilityId: facilities[4].id,
        recordType: 'Lab Report',
        recordDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        description: 'BP: 128/82 mmHg, Lipid panel: normal, Potassium: 4.2 mEq/L',
        fileName: 'lab_lisa_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[3].id,
        providerId: providers[1].id,
        facilityId: facilities[4].id,
        recordType: 'Note',
        recordDate: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
        description: 'Cardiac risk assessment completed - low risk',
        fileName: 'note_lisa_2023_07.pdf',
      },
    }),
  ]);

  // Medications for Lisa
  await Promise.all([
    prisma.medication.create({
      data: {
        patientId: patients[3].id,
        recordId: lisaRecords[0].id,
        name: 'Amlodipine',
        dosage: '5mg',
        frequency: 'Once daily',
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        indication: 'Hypertension',
        prescribedBy: 'Dr. Sarah Johnson',
      },
    }),
    prisma.medication.create({
      data: {
        patientId: patients[3].id,
        recordId: lisaRecords[0].id,
        name: 'Atorvastatin',
        dosage: '20mg',
        frequency: 'Once daily at bedtime',
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        indication: 'Cholesterol management',
        prescribedBy: 'Dr. Sarah Johnson',
      },
    }),
  ]);

  // Medical records for Patient 5 (Marcus Johnson - 52, COPD + Asthma)
  const marcusRecords = await Promise.all([
    prisma.medicalRecord.create({
      data: {
        patientId: patients[4].id,
        providerId: providers[3].id,
        facilityId: facilities[6].id,
        recordType: 'Prescription',
        recordDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        description: 'Respiratory management - inhalers and bronchodilators',
        fileName: 'prescription_marcus_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[4].id,
        providerId: providers[3].id,
        facilityId: facilities[6].id,
        recordType: 'Lab Report',
        recordDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        description: 'Pulmonary function tests - FEV1: 65% predicted',
        fileName: 'lab_marcus_2024_01.pdf',
      },
    }),
    prisma.medicalRecord.create({
      data: {
        patientId: patients[4].id,
        providerId: providers[3].id,
        facilityId: facilities[6].id,
        recordType: 'Note',
        recordDate: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000),
        description: 'Exacerbation episode - admitted for 3 days',
        fileName: 'note_marcus_2023_06.pdf',
      },
    }),
  ]);

  // Medications for Marcus
  await Promise.all([
    prisma.medication.create({
      data: {
        patientId: patients[4].id,
        recordId: marcusRecords[0].id,
        name: 'Albuterol',
        dosage: 'Inhaler',
        frequency: 'As needed (2 puffs)',
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        indication: 'Asthma/COPD acute relief',
        prescribedBy: 'Dr. Emily Williams',
      },
    }),
    prisma.medication.create({
      data: {
        patientId: patients[4].id,
        recordId: marcusRecords[0].id,
        name: 'Fluticasone/Salmeterol',
        dosage: 'Inhaler (45/21 mcg)',
        frequency: 'Twice daily',
        startDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        indication: 'COPD maintenance',
        prescribedBy: 'Dr. Emily Williams',
      },
    }),
    prisma.medication.create({
      data: {
        patientId: patients[4].id,
        recordId: marcusRecords[0].id,
        name: 'Prednisone',
        dosage: '20mg',
        frequency: 'Once daily',
        startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        indication: 'Recent exacerbation management',
        prescribedBy: 'Dr. Emily Williams',
      },
    }),
  ]);

  console.log('Creating appointments...');

  // Create appointments
  await Promise.all([
    prisma.appointment.create({
      data: {
        patientId: patients[0].id,
        providerId: providers[0].id,
        facilityId: facilities[0].id,
        appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        appointmentTime: '10:00 AM',
        status: 'Scheduled',
        reason: 'Diabetes management follow-up',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[1].id,
        providerId: providers[2].id,
        facilityId: facilities[1].id,
        appointmentDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        appointmentTime: '2:00 PM',
        status: 'Scheduled',
        reason: 'Thyroid check-up',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[2].id,
        providerId: providers[0].id,
        facilityId: facilities[5].id,
        appointmentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        appointmentTime: '11:00 AM',
        status: 'Scheduled',
        reason: 'Post-operative wound check',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[3].id,
        providerId: providers[1].id,
        facilityId: facilities[4].id,
        appointmentDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        appointmentTime: '3:00 PM',
        status: 'Scheduled',
        reason: 'Cardiology follow-up',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[4].id,
        providerId: providers[3].id,
        facilityId: facilities[6].id,
        appointmentDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        appointmentTime: '9:00 AM',
        status: 'Scheduled',
        reason: 'Pulmonary follow-up',
      },
    }),
  ]);

  console.log('Creating reminders...');

  // Create reminders
  await Promise.all([
    prisma.reminder.create({
      data: {
        patientId: patients[0].id,
        reminderType: 'Medication',
        title: 'Take Metformin',
        description: 'Remember to take your Metformin 500mg twice daily with meals',
        dueDate: new Date(),
        status: 'Pending',
      },
    }),
    prisma.reminder.create({
      data: {
        patientId: patients[0].id,
        reminderType: 'FollowUp',
        title: 'Schedule 6-month follow-up',
        description: 'It has been 10 months since your last comprehensive check-up',
        dueDate: new Date(),
        status: 'Pending',
      },
    }),
    prisma.reminder.create({
      data: {
        patientId: patients[1].id,
        reminderType: 'Appointment',
        title: 'Upcoming appointment reminder',
        description: 'You have an appointment with Dr. Michael Chen in 3 days',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'Pending',
      },
    }),
  ]);

  console.log('\n✅ Database seeding completed successfully!\n');
  console.log('📋 Demo Accounts Created:');
  console.log('\nPatient Accounts:');
  patients.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.firstName} ${p.lastName} - ${p.email} (password: demo123)`);
  });
  console.log('\nDoctor Accounts:');
  providers.forEach((p, i) => {
    console.log(`  ${i + 1}. Dr. ${p.firstName} ${p.lastName} - ${p.email} (password: demo123)`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
