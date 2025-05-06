import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// ✅ 사용자 위치와 신고 위치 간의 거리(m)를 계산하는 유틸 함수
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 지구 반지름 (단위: 미터)
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 최종 거리 (미터)
}

// ✅ POST 요청으로 신고 등록 처리
export async function POST(request: Request) {
  const supabase = await createClient(); // Supabase DB 클라이언트 생성
  const body = await request.json();     // JSON 형태로 요청 body 파싱

  // ✅ 요청 body에서 값 추출
  const {
    user_id,
    type,   // 신고 유형: 'accident' | 'damage' | 'missing'
    title,  // 신고 제목
    content,    // 신고 내용
    category,  // 신고 카테고리 (선택적) 
    media_urls,   // 신고에 첨부된 미디어 URL 배열 (선택적)
    missing_name, // 실종자 이름 (실종 신고일 경우 필수)
    missing_age,  // 실종자 나이 (실종 신고일 경우 필수)
    missing_gender,       // 실종자 성별 (실종 신고일 경우 필수)
    user_lat,   // 사용자 위치 위도
    user_lng,   // 사용자 위치 경도
    report_lat,  // 신고 위치 위도  
    report_lng, // 신고 위치 경도
    missing_lat, // 실종자 위치 위도 (실종 신고일 경우 필수)
    missing_lng,  // 실종자 위치 경도 (실종 신고일 경우 필수)
  } = body;
  

  // ✅ 필수 입력값 유효성 검사
  if (
    !user_id || !type || !title || !content ||
    user_lat == null || user_lng == null || report_lat == null || report_lng == null
  ) {
    return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
  }

  // ✅ 사용자 위치와 신고 위치 간 거리 계산 (단위: 미터)
  const distance_m = getDistanceInMeters(user_lat, user_lng, report_lat, report_lng);

  // ✅ Supabase에 저장할 데이터 구성
  const reportData: any = {
    user_id,
    type,
    title,
    content,
    category: category || null,
    media_urls: media_urls || [],
    user_lat,
    user_lng,
    report_lat,
    report_lng,
    distance_m,            // 계산된 거리
    status: 'pending',     // 초기 상태는 '대기중'
  };

  // ✅ 실종자 제보의 경우, 추가 필드 저장
  if (type === 'missing') {
    reportData.missing_name = missing_name || null;
    reportData.missing_age = missing_age || null;
    reportData.missing_gender = missing_gender || null;
    reportData.missing_lat = missing_lat || null;
    reportData.missing_lng = missing_lng || null;
  }

  // ✅ Supabase의 'reports' 테이블에 삽입
  const { data, error } = await supabase
    .from('reports')
    .insert([reportData])
    .select(); // 삽입 후 저장된 데이터 반환

  // ✅ 오류 발생 시
  if (error) {
    console.error('제보 삽입 오류:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ✅ 성공 응답 반환
  return NextResponse.json({ message: '제보 등록 성공', data }, { status: 201 });
}

