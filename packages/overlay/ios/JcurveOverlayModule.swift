import ExpoModulesCore

public class JcurveOverlayModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JcurveOverlay")

    Function("hasPermission") { () -> Bool in
      return false // iOS does not have overlay concept
    }

    Function("requestPermission") { () -> Void in
      // No-op
    }

    AsyncFunction("show") { (params: [String: Any], promise: Promise) -> Void in
      promise.resolve(false) // Not supported on iOS
    }

    Function("hide") { () -> Void in
      // No-op
    }
  }
}
