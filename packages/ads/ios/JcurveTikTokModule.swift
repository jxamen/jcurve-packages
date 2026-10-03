import ExpoModulesCore
import TikTokBusinessSDK

/**
 * 틱톡 비즈니스 SDK 를 JS 에 잇는 얇은 다리 — 판단은 전부 JS(`src/tiktok.ts`)에서 한다(당근캐시 TikTokBusinessModule 에서 옮김).
 *
 * ATT 창은 여기서 띄우지 않는다. SDK 1.7 은 스스로 묻지 않고, 보낼 때 그때의 허용 상태를 읽는다
 * — JS 가 앱을 켤 때 묻는 ATT 의 답을 기다린 뒤 initialize 를 부른다.
 */
public class JcurveTikTokModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JcurveTikTok")

    /// 처음 한 번만 된다. 디버그면 테스트 이벤트 코드를 돌려준다(이벤트 관리자 › 테스트 이벤트에 넣는 값).
    AsyncFunction("initialize") { (accessToken: String, appId: String, tiktokAppId: String, debug: Bool, promise: Promise) in
      if TikTokBusiness.isInitialized() {
        promise.resolve(TikTokBusiness.getTestEventCode())
        return
      }
      guard let config = TikTokConfig(accessToken: accessToken, appId: appId, tiktokAppId: tiktokAppId) else {
        promise.reject("E_TIKTOK_CONFIG", "TikTokConfig 를 만들지 못했어요")
        return
      }
      if debug {
        config.enableDebugMode()
        config.setLogLevel(TikTokLogLevelDebug)
      }
      TikTokBusiness.initializeSdk(config) { success, error in
        if success {
          promise.resolve(TikTokBusiness.getTestEventCode())
        } else {
          promise.reject("E_TIKTOK_INIT", error?.localizedDescription ?? "초기화 실패")
        }
      }
    }.runOnQueue(.main)

    /// 표준 이벤트는 플랫폼마다 글자가 달라서(iOS InAppADImpr · 안드 InAppAdImpr) 짧은 이름으로 받아 여기서 고른다.
    Function("trackStandard") { (key: String) in
      guard TikTokBusiness.isInitialized() else { return }
      let name: TTEventName
      switch key {
      case "ad_impression": name = .inAppADImpr
      case "registration": name = .registration
      case "login": name = .login
      default: return
      }
      TikTokBusiness.trackTTEvent(TikTokBaseEvent(eventName: name.rawValue))
    }

    Function("trackCustom") { (name: String, properties: [String: Any]?) in
      guard TikTokBusiness.isInitialized() else { return }
      let event = TikTokBaseEvent(eventName: name)
      if let properties = properties {
        event.properties = properties
      }
      TikTokBusiness.trackTTEvent(event)
    }

    Function("identify") { (externalId: String, userName: String?, phone: String?, email: String?) in
      guard TikTokBusiness.isInitialized() else { return }
      TikTokBusiness.identify(withExternalID: externalId, externalUserName: userName, phoneNumber: phone, email: email)
    }

    Function("logout") {
      guard TikTokBusiness.isInitialized() else { return }
      TikTokBusiness.logout()
    }

    Function("updateAccessToken") { (accessToken: String) in
      guard TikTokBusiness.isInitialized() else { return }
      TikTokBusiness.updateAccessToken(accessToken)
    }
  }
}
