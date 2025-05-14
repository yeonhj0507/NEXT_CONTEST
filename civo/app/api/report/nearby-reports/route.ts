// app/api/report/nearby-reports/route.ts

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");

  if (!lat || !lng) {
    return NextResponse.json({ error: "위도/경도 누락" }, { status: 400 });
  }

  console.log(`📍 클릭된 위치: lat=${lat}, lng=${lng}`);

  let radius = 100;
  const step = 100;
  const maxRadius = 30000;
  let found = [];

  while (radius <= maxRadius) {
    console.log(`🔍 반경 ${radius}m로 검색 시도 중...`);
  
    const { data, error } = await supabase.rpc("get_reports_within_radius", {
      lat_input: lat,
      lng_input: lng,
      radius_m: radius,
    });
  
    if (error) {
      console.error("🚨 RPC 오류:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  
    console.log(`📦 반경 ${radius}m 내 데이터 개수: ${data.length}`);
  
    // 조건 만족하면 종료
    if (data.length >= 20) {
      console.log(`✅ 목표 충족: ${data.length}개 확보, 반경 ${radius}m에서 멈춤`);
      found = data;
      break;
    }
  
    // 조건 부족할 경우 다음 반경으로
    found = data;
    radius += step;
  
    console.log(`↗️ 반경 증가: 다음 검색 반경은 ${radius}m`);
  }

  // 📌 좌표 필드 일관화: lat/lng 필드 추가
  const result = found
    .map((item: any) => {
      const lat = item.type === "missing" ? item.missing_lat : item.report_lat;
      const lng = item.type === "missing" ? item.missing_lng : item.report_lng;

      return {
        ...item,
        lat,
        lng,
      };
    })
    .sort((a: { distance_m: number; }, b: { distance_m: number; }) => a.distance_m - b.distance_m);

  console.log("✅ 최종 반환 데이터 개수:", result.length);

  result.forEach((item: any, i: number) => {
    console.log(
      `🧾 [${i + 1}] ${item.title || "제목 없음"} | ${item.type} | 📍 (${item.lat}, ${item.lng}) | 📏 거리: ${item.distance_m.toFixed(1)}m`
    );
  });

  return NextResponse.json(result);
}
