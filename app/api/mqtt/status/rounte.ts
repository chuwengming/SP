import { NextResponse } from 'next/server';
import { getMqttStatus } from '@/lib/mqtt';

export async function GET() {
  const connected = getMqttStatus();
  
  return NextResponse.json({ 
    connected,
    message: connected ? 'MQTT 已連線' : 'MQTT 未連線'
  });
}