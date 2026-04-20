import { NextResponse } from 'next/server';
import { getPlugName, getMqttStatus } from '@/lib/mqtt';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  // 這裡不再強求驗證物理連線狀態，因為傳入的 clientId 可能是邏輯身分 (identity)
  // 前端已經透過 /api/mqtt/status 自行確認了物理連線的存活，直接讀取並回傳快取值即可

  const plugName = getPlugName(clientId || undefined);

  return NextResponse.json({
    plugName
  });
}