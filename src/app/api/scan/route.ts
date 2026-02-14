import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Artifact, ScanResult } from '@/types/api';

// Mock employee data - in production this would come from a database
const EMPLOYEES = {
  'alice-chen-001': {
    name: 'Alice Chen',
    role: 'Risk Analyst',
    department: 'Credit Risk',
    artifactFolder: 'alice-chen'
  }
};

async function readArtifacts(employeeId: string): Promise<Artifact[]> {
  const employee = EMPLOYEES[employeeId as keyof typeof EMPLOYEES];
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  const artifactsDir = path.join(process.cwd(), 'public', 'artifacts', employee.artifactFolder);
  const artifacts: Artifact[] = [];

  try {
    const files = await fs.readdir(artifactsDir);

    for (const file of files) {
      const filePath = path.join(artifactsDir, file);
      const stat = await fs.stat(filePath);

      if (stat.isFile()) {
        const content = await fs.readFile(filePath, 'utf-8');
        const ext = path.extname(file).toLowerCase();

        let type: Artifact['type'] = 'markdown';
        if (ext === '.py') type = 'python';
        else if (ext === '.json') type = 'excel'; // JSON representation of Excel
        else if (ext === '.md') type = 'markdown';

        artifacts.push({
          id: `artifact-${file.replace(/\.[^/.]+$/, '')}`,
          name: file,
          type,
          path: `/artifacts/${employee.artifactFolder}/${file}`,
          content,
          lastModified: stat.mtime.toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error reading artifacts:', error);
    throw error;
  }

  return artifacts;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'employeeId is required' },
        { status: 400 }
      );
    }

    const employee = EMPLOYEES[employeeId as keyof typeof EMPLOYEES];
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Read all artifacts for this employee
    const artifacts = await readArtifacts(employeeId);

    // Return the scan result (gaps will be analyzed separately)
    const result: Partial<ScanResult> = {
      employeeId,
      employeeName: employee.name,
      scanDate: new Date().toISOString(),
      artifacts,
      summary: {
        totalArtifacts: artifacts.length,
        totalGaps: 0, // Will be populated after analysis
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0
      }
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan artifacts' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return list of available employees for scanning
  const employees = Object.entries(EMPLOYEES).map(([id, data]) => ({
    id,
    name: data.name,
    role: data.role,
    department: data.department
  }));

  return NextResponse.json({ employees });
}
