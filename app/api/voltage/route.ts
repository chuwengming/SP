import { NextResponse } from 'next/server';
import { getVoltage, getMqttStatus } from '@/lib/mqtt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  // 這裡不再強求驗證物理連線狀態，因為傳入的 clientId 可能是邏輯身分 (identity)
  // 前端已經透過 /api/mqtt/status 自行確認了物理連線的存活，直接讀取並回傳快取值即可

  const voltage = getVoltage(clientId || undefined);

  // 移除硬編碼的 110V 回退，直接返回獲取到的原始值
  const finalVoltage = voltage;

  return NextResponse.json({
    voltage: finalVoltage,
    pin: 2, // 模擬值
    signal: 1 // 模擬值
  });
}
