package kr.co.jcurve.offerwall
import com.facebook.react.bridge.*
import com.buzzvil.buzzbenefit.BuzzBenefitConfig
import com.buzzvil.buzzbenefit.benefithub.BuzzBenefitHub
import com.buzzvil.sdk.BuzzvilSdk
import com.buzzvil.sdk.BuzzvilSdkUser
import com.buzzvil.sdk.BuzzvilSdkLoginListener
class JCurveBuzzvilModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var initializedApp: String? = null
  private var generation = 0
  override fun getName() = "JCurveBuzzvil"
  @ReactMethod fun reset() { UiThreadUtil.runOnUiThread { generation++; if (initializedApp != null) BuzzvilSdk.logout() } }
  @ReactMethod fun open(appId: String, usn: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val activity = context.currentActivity
      if (activity == null || appId.isBlank() || !usn.matches(Regex("[a-f0-9]{64}"))) { promise.reject("NOT_READY", "Not ready"); return@runOnUiThread }
      if (initializedApp != null && initializedApp != appId) { promise.reject("RESTART_REQUIRED", "App ID changed; restart app"); return@runOnUiThread }
      val current = ++generation
      try {
        if (initializedApp == null) {
          BuzzvilSdk.initialize(application = activity.application, buzzBenefitConfig = BuzzBenefitConfig.Builder(appId).build())
          initializedApp = appId
        }
        BuzzvilSdk.login(buzzvilSdkUser = BuzzvilSdkUser(userId = usn), listener = object : BuzzvilSdkLoginListener {
          override fun onSuccess() { UiThreadUtil.runOnUiThread {
            if (current != generation || activity.isFinishing || activity.isDestroyed) { promise.reject("CANCELLED", "Session changed") }
            else { try { BuzzBenefitHub.show(activity); promise.resolve(null) } catch (_: Exception) { promise.reject("SDK_ERROR", "Presentation failed") } }
          } }
          override fun onFailure(errorType: BuzzvilSdkLoginListener.ErrorType) { promise.reject("SDK_ERROR", "Login failed") }
        })
      } catch (_: Exception) { promise.reject("SDK_ERROR", "SDK unavailable") }
    }
  }
}
