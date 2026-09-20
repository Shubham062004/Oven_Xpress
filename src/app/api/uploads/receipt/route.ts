import { NextRequest, NextResponse } from 'next/server';
import { requireAuthentication } from '@/lib/auth/guards';
import { saveReceiptBuffer, validateReceiptFile } from '@/lib/storage/receipts';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthentication();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided or invalid file payload' },
        { status: 400 }
      );
    }

    const validation = validateReceiptFile(file.type, file.size, file.name);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await saveReceiptBuffer(buffer, file.type, file.name);

    return NextResponse.json({
      success: true,
      url: result.url,
      filename: result.filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('Error uploading receipt attachment:', error);
    const message = error instanceof Error ? error.message : 'File upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
