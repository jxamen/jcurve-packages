//
//  JCurveOfferwallWebTap.m  (0.4.0)
//
#import "JCurveOfferwallWebTap.h"
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

static NSString * const JCDefaultHandlerName = @"JCurveOfferwallTap";
static const NSUInteger JCMaxScriptLength = 120000;
static const NSUInteger JCMaxMessageLength = 1500000;
/// Marks a user content controller that already has our script and handler (a controller can be shared by several web views).
static const void *JCAttachedKey = &JCAttachedKey;

/// Receives what the injected script posts. Holds no reference back to anything but the shared tap.
@interface JCWebTapHandler : NSObject <WKScriptMessageHandler>
@end

@implementation JCWebTapHandler
- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
  JCurveOfferwallWebTap *tap = [JCurveOfferwallWebTap shared];
  if (!tap.enabled) return;
  // main frame of the AdPopcorn offerwall page only (the script checks the host too, this is the second check)
  if (!message.frameInfo.isMainFrame) return;
  if (![tap hostAllowed:message.webView.URL.host]) return;
  id body = message.body;
  if (![body isKindOfClass:[NSString class]]) return;
  NSString *json = (NSString *)body;
  if (json.length == 0 || json.length > JCMaxMessageLength) return;
  JCWebTapMessageBlock block = tap.onMessage;
  if (block) block(json);
}
@end

@interface JCurveOfferwallWebTap ()
@property (atomic, readwrite) BOOL enabled;
@property (nonatomic, copy, nullable) NSString *script;
@property (nonatomic, copy) NSString *handlerName;
@property (nonatomic, strong, nullable) NSRegularExpression *hostRegex;
@property (nonatomic, strong) JCWebTapHandler *handler;
- (void)attachToWebView:(WKWebView *)webView;
@end

/// Swapped with `-[WKWebView initWithFrame:configuration:]` the first time the tap is turned on.
@interface WKWebView (JCurveOfferwallWebTap)
- (instancetype)jc_initWithFrame:(CGRect)frame configuration:(WKWebViewConfiguration *)configuration;
@end

@implementation WKWebView (JCurveOfferwallWebTap)
- (instancetype)jc_initWithFrame:(CGRect)frame configuration:(WKWebViewConfiguration *)configuration {
  // after the swap this calls the original initializer
  WKWebView *view = [self jc_initWithFrame:frame configuration:configuration];
  @try { [[JCurveOfferwallWebTap shared] attachToWebView:view]; } @catch (NSException *exception) { }
  return view;
}
@end

@implementation JCurveOfferwallWebTap

+ (instancetype)shared {
  static JCurveOfferwallWebTap *instance;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    instance = [JCurveOfferwallWebTap new];
    instance.handlerName = JCDefaultHandlerName;
    instance.handler = [JCWebTapHandler new];
  });
  return instance;
}

+ (void)swizzleOnce {
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    Method original = class_getInstanceMethod([WKWebView class], @selector(initWithFrame:configuration:));
    Method replacement = class_getInstanceMethod([WKWebView class], @selector(jc_initWithFrame:configuration:));
    if (original && replacement) method_exchangeImplementations(original, replacement);
  });
}

- (BOOL)configureEnabled:(BOOL)enabled script:(NSString *)script handler:(NSString *)handler hostPattern:(NSString *)hostPattern {
  if (!enabled) {
    @synchronized (self) { self.enabled = NO; self.script = nil; }
    return YES;
  }
  if (script.length == 0 || script.length > JCMaxScriptLength || hostPattern.length == 0 || hostPattern.length > 200) return NO;
  NSString *name = handler.length > 0 ? handler : JCDefaultHandlerName;
  // a message handler name is a plain identifier
  if ([name rangeOfCharacterFromSet:[[NSCharacterSet alphanumericCharacterSet] invertedSet]].location != NSNotFound || name.length > 60) return NO;
  NSError *error = nil;
  NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:hostPattern options:NSRegularExpressionCaseInsensitive error:&error];
  if (!regex || error) return NO;
  @synchronized (self) {
    self.script = script;
    self.handlerName = name;
    self.hostRegex = regex;
    self.enabled = YES;
  }
  [JCurveOfferwallWebTap swizzleOnce];
  return YES;
}

- (BOOL)hostAllowed:(NSString *)host {
  NSRegularExpression *regex = self.hostRegex;
  if (!regex || host.length == 0 || host.length > 253) return NO;
  return [regex numberOfMatchesInString:host options:0 range:NSMakeRange(0, host.length)] > 0;
}

- (void)attachToWebView:(WKWebView *)webView {
  NSString *script;
  NSString *name;
  @synchronized (self) {
    if (!self.enabled || self.script.length == 0) return;
    script = self.script;
    name = self.handlerName;
  }
  WKUserContentController *controller = webView.configuration.userContentController;
  if (!controller || objc_getAssociatedObject(controller, JCAttachedKey)) return;
  objc_setAssociatedObject(controller, JCAttachedKey, @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  // before the page's first request: the list the page asks for at start is the one we want
  WKUserScript *userScript = [[WKUserScript alloc] initWithSource:script injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES];
  [controller addUserScript:userScript];
  @try { [controller addScriptMessageHandler:self.handler name:name]; } @catch (NSException *exception) { /* a handler of that name was already added */ }
}

@end
