import path from 'node:path';
import { NextResponse } from 'next/server';
import { loadAllContent } from '@/content-loader/load';

export const dynamic = 'force-static';

export async function GET() {
  const content = await loadAllContent(path.resolve(process.cwd(), 'content'));
  return NextResponse.json(content);
}
