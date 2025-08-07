import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: 'us-east-1',
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const s3Key = formData.get('key') as string
    const metadataString = formData.get('metadata') as string

    if (!file || !s3Key || !metadataString) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const metadata = JSON.parse(metadataString)
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Upload to S3 with metadata as tags
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME || 'bedrock-kb-documents',
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.type,
      Metadata: {
        'original-filename': metadata.originalFilename,
        'document-title': metadata.title,
        'jurisdiction': metadata.jurisdiction,
        'document-type': metadata.documentType,
        'effective-date': metadata.effectiveDate || '',
        'regulation-section': metadata.regulationSection || '',
        'state': metadata.state || '',
        'uploaded-at': metadata.uploadedAt,
        'file-size': metadata.fileSize.toString(),
      },
      // Use object tags for better searchability in Bedrock Knowledge Base
      Tagging: [
        `jurisdiction=${metadata.jurisdiction}`,
        `document-type=${metadata.documentType}`,
        `effective-date=${metadata.effectiveDate || 'unknown'}`,
        metadata.state && `state=${metadata.state.toLowerCase().replace(/\s+/g, '-')}`,
        metadata.regulationSection && `regulation-section=${encodeURIComponent(metadata.regulationSection)}`,
      ].filter(Boolean).join('&'),
    })

    await s3Client.send(uploadCommand)

    // Log successful upload
    console.log(`Document uploaded successfully: ${s3Key}`, {
      title: metadata.title,
      jurisdiction: metadata.jurisdiction,
      state: metadata.state,
      documentType: metadata.documentType,
      fileSize: metadata.fileSize,
    })

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      s3Key,
      metadata,
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { 
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Optional: Handle GET requests to list uploaded documents
export async function GET() {
  try {
    // TODO: Implement listing documents with their metadata
    // This could query S3 and return organized document lists
    
    return NextResponse.json({
      message: 'Document listing not yet implemented',
      // federal: { regulations: [], addendums: [] },
      // states: { california: { implementation: [], guidance: [] } }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}