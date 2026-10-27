#import <React/RCTViewManager.h>
#import <React/RCTBridge.h>
#import <React/UIView+React.h>
#import <AdPopcornOfferwall/AdPopcornOfferwall.h>
#import <AdPopcornOfferwall/AdPopcornOfferwallViewController.h>

@interface JCurveOfferwallView : UIView <AdPopcornOfferwallViewTypeDelegate>
@property (nonatomic, copy) NSString *usn;
/// Optional: open this campaign's detail inside the list view (SDK detailPageCampaignKey). Unset = the list, as before.
@property (nonatomic, copy) NSString *detailCampaignKey;
@property (nonatomic, copy) RCTDirectEventBlock onLoaded;
/// 0.4.0: the SDK opened / closed the detail page inside this view (AdPopcornOfferwallViewTypeDelegate).
@property (nonatomic, copy) RCTDirectEventBlock onDetailOpened;
@property (nonatomic, copy) RCTDirectEventBlock onDetailClosed;
@property (nonatomic, weak) RCTBridge *bridge;
@property (nonatomic, strong) AdPopcornOfferwallViewController *offerwall;
@property (nonatomic, assign) CGSize lastSize;
@end

@implementation JCurveOfferwallView
- (void)setUsn:(NSString *)usn {
  if ([_usn isEqualToString:usn]) return;
  [self detach];
  _usn = [usn copy];
  [self setNeedsLayout];
}
- (void)setDetailCampaignKey:(NSString *)key {
  if (key == _detailCampaignKey || [key isEqualToString:_detailCampaignKey]) return;
  [self detach];
  _detailCampaignKey = [key copy];
  [self setNeedsLayout];
}
- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (!self.window) [self detach];
  else [self setNeedsLayout];
}
- (void)layoutSubviews {
  [super layoutSubviews];
  CGSize size = self.bounds.size;
  if (!self.window || size.width <= 0 || size.height <= 0 || self.usn.length != 64 || [self.usn rangeOfCharacterFromSet:[[NSCharacterSet characterSetWithCharactersInString:@"abcdef0123456789"] invertedSet]].location != NSNotFound) return;
  if (!self.offerwall) {
    UIViewController *parent = self.reactViewController;
    if (!parent) return;
    [AdPopcornOfferwall setUserId:self.usn];
    // Keep SDK completion/close events on the existing RN bridge; rewards stay server-side.
    id delegate = [self.bridge moduleForName:@"RNAdPopcornRewardModule"];
    [AdPopcornOfferwall shared].delegate = delegate;
    AdPopcornOfferwallViewController *vc = [AdPopcornOfferwallViewController new];
    // 0 = the SDK list page (the value its list presenter uses). 5 = a campaign's detail page (what the SDK's own openCampaignDetailViewController uses with
    // detailPageCampaignKey); with pageType 0 a detail key is ignored and only the list shows.
    vc.pageType = self.detailCampaignKey.length > 0 ? 5 : 0;
    [vc setViewMode:YES];
    [vc setViewModeWidthSize:size.width];
    [vc setViewModeHeightSize:size.height];
    vc.offerwallViewTypeDelegate = self;
    if (self.detailCampaignKey.length > 0) vc.detailPageCampaignKey = self.detailCampaignKey;
    self.offerwall = vc;
    self.lastSize = size;
    self.clipsToBounds = YES;
    [parent addChildViewController:vc];
    vc.view.frame = self.bounds;
    [vc beginAppearanceTransition:YES animated:NO];
    [self addSubview:vc.view];
    [vc didMoveToParentViewController:parent];
    [vc endAppearanceTransition];
  } else if (!CGSizeEqualToSize(self.lastSize, size)) {
    self.lastSize = size;
    [self.offerwall changeViewModeSize:size.width viewHeight:size.height];
    self.offerwall.view.frame = self.bounds;
  }
}
- (void)OnLoadedOfferwall {
  [self.offerwall setViewModeImpression];
  if (self.onLoaded) self.onLoaded(@{});
}
- (void)OnOpenedDetailPage { if (self.onDetailOpened) self.onDetailOpened(@{}); }
- (void)OnClosedDetailPage { if (self.onDetailClosed) self.onDetailClosed(@{}); }
- (void)detach {
  AdPopcornOfferwallViewController *vc = self.offerwall;
  if (!vc) return;
  vc.offerwallViewTypeDelegate = nil;
  [vc willMoveToParentViewController:nil];
  [vc beginAppearanceTransition:NO animated:NO];
  [vc.view removeFromSuperview];
  [vc removeFromParentViewController];
  [vc endAppearanceTransition];
  [vc closeOfferwallViewController];
  self.offerwall = nil;
}
- (void)dealloc { [self detach]; }
@end

@interface JCurveOfferwallViewManager : RCTViewManager
@end
@implementation JCurveOfferwallViewManager
RCT_EXPORT_MODULE(JCurveOfferwallView)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (UIView *)view {
  JCurveOfferwallView *view = [JCurveOfferwallView new];
  view.bridge = self.bridge;
  return view;
}
RCT_EXPORT_VIEW_PROPERTY(usn, NSString)
RCT_EXPORT_VIEW_PROPERTY(detailCampaignKey, NSString)
RCT_EXPORT_VIEW_PROPERTY(onLoaded, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onDetailOpened, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onDetailClosed, RCTDirectEventBlock)
@end
