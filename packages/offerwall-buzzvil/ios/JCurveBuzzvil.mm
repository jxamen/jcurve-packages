#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
@import BuzzvilSDK;
@interface JCurveBuzzvil : NSObject <RCTBridgeModule>
@property(nonatomic, copy) NSString *initializedApp;
@property(nonatomic) NSInteger generation;
@property(nonatomic, strong) BuzzBenefitHub *hub;
@end
@implementation JCurveBuzzvil
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
RCT_EXPORT_METHOD(reset) {
  self.generation++;
  if (self.initializedApp) [[BuzzBenefit sharedInstance] logout];
}
RCT_EXPORT_METHOD(open:(NSString *)appId usn:(NSString *)usn resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  UIViewController *presenter = RCTPresentedViewController();
  if (!presenter || appId.length == 0 || usn.length != 64) { reject(@"NOT_READY", @"Not ready", nil); return; }
  if (self.initializedApp && ![self.initializedApp isEqualToString:appId]) { reject(@"RESTART_REQUIRED", @"App ID changed; restart app", nil); return; }
  NSInteger current = ++self.generation;
  @try {
    if (!self.initializedApp) {
      BuzzBenefitConfig *config = [BuzzBenefitConfig configWith:^(BuzzBenefitConfigBuilder *builder) { builder.appId = appId; }];
      [[BuzzBenefit sharedInstance] initializeWith:config];
      self.initializedApp = appId;
    }
    BuzzBenefitUser *user = [BuzzBenefitUser userWith:^(BuzzBenefitUserBuilder *builder) { builder.userId = usn; }];
    [[BuzzBenefit sharedInstance] loginWith:user onSuccess:^{
      dispatch_async(dispatch_get_main_queue(), ^{
        if (current != self.generation) { reject(@"CANCELLED", @"Session changed", nil); return; }
        UIViewController *top = RCTPresentedViewController();
        if (!top) { reject(@"NOT_READY", @"No presenter", nil); return; }
        self.hub = [[BuzzBenefitHub alloc] init];
        [self.hub showOn:top];
        resolve(nil);
      });
    } onFailure:^(NSError *error) { reject(@"SDK_ERROR", @"Login failed", nil); }];
  } @catch (NSException *exception) { reject(@"SDK_ERROR", @"SDK unavailable", nil); }
}
@end
