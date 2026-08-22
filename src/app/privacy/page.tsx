import { LegalNoticePage } from "@/features/legal/legal-notice-page";

export default function PrivacyPage() {
  return (
    <LegalNoticePage
      title="개인정보 처리방침"
      summary="서비스 제공에 필요한 최소한의 정보만 처리하고, 다른 이용자에게 보여 주는 범위를 분명히 합니다."
      sections={[
        {
          title: "처리하는 정보",
          body: "카카오 계정 식별 정보와 표시명, 닉네임, 테니스 프로필, 활동 지역, 매칭·신청 정보를 서비스 제공에 필요한 범위에서 처리합니다.",
        },
        {
          title: "이용 목적",
          body: "로그인, 프로필 설정, 비슷한 매칭 추천, 신청·수락 처리, 서비스 안정성 확인에 사용합니다. 전화번호와 이메일은 다른 이용자에게 공개하지 않습니다.",
        },
        {
          title: "다른 이용자에게 보이는 정보",
          body: "닉네임과 매칭에 필요한 프로필·일정·코트 정보만 상대에게 보여 줍니다. 카카오 오픈채팅 링크는 모집자와 수락된 참가자에게만 보여 줍니다.",
        },
      ]}
      notice="현재는 비공개 MVP입니다. 보관 기간·파기 절차·개인정보 보호책임자와 문의 채널은 정식 공개 전 운영 안내에 추가합니다."
    />
  );
}
