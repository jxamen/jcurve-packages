# 틱톡 SDK 의 인앱 결제 자동 추적(com.tiktok.iap.billing.*)은 Play 결제 라이브러리를 compileOnly 로만 쓴다.
# SDK 의 proguard.txt 가 `-keep class com.android.billingclient.api.* { *; }` 를 거는데, 앱에 인앱 결제가 없으면
# 그 라이브러리가 없어 R8(AGP 8 은 없는 클래스를 오류로 본다)이 「Missing class com.android.billingclient...」로 멈춘다.
# 결제 라이브러리를 넣으면 BILLING 권한이 매니페스트에 합쳐지므로, 넣지 않고 경고만 끈다. 자동 추적은 모듈에서 끈다.
-dontwarn com.android.billingclient.**
