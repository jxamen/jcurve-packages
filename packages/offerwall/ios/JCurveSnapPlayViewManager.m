#import <React/RCTViewManager.h>
#import <React/RCTBridge.h>
#import <React/UIView+React.h>

// 0.6.0 — SnapPlay's own offerwall screen (S2OfferwallView) as a React Native view, so the 「찬스2」 tab can show it inside the tab instead of the full-screen
// modal react-native-s2offerwall presents. Compiled only when the SnapPlay pod's Swift header is there; without it this view is simply not registered and the JS
// side keeps using the modal. The JS side initializes the SDK and sets the user first (snapPlay.ts `prepare`); this view only loads the placement.
#if __has_include(<s2offerwall/s2offerwall-Swift.h>)
#import <s2offerwall/s2offerwall-Swift.h>

@interface JCurveSnapPlayView : UIView <S2OfferwallEventListener>
@property (nonatomic, copy) NSString *placement;
@property (nonatomic, copy) RCTDirectEventBlock onLoginRequested;
@property (nonatomic, copy) RCTDirectEventBlock onCloseRequested;
@property (nonatomic, strong) S2OfferwallView *wall;
@end

@implementation JCurveSnapPlayView
- (void)setPlacement:(NSString *)placement {
  if (placement.length == 0 || [_placement isEqualToString:placement]) return;
  [self detach];
  _placement = [placement copy];
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
  if (!self.window || size.width <= 0 || size.height <= 0 || self.placement.length == 0 || self.wall) return;
  S2OfferwallView *wall = [[S2OfferwallView alloc] init];
  [wall setEventListener:self];
  wall.translatesAutoresizingMaskIntoConstraints = NO;
  self.clipsToBounds = YES;
  [self addSubview:wall];
  [NSLayoutConstraint activateConstraints:@[
    [wall.leftAnchor constraintEqualToAnchor:self.leftAnchor],
    [wall.rightAnchor constraintEqualToAnchor:self.rightAnchor],
    [wall.topAnchor constraintEqualToAnchor:self.topAnchor],
    [wall.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
  ]];
  self.wall = wall;
  [wall loadWithPlacementName:self.placement];
}
- (void)onLoginRequested:(NSString *)param { if (self.onLoginRequested) self.onLoginRequested(@{}); }
- (void)onCloseRequested:(NSString *)param { if (self.onCloseRequested) self.onCloseRequested(@{}); }
- (void)detach {
  if (!self.wall) return;
  [self.wall removeFromSuperview];
  self.wall = nil;
}
- (void)dealloc { [self detach]; }
@end

@interface JCurveSnapPlayViewManager : RCTViewManager
@end
@implementation JCurveSnapPlayViewManager
RCT_EXPORT_MODULE(JCurveSnapPlayView)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (UIView *)view { return [JCurveSnapPlayView new]; }
RCT_EXPORT_VIEW_PROPERTY(placement, NSString)
RCT_EXPORT_VIEW_PROPERTY(onLoginRequested, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCloseRequested, RCTDirectEventBlock)
@end
#endif
