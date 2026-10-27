//
//  JCurveOfferwallWebTap.h  (0.4.0)
//
//  Lets the app *watch* AdPopcorn's own offerwall page inside the SDK's web view: a user script (given by JS, see src/webTap.ts) is added to the
//  web views created while the tap is on, and what it posts is handed to `onMessage`. Nothing is read or sent by this class itself; the script keeps
//  to a short whitelist of campaign fields and drops the campaign `Auth` token, `getParameter` (app key / member / advertising id) and every event body.
//
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^JCWebTapMessageBlock)(NSString *json);

@interface JCurveOfferwallWebTap : NSObject

+ (instancetype)shared;

/// YES while the tap is on (a script was given and `enabled` was YES).
@property (atomic, readonly) BOOL enabled;
/// Called on the main thread with each message the script posted (a JSON string, at most ~1.5 MB). Set by the module.
@property (atomic, copy, nullable) JCWebTapMessageBlock onMessage;

/// Turns the tap on or off. Only web views created *after* this call are affected (the script is added when a web view is made, before its first
/// page loads). Returns NO when `enabled` but the script, handler name or host pattern is missing or invalid.
- (BOOL)configureEnabled:(BOOL)enabled script:(nullable NSString *)script handler:(nullable NSString *)handler hostPattern:(nullable NSString *)hostPattern;

/// Is this host one the tap acts on (the offerwall page's)? Used by the message handler; exposed for the module's checks.
- (BOOL)hostAllowed:(nullable NSString *)host;

@end

NS_ASSUME_NONNULL_END
