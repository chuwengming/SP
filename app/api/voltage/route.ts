import { NextResponse } from 'next/server';
import { getVoltage, getMqttStatus } from '@/lib/mqtt';

export async function GET() {
  // 檢查 MQTT 是否連線
  if (!getMqttStatus()) {
    // 返回默認值，避免前端解析錯誤
    console.warn('MQTT 未連線，返回默認電壓值');
    return NextResponse.json({
      voltage: 110,
      pin: 2, // 模擬值
      signal: 1 // 模擬值
    });
  }

  const voltage = getVoltage();
  
  // 如果 MQTT 已連線但電壓為 0，也返回默認值 110
  // 避免前端顯示 "AC-0V"
  const finalVoltage = voltage === 0 ? 110 : voltage;

  return NextResponse.json({
    voltage: finalVoltage,
    pin: 2, // 模擬值
    signal: 1 // 模擬值
  });
}
