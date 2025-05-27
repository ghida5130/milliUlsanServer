# MilliUlsan Server

<div>
  <!-- nodejs -->
  <img src="https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white">
  <!-- express -->
  <img src="https://img.shields.io/badge/express-000000?style=for-the-badge&logo=express&logoColor=white">
</div>

## 배포 링크
- https://milliulsan.shop/api/
<br><br>

## 간단 소개

- Express.js로 개발되었으며 AWS EC2로 운영 중인 BFF 서버입니다.
- 클라이언트에서 사용할 외부 API 데이터를 전처리해 JSON 형태로 제공합니다.
- GET 요청의 URL 쿼리 문자열을 통해 데이터를 필터링하여 제공합니다.
- 공공데이터 등의 데이터 갱신 시점에 맞춰 서버에 캐싱된 데이터를 함께 갱신하고 최신 데이터를 클라이언트로 제공합니다.
