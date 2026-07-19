import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { api } from '../lib/api';

interface ExtractedData {
  medications: Array<{ name: string; dosage?: string; frequency?: string; indication?: string; prescribedBy?: string; startDate?: string }>;
  allergies: string[];
  diagnoses: string[];
  encounters: Array<{ date?: string; type: string; description: string }>;
  notes: string[];
  vitalSigns?: Record<string, string>;
}

interface PatientData { id: string; firstName: string; lastName: string; }

export default function UploadPage() {
  const router = useRouter();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('Prescription');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityDuration, setActivityDuration] = useState<number | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionResponse = await api.getSession();
        const user = sessionResponse.data.user;
        if (user.role !== 'PATIENT') { router.push('/login'); return; }
        setPatient(user.patient);
        setError(null);
      } catch (err: any) {
        setError('Failed to load session');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [router]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setSelectedFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !patient) { setError('Please select a file'); return; }
    setUploading(true);
    setError(null);
    setExtractedData(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('patientId', patient.id);
      formData.append('recordType', fileType);
      const response = await api.uploadMedicalRecord(formData);
      if (response.data) {
        setExtractedData(response.data.extractedData);
        if (response.data.agentActivityId) {
          try {
            const activityResponse = await api.getActivityDetail(response.data.agentActivityId);
            if (activityResponse.data.duration) setActivityDuration(activityResponse.data.duration);
          } catch {}
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData || !patient) { setError('No data to save'); return; }
    try {
      setUploading(true);
      setError(null);
      await api.createRecord({
        patientId: patient.id, recordType: fileType, recordDate: new Date().toISOString(),
        description: extractedData.notes?.join('; ') || 'Uploaded medical record',
        fileName: selectedFile?.name || 'unknown.pdf', extractedData, medications: extractedData.medications,
      });
      router.push('/timeline');
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout patientName={patient ? `${patient.firstName} ${patient.lastName}` : ''} patientId={patient?.id}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-navy-900 tracking-tight">Upload Medical Records</h1>
          <p className="text-navy-500 mt-1">
            Upload PDF, TXT, or image files. Our AI will automatically extract and organize the information.
          </p>
        </div>

        {error && (
          <div className="bg-red-50/80 backdrop-blur border border-red-200/50 rounded-xl p-4 animate-slide-down">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card-blur p-6 animate-slide-up">
              <label className="block text-sm font-semibold text-navy-700 mb-2">Record Type</label>
              <select value={fileType} onChange={(e) => setFileType(e.target.value)} className="input-solid">
                <option value="Prescription">Prescription</option>
                <option value="Lab Report">Lab Report</option>
                <option value="Discharge Summary">Discharge Summary</option>
                <option value="Imaging">Imaging Report</option>
                <option value="Encounter">Encounter Note</option>
              </select>
            </div>

            <div
              ref={dropZoneRef}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`card-blur border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${
                dragActive
                  ? 'border-brand-500 bg-brand-50/50 scale-[1.02]'
                  : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-navy-200 hover:border-navy-300 hover:bg-navy-50/30'
              }`}
            >
              {selectedFile ? (
                <div className="animate-scale-in">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-navy-900">{selectedFile.name}</p>
                  <p className="text-xs text-navy-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button type="button" onClick={() => setSelectedFile(null)} className="text-xs text-brand-600 hover:text-brand-700 mt-3 font-semibold underline">
                    Choose different file
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-navy-900 font-semibold mb-1">Drag and drop your file here</p>
                  <p className="text-sm text-navy-400 mb-4">or click to browse</p>
                  <p className="text-xs text-navy-300 mb-4">Supported: PDF, TXT, JPG, PNG (max 10MB)</p>
                  <input type="file" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} className="hidden" id="fileInput" accept=".pdf,.txt,.jpg,.jpeg,.png" />
                  <label htmlFor="fileInput" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl text-sm font-semibold hover:from-brand-700 hover:to-brand-800 cursor-pointer transition-all duration-200 shadow-brand hover:shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Select File
                  </label>
                </>
              )}
            </div>

            {selectedFile && !extractedData && (
              <button onClick={handleUpload} disabled={uploading}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-brand disabled:opacity-50 flex items-center justify-center gap-2">
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Process with AI
                  </>
                )}
              </button>
            )}

            {extractedData && (
              <div className="space-y-6 animate-slide-up">
                {activityDuration && (
                  <div className="card-blur bg-brand-50/50 p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-navy-700">
                      <strong>Intake Agent</strong> processed in <strong>{(activityDuration / 1000).toFixed(2)}</strong> seconds
                    </p>
                  </div>
                )}

                {extractedData.medications?.length > 0 && (
                  <div className="card-blur p-6">
                    <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      Medications
                    </h3>
                    <div className="space-y-3">
                      {extractedData.medications.map((med, idx) => (
                        <div key={idx} className="border-l-4 border-brand-400 pl-4 py-2">
                          <p className="font-semibold text-navy-900">{med.name}</p>
                          {med.dosage && <p className="text-sm text-navy-600">Dosage: {med.dosage}</p>}
                          {med.frequency && <p className="text-sm text-navy-600">Frequency: {med.frequency}</p>}
                          {med.indication && <p className="text-sm text-navy-500">For: {med.indication}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {extractedData.allergies?.length > 0 && (
                  <div className="card-blur p-6">
                    <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      Allergies
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {extractedData.allergies.map((allergy, idx) => (
                        <span key={idx} className="badge-danger">{allergy}</span>
                      ))}
                    </div>
                  </div>
                )}

                {extractedData.diagnoses?.length > 0 && (
                  <div className="card-blur p-6">
                    <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      Diagnoses
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {extractedData.diagnoses.map((diag, idx) => (
                        <span key={idx} className="badge-brand">{diag}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleSave} disabled={uploading}
                    className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                    {uploading ? 'Saving...' : 'Save to Timeline'}
                  </button>
                  <button onClick={() => { setExtractedData(null); setSelectedFile(null); setActivityDuration(null); }}
                    className="flex-1 py-3.5 bg-navy-100 text-navy-700 rounded-xl font-semibold hover:bg-navy-200 transition-all duration-200">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card-blur bg-gradient-to-br from-brand-50/50 to-medical-50/50 p-6 animate-slide-up">
              <h3 className="font-semibold text-navy-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tips
              </h3>
              <ul className="space-y-2 text-xs text-navy-600">
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Upload clear, legible documents</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Select the correct document type</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Our AI will extract key information</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Review extracted data before saving</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> All uploads are confidential</li>
              </ul>
            </div>

            <div className="card-blur bg-gradient-to-br from-blue-50/50 to-cyan-50/50 p-6 animate-slide-up">
              <h3 className="font-semibold text-navy-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                File Types
              </h3>
              <ul className="space-y-2 text-xs text-navy-600">
                <li><strong>Prescription:</strong> Medication details</li>
                <li><strong>Lab Report:</strong> Test results & values</li>
                <li><strong>Discharge:</strong> Hospital summaries</li>
                <li><strong>Imaging:</strong> Scan reports</li>
                <li><strong>Encounter:</strong> Visit notes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
