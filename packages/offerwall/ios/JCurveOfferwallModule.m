//
//  JCurveOfferwallModule.m
//
//  JS bridge for the AdPopcorn SDK features that react-native-adpopcorn-reward 1.0.0 does not expose (iOS SDK 5.2.3).
//  Same method names and arguments as the Android module (JCurveOfferwallModule.java). A feature the iOS SDK does not
//  have rejects with E_UNSUPPORTED; any failure rejects with E_FAILED. JS treats every rejection as "fall back to the plain list".
//
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>
#import <AdPopcornOfferwall/AdPopcornOfferwall.h>
#import <AdPopcornOfferwall/AdPopcornCustomReward.h>
#import <AdPopcornOfferwall/AdPopcornCustomRewardCPM.h>
#import <AdPopcornOfferwall/AdPopcornRewardCustomNativeAd.h>

static UIWindow * _Nullable JCKeyWindow(void) {
  if (@available(iOS 13.0, *)) {
    for (UIScene *scene in [UIApplication sharedApplication].connectedScenes) {
      if (scene.activationState == UISceneActivationStateForegroundActive && [scene isKindOfClass:[UIWindowScene class]]) {
        for (UIWindow *window in ((UIWindowScene *)scene).windows) {
          if (window.isKeyWindow) return window;
        }
      }
    }
  }
  return [UIApplication sharedApplication].keyWindow;
}

static UIViewController * _Nullable JCTopViewController(void) {
  UIViewController *vc = JCKeyWindow().rootViewController;
  while (vc.presentedViewController && !vc.presentedViewController.isBeingDismissed) vc = vc.presentedViewController;
  return vc;
}

/// Settles a promise once; later calls (timeouts, duplicate SDK callbacks) are ignored.
@interface JCOnce : NSObject
@property (nonatomic, copy) RCTPromiseResolveBlock resolve;
@property (nonatomic, copy) RCTPromiseRejectBlock reject;
@property (nonatomic, assign) BOOL done;
+ (instancetype)withResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)resolveValue:(id)value;
- (void)rejectCode:(NSString *)code message:(NSString *)message;
@end

@implementation JCOnce
+ (instancetype)withResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  JCOnce *once = [JCOnce new];
  once.resolve = resolve;
  once.reject = reject;
  return once;
}
- (void)resolveValue:(id)value {
  if (self.done) return;
  self.done = YES;
  self.resolve(value);
}
- (void)rejectCode:(NSString *)code message:(NSString *)message {
  if (self.done) return;
  self.done = YES;
  self.reject(code, message, nil);
}
@end

/// Reads the given keys from an SDK model with KVC (a missing key is skipped, never thrown), renaming some.
static NSDictionary *JCDump(id model, NSArray<NSString *> *keys, NSDictionary<NSString *, NSString *> *rename) {
  NSMutableDictionary *out = [NSMutableDictionary dictionary];
  for (NSString *key in keys) {
    id value = nil;
    @try { value = [model valueForKey:key]; } @catch (NSException *e) { value = nil; }
    if (value == nil || value == [NSNull null]) continue;
    out[rename[key] ?: key] = value;
  }
  return out;
}

static NSArray *JCDumpList(NSArray *list, NSArray<NSString *> *keys, NSDictionary<NSString *, NSString *> *rename) {
  NSMutableArray *out = [NSMutableArray array];
  for (id model in list) [out addObject:JCDump(model, keys, rename)];
  return out;
}

static void JCAfter(NSTimeInterval seconds, dispatch_block_t block) {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(seconds * NSEC_PER_SEC)), dispatch_get_main_queue(), block);
}

@interface JCurveOfferwallModule : RCTEventEmitter <RCTBridgeModule, AdPopcornOfferwallDelegate, AdPopcornCustomRewardDelegate, AdPopcornCustomRewardCPMDelegate, AdPopcornRewardCustomNativeAdDelegate>
@property (nonatomic, strong) AdPopcornCustomReward *customReward;
@property (nonatomic, strong) AdPopcornCustomRewardCPM *customCpm;
@property (nonatomic, strong) AdPopcornRewardCustomNativeAd *customNativeAd;
@property (nonatomic, strong) JCOnce *detailOnce;
@property (nonatomic, strong) JCOnce *participateOnce;
@property (nonatomic, strong) JCOnce *earnableOnce;
@property (nonatomic, strong) JCOnce *bridgeOnce;
@property (nonatomic, strong) JCOnce *customOnce;
@property (nonatomic, strong) JCOnce *cpmOnce;
@property (nonatomic, strong) JCOnce *nativeOnce;
@property (nonatomic, weak) id previousDelegate;
@end

@implementation JCurveOfferwallModule

RCT_EXPORT_MODULE(JCurveOfferwallModule)

+ (BOOL)requiresMainQueueSetup { return YES; }
/// Every exported method runs on the main thread: the SDK wants view controllers and UIKit there.
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (NSArray<NSString *> *)supportedEvents { return @[@"JCurveOfferwallEvent"]; }

- (void)emitType:(NSString *)type body:(NSDictionary *)body {
  NSMutableDictionary *map = [(body ?: @{}) mutableCopy];
  map[@"type"] = type;
  @try { [self sendEventWithName:@"JCurveOfferwallEvent" body:map]; } @catch (NSException *e) { }
}

- (void)unsupported:(RCTPromiseRejectBlock)reject {
  reject(@"E_UNSUPPORTED", @"the iOS SDK does not provide this", nil);
}

#pragma mark - campaign detail / participation

/// Opens one campaign's detail page. YES = the SDK opened it, NO = nothing happened within 5 s.
RCT_EXPORT_METHOD(openCampaignDetail:(NSString *)campaignKey resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (campaignKey.length == 0) { resolve(@NO); return; }
  JCOnce *once = [JCOnce withResolve:resolve reject:reject];
  self.detailOnce = once;
  @try {
    [AdPopcornOfferwall openCampaignDetailViewController:JCTopViewController() campaignKey:campaignKey delegate:self];
  } @catch (NSException *e) {
    [once rejectCode:@"E_FAILED" message:e.reason ?: @"exception"];
    return;
  }
  JCAfter(5.0, ^{ [once resolveValue:@NO]; });
}

/// SDK-side participation attempt: { success, code, message, landingUrl }.
RCT_EXPORT_METHOD(tryParticipateCampaign:(NSString *)campaignKey resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  JCOnce *once = [JCOnce withResolve:resolve reject:reject];
  self.participateOnce = once;
  // The result only comes through the shared delegate: take it for now and give it back afterwards.
  if ([AdPopcornOfferwall shared].delegate != self) self.previousDelegate = [AdPopcornOfferwall shared].delegate;
  [AdPopcornOfferwall shared].delegate = self;
  @try {
    [AdPopcornOfferwall tryParticipateCampaign:campaignKey];
  } @catch (NSException *e) {
    [self restoreDelegate];
    [once rejectCode:@"E_FAILED" message:e.reason ?: @"exception"];
    return;
  }
  __weak JCurveOfferwallModule *weakSelf = self;
  JCAfter(10.0, ^{ [once resolveValue:[NSNull null]]; [weakSelf restoreDelegate]; });
}

- (void)restoreDelegate {
  if ([AdPopcornOfferwall shared].delegate == self) [AdPopcornOfferwall shared].delegate = self.previousDelegate;
  self.previousDelegate = nil;
}

#pragma mark - custom reward lists (our own UI)

/// Campaigns the SDK can open right now: [{ campaignKey, title, description, reward, iconImageURL, mainImageURL }].
RCT_EXPORT_METHOD(loadCustomCampaigns:(double)max resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  JCOnce *once = [JCOnce withResolve:resolve reject:reject];
  self.customOnce = once;
  @try {
    [self.customReward stopAd];
    self.customReward = [[AdPopcornCustomReward alloc] initWithViewController:JCTopViewController()];
    self.customReward.delegate = self;
    if (max > 0) [self.customReward setMaxCampaignCount:(int)max];
    [self.customReward loadAd];
  } @catch (NSException *e) {
    [once rejectCode:@"E_FAILED" message:e.reason ?: @"exception"];
    return;
  }
  JCAfter(10.0, ^{ [once resolveValue:@[]]; });
}

RCT_EXPORT_METHOD(clickCustomCampaign:(NSString *)campaignKey resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.customReward == nil) { resolve(@NO); return; }
  @try { [self.customReward clickCampaign:campaignKey]; } @catch (NSException *e) { reject(@"E_FAILED", e.reason ?: @"exception", nil); return; }
  resolve(@YES);
}

RCT_EXPORT_METHOD(destroyCustomCampaigns:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  @try { [self.customReward stopAd]; } @catch (NSException *e) { }
  self.customReward = nil;
  resolve(@YES);
}

/// Custom native ad of a placement configured in the AdPopcorn console.
RCT_EXPORT_METHOD(loadCustomNativeAds:(NSString *)placementId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  JCOnce *once = [JCOnce withResolve:resolve reject:reject];
  self.nativeOnce = once;
  @try {
    self.customNativeAd = [[AdPopcornRewardCustomNativeAd alloc] initWithViewController:JCTopViewController()];
    self.customNativeAd.delegate = self;
    [self.customNativeAd setPlacementId:placementId];
    [self.customNativeAd loadAd];
  } @catch (NSException *e) {
    [once rejectCode:@"E_FAILED" message:e.reason ?: @"exception"];
    return;
  }
  JCAfter(10.0, ^{ [once resolveValue:@[]]; });
}

RCT_EXPORT_METHOD(impressionCustomNativeAd:(NSString *)nativeCampaignId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.customNativeAd == nil) { resolve(@NO); return; }
  @try { [self.customNativeAd impressionCampaign:nativeCampaignId]; } @catch (NSException *e) { reject(@"E_FAILED", e.reason ?: @"exception", nil); return; }
  resolve(@YES);
}

RCT_EXPORT_METHOD(clickCustomNativeAd:(NSString *)nativeCampaignId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.customNativeAd == nil) { resolve(@NO); return; }
  @try { [self.customNativeAd clickCampaign:nativeCampaignId]; } @catch (NSException *e) { reject(@"E_FAILED", e.reason ?: @"exception", nil); return; }
  resolve(@YES);
}

RCT_EXPORT_METHOD(completeCustomNativeAd:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [self unsupported:reject];
}

/// CPM-type custom list: [{ id, title, description, condition, cta, reward, imageURL }].
RCT_EXPORT_METHOD(loadCustomCpm:(double)max resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  JCOnce *once = [JCOnce withResolve:resolve reject:reject];
  self.cpmOnce = once;
  @try {
    [self.customCpm stopAd];
    self.customCpm = [[AdPopcornCustomRewardCPM alloc] initWithViewController:JCTopViewController()];
    self.customCpm.delegate = self;
    if (max > 0) [self.customCpm setMaxCampaignCount:(int)max];
    [self.customCpm loadAd];
  } @catch (NSException *e) {
    [once rejectCode:@"E_FAILED" message:e.reason ?: @"exception"];
    return;
  }
  JCAfter(10.0, ^{ [once resolveValue:@[]]; });
}

RCT_EXPORT_METHOD(impressionCustomCpm:(NSString *)contentsId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.customCpm == nil) { resolve(@NO); return; }
  @try { [self.customCpm impressionCampaign:contentsId]; } @catch (NSException *e) { reject(@"E_FAILED", e.reason ?: @"exception", nil); return; }
  resolve(@YES);
}

RCT_EXPORT_METHOD(clickCustomCpm:(NSString *)contentsId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.customCpm == nil) { resolve(@NO); return; }
  @try { [self.customCpm clickCampaign:contentsId]; } @catch (NSException *e) { reject(@"E_FAILED", e.reason ?: @"exception", nil); return; }
  resolve(@YES);
}

#pragma mark - reward totals

/// { queryResult, totalCount, totalReward } for the earnable offerwall campaigns.
RCT_EXPORT_METHOD(getEarnableTotalRewardInfo:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  JCOnce *once = [JCOnce withResolve:resolve reject:reject];
  self.earnableOnce = once;
  @try { [AdPopcornOfferwall getEarnableTotalRewardInfo:self]; } @catch (NSException *e) { [once rejectCode:@"E_FAILED" message:e.reason ?: @"exception"]; return; }
  JCAfter(10.0, ^{ [once resolveValue:[NSNull null]]; });
}

/// { queryResult, totalCount, totalReward, bridgePlacementId } for one bridge placement.
RCT_EXPORT_METHOD(getBridgeTotalRewardInfo:(NSString *)bridgePlacementId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  JCOnce *once = [JCOnce withResolve:resolve reject:reject];
  self.bridgeOnce = once;
  @try { [AdPopcornOfferwall getBridgeTotalRewardInfo:bridgePlacementId delegate:self]; } @catch (NSException *e) { [once rejectCode:@"E_FAILED" message:e.reason ?: @"exception"]; return; }
  JCAfter(10.0, ^{ [once resolveValue:[NSNull null]]; });
}

#pragma mark - settings and small helpers

/// Offerwall (full screen) with a user filter dictionary from the AdPopcorn contract.
RCT_EXPORT_METHOD(openOfferwallWithFilter:(NSDictionary *)filters resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  // Keep the wrapper module as the SDK's delegate so its JS events (closed, completed) still arrive.
  id wrapper = [self.bridge moduleForName:@"RNAdPopcornRewardModule"];
  id delegate = wrapper ?: self;
  @try {
    [AdPopcornOfferwall shared].delegate = delegate;
    [AdPopcornOfferwall openOfferWallWithViewController:JCTopViewController() delegate:delegate userDataDictionaryForFilter:[filters mutableCopy]];
  } @catch (NSException *e) { reject(@"E_FAILED", e.reason ?: @"exception", nil); return; }
  resolve(@YES);
}

/// Closes an offerwall that is already open.
RCT_EXPORT_METHOD(closeOfferwall:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  @try { [AdPopcornOfferwall closeOfferwallViewController]; } @catch (NSException *e) { reject(@"E_FAILED", e.reason ?: @"exception", nil); return; }
  resolve(@YES);
}

RCT_EXPORT_METHOD(setUserAgreement:(BOOL)agreed resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [self unsupported:reject];
}

RCT_EXPORT_METHOD(useFlagShowWhenLocked:(BOOL)enabled resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [self unsupported:reject];
}

/// Puts text on the clipboard (the app has no clipboard module of its own).
RCT_EXPORT_METHOD(setClipboard:(NSString *)text resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [UIPasteboard generalPasteboard].string = text ?: @"";
  resolve(@YES);
}

/// What this build can do, so JS can tell a missing feature from a failure.
RCT_EXPORT_METHOD(getCapabilities:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@{
    @"platform": @"ios",
    @"sdk": @"5.2.3",
    @"bridge": @1,
    @"methods": @[
      @"openCampaignDetail", @"tryParticipateCampaign", @"loadCustomCampaigns", @"clickCustomCampaign", @"destroyCustomCampaigns",
      @"loadCustomNativeAds", @"impressionCustomNativeAd", @"clickCustomNativeAd",
      @"loadCustomCpm", @"impressionCustomCpm", @"clickCustomCpm", @"getEarnableTotalRewardInfo", @"getBridgeTotalRewardInfo",
      @"openOfferwallWithFilter", @"closeOfferwall", @"setClipboard", @"viewDetailCampaignKey"
    ],
  });
}

#pragma mark - SDK delegate callbacks

// AdPopcornOfferwallDelegate. Callbacks we do not use are passed on to the wrapper module while we hold the delegate.
- (void)onOpenCampaignDetailPage { [self.detailOnce resolveValue:@YES]; }
- (void)onCloseCampaignDetailPage { [self emitType:@"detailClosed" body:nil]; }

- (void)onParticipateResult:(BOOL)result resultCode:(NSInteger)resultCode resultMessage:(NSString *)resultMessage landingURL:(NSString *)landingURL {
  [self.participateOnce resolveValue:@{
    @"success": @(result), @"code": @(resultCode), @"message": resultMessage ?: @"", @"landingUrl": landingURL ?: @"",
  }];
  [self restoreDelegate];
}

- (void)offerwallTotalRewardInfo:(BOOL)queryResult totalCount:(NSInteger)count totalReward:(NSString *)reward {
  [self.earnableOnce resolveValue:@{@"queryResult": @(queryResult), @"totalCount": @(count), @"totalReward": reward ?: @""}];
}

- (void)bridgeTotalRewardInfo:(BOOL)queryResult totalCount:(NSInteger)count totalReward:(NSString *)reward bridgePlacementId:(NSString *)bridgePlacementId {
  [self.bridgeOnce resolveValue:@{@"queryResult": @(queryResult), @"totalCount": @(count), @"totalReward": reward ?: @"", @"bridgePlacementId": bridgePlacementId ?: @""}];
}

- (void)forwardToPrevious:(SEL)selector {
  id previous = self.previousDelegate;
  if (previous && previous != self && [previous respondsToSelector:selector]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    [previous performSelector:selector];
#pragma clang diagnostic pop
  }
}
- (void)willOpenOfferWall { [self forwardToPrevious:_cmd]; }
- (void)didOpenOfferWall { [self forwardToPrevious:_cmd]; }
- (void)willCloseOfferWall { [self forwardToPrevious:_cmd]; }
- (void)didCloseOfferWall { [self forwardToPrevious:_cmd]; }
- (void)onCompletedCampaign { [self forwardToPrevious:_cmd]; }
- (void)onCloseCampaignPage { [self forwardToPrevious:_cmd]; }

// AdPopcornCustomRewardDelegate
- (void)ApCustomRewardLoadSuccess:(NSMutableArray *)campaignList {
  [self.customOnce resolveValue:JCDumpList(campaignList, @[@"campaignKey", @"title", @"desc", @"iconImageURL", @"mainImageURL", @"reward"], @{@"desc": @"description"})];
}
- (void)ApCustomRewardLoadFailed:(NSInteger)errorCode {
  [self.customOnce rejectCode:@"E_LOAD_FAILED" message:[NSString stringWithFormat:@"code %ld", (long)errorCode]];
}

// AdPopcornCustomRewardCPMDelegate
- (void)ApCustomRewardCPMLoadSuccess:(NSMutableArray *)campaignList {
  [self.cpmOnce resolveValue:JCDumpList(campaignList, @[@"contentsId", @"title", @"desc", @"condition", @"cta", @"imageURL", @"reward"], @{@"contentsId": @"id", @"desc": @"description"})];
}
- (void)ApCustomRewardCPMLoadFailed:(NSInteger)errorCode {
  [self.cpmOnce rejectCode:@"E_LOAD_FAILED" message:[NSString stringWithFormat:@"code %ld", (long)errorCode]];
}
- (void)ApCustomRewardCPMClickSuccess { [self emitType:@"customCpmClickSuccess" body:nil]; }
- (void)ApCustomRewardCPMClickFailed:(NSInteger)errorCode { [self emitType:@"customCpmClickFailed" body:@{@"code": @(errorCode)}]; }
- (void)ApCustomRewardCPMCompleted { [self emitType:@"customCpmCompleted" body:nil]; }

// AdPopcornRewardCustomNativeAdDelegate
- (void)ApCustomNativeLoadSuccess:(NSMutableArray *)campaignList {
  [self.nativeOnce resolveValue:JCDumpList(campaignList, @[@"nativeCampaignId", @"title", @"desc", @"iconImageURL", @"mainImageURL", @"reward", @"cta"], @{@"desc": @"description"})];
}
- (void)ApCustomNativeLoadFailed:(NSInteger)errorCode {
  [self.nativeOnce rejectCode:@"E_LOAD_FAILED" message:[NSString stringWithFormat:@"code %ld", (long)errorCode]];
}
- (void)ApCustomNativeClickSuccess { [self emitType:@"customNativeClickSuccess" body:nil]; }
- (void)ApCustomNativeFailedEvent:(NSInteger)errorCode { [self emitType:@"customNativeFailed" body:@{@"code": @(errorCode)}]; }
- (void)ApCustomNativeCompleted { [self emitType:@"customNativeCompleted" body:nil]; }

@end
