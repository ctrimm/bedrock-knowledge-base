'use client'

import { useState } from 'react'

interface DocumentMetadata {
  jurisdiction: 'federal' | 'state'
  state?: string
  documentType: 'regulations' | 'addendums' | 'implementation' | 'guidance'
  title: string
  effectiveDate: string
  regulationSection?: string
  description?: string
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia', 'Puerto Rico', 'US Virgin Islands',
  'American Samoa', 'Guam', 'Northern Mariana Islands'
]

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<DocumentMetadata>({
    jurisdiction: 'federal',
    documentType: 'regulations',
    title: '',
    effectiveDate: '',
    regulationSection: '',
    description: ''
  })
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Auto-populate title from filename if empty
      if (!metadata.title) {
        setMetadata(prev => ({
          ...prev,
          title: file.name.replace(/\.[^/.]+$/, '') // Remove file extension
        }))
      }
    }
  }

  const handleMetadataChange = (field: keyof DocumentMetadata, value: string) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value,
      // Reset state when jurisdiction changes to federal
      ...(field === 'jurisdiction' && value === 'federal' ? { state: undefined } : {})
    }))
  }

  const generateS3Key = (): string => {
    const { jurisdiction, state, documentType, title } = metadata
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${sanitizedTitle}-${timestamp}.pdf`

    if (jurisdiction === 'federal') {
      return `federal/${documentType}/${filename}`
    } else {
      const stateKey = state?.toLowerCase().replace(/\s+/g, '-') || 'unknown'
      return `states/${stateKey}/${documentType}/${filename}`
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !metadata.title.trim()) {
      setUploadStatus('Please select a file and provide a title')
      return
    }

    if (metadata.jurisdiction === 'state' && !metadata.state) {
      setUploadStatus('Please select a state for state-level documents')
      return
    }

    setUploading(true)
    setUploadStatus('Uploading document...')

    try {
      // Generate S3 key based on metadata
      const s3Key = generateS3Key()
      
      // Create FormData with file and metadata
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('key', s3Key)
      formData.append('metadata', JSON.stringify({
        ...metadata,
        uploadedAt: new Date().toISOString(),
        originalFilename: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type
      }))

      // TODO: Implement actual upload to S3
      // This would typically call a Lambda function or API endpoint
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        setUploadStatus('Document uploaded successfully!')
        setSelectedFile(null)
        setMetadata({
          jurisdiction: 'federal',
          documentType: 'regulations',
          title: '',
          effectiveDate: '',
          regulationSection: '',
          description: ''
        })
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      setUploadStatus('Upload failed: ' + (error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const getDocumentTypeOptions = () => {
    if (metadata.jurisdiction === 'federal') {
      return ['regulations', 'addendums']
    } else {
      return ['implementation', 'guidance']
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Upload Regulatory Document</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Document File:
        </label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        />
        {selectedFile && (
          <div style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>
            Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Jurisdiction:
          </label>
          <select
            value={metadata.jurisdiction}
            onChange={(e) => handleMetadataChange('jurisdiction', e.target.value)}
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
          >
            <option value="federal">Federal</option>
            <option value="state">State/Territory</option>
          </select>
        </div>

        {metadata.jurisdiction === 'state' && (
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              State/Territory:
            </label>
            <select
              value={metadata.state || ''}
              onChange={(e) => handleMetadataChange('state', e.target.value)}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
            >
              <option value="">Select State/Territory</option>
              {US_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Document Type:
          </label>
          <select
            value={metadata.documentType}
            onChange={(e) => handleMetadataChange('documentType', e.target.value as any)}
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
          >
            {getDocumentTypeOptions().map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Effective Date:
          </label>
          <input
            type="date"
            value={metadata.effectiveDate}
            onChange={(e) => handleMetadataChange('effectiveDate', e.target.value)}
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Document Title: *
        </label>
        <input
          type="text"
          value={metadata.title}
          onChange={(e) => handleMetadataChange('title', e.target.value)}
          placeholder="e.g., GDPR Implementation Guidelines"
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
          required
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Regulation Section (Optional):
        </label>
        <input
          type="text"
          value={metadata.regulationSection || ''}
          onChange={(e) => handleMetadataChange('regulationSection', e.target.value)}
          placeholder="e.g., Section 3.2.1, Article 25, Chapter 4"
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Description (Optional):
        </label>
        <textarea
          value={metadata.description || ''}
          onChange={(e) => handleMetadataChange('description', e.target.value)}
          placeholder="Brief description of the document content and purpose"
          rows={3}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', resize: 'vertical' }}
        />
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Upload Preview:</h3>
        <div style={{ fontSize: '14px', color: '#666' }}>
          <strong>S3 Path:</strong> {selectedFile ? generateS3Key() : 'Select a file first'}
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
          <strong>Full Path:</strong> s3://bedrock-kb-documents/{selectedFile ? generateS3Key() : 'select-file-first'}
        </div>
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading || !selectedFile || !metadata.title.trim()}
        style={{
          padding: '12px 24px',
          backgroundColor: uploading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          fontSize: '16px'
        }}
      >
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>

      {uploadStatus && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          borderRadius: '4px',
          backgroundColor: uploadStatus.includes('success') ? '#d4edda' : '#f8d7da',
          color: uploadStatus.includes('success') ? '#155724' : '#721c24',
          border: `1px solid ${uploadStatus.includes('success') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {uploadStatus}
        </div>
      )}
    </div>
  )
}