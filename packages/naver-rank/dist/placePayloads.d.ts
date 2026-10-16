export declare const placePayloads: {
    readonly place: readonly [{
        readonly operationName: "getPlacesList";
        readonly variables: {
            readonly useReverseGeocode: true;
            readonly input: {
                readonly query: "{#query}";
                readonly start: 1;
                readonly display: 50;
                readonly adult: false;
                readonly spq: false;
                readonly queryRank: "";
                readonly x: "{#x}";
                readonly y: "{#y}";
                readonly deviceType: "pcmap";
            };
            readonly isNmap: true;
            readonly isBounds: true;
            readonly reverseGeocodingInput: {
                readonly x: "{#x}";
                readonly y: "{#y}";
            };
        };
        readonly query: "query getPlacesList($input: PlacesInput, $isNmap: Boolean!, $isBounds: Boolean!) {  businesses: places(input: $input) {    total    items {      id      name      category      dbType      distance      roadAddress      address      x      y      markerLabel @include(if: $isNmap) {        text        __typename      }      visitorReviewCount      blogCafeReviewCount      imageCount      __typename    }    optionsForMap @include(if: $isBounds) {      center      __typename    }    queryString    siteSort    __typename  }}";
    }];
    readonly hospital: readonly [{
        readonly operationName: "getNxList";
        readonly variables: {
            readonly useReverseGeocode: true;
            readonly input: {
                readonly query: "{#query}";
                readonly display: 50;
                readonly start: 1;
                readonly filterBooking: false;
                readonly filterOpentime: false;
                readonly filterSpecialist: false;
                readonly sortingOrder: "precision";
                readonly x: "{#x}";
                readonly y: "{#y}";
                readonly day: null;
                readonly bounds: "{#bounds}";
                readonly deviceType: "pcmap";
            };
            readonly reverseGeocodingInput: {
                readonly x: "{#x}";
                readonly y: "{#y}";
            };
        };
        readonly query: "query getNxList($input: HospitalListInput, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {  businesses: hospitals(input: $input) {    total    items {      id      name      category      businessCategory      x      y      distance      roadAddress      address      visitorReviewCount      blogCafeReviewCount      imageCount      __typename    }    __typename  }  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {    rcode    region    __typename  }}";
    }];
    readonly hairshop: readonly [{
        readonly operationName: "getBeautyList";
        readonly variables: {
            readonly useReverseGeocode: true;
            readonly input: {
                readonly query: "{#query}";
                readonly display: 50;
                readonly start: 1;
                readonly filterBooking: false;
                readonly filterCoupon: false;
                readonly filterNpay: false;
                readonly filterOpening: false;
                readonly filterBookingPromotion: false;
                readonly naverBenefit: false;
                readonly sortingOrder: "precision";
                readonly x: "{#x}";
                readonly y: "{#y}";
                readonly bounds: "{#bounds}";
                readonly deviceType: "pcmap";
                readonly bypassStyleClous: false;
                readonly ignoreQueryResult: false;
            };
            readonly reverseGeocodingInput: {
                readonly x: "{#x}";
                readonly y: "{#y}";
            };
        };
        readonly query: "query getBeautyList($input: BeautyListInput, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {  businesses: hairshopList(input: $input) {    total    items {      id      name      category      x      y      distance      roadAddress      address      visitorReviewCount      blogCafeReviewCount      bookingReviewCount      imageCount      __typename    }    queryString    siteSort    __typename  }  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {    rcode    region    __typename  }}";
    }];
    readonly restaurant: readonly [{
        readonly operationName: "getRestaurantsPcmap";
        readonly variables: {
            readonly input: {
                readonly query: "{#query}";
                readonly start: 1;
                readonly display: 50;
                readonly isCurrentLocationSearch: null;
                readonly deviceType: "pcmap";
                readonly isPcmap: true;
            };
        };
        readonly query: "query getRestaurantsPcmap($input: PlaceListInput) {  restaurants: placeList(input: $input) {    businesses {      total      items {        id        name        category        businessCategory        x        y        visitorReviewCount        blogCafeReviewCount        bookingReviewCount        visitorReviewScore        tags        saveCount        imageCount        newOpening        talktalkUrl        posInfo {          isPOS          __typename        }        __typename      }      __typename    }    __typename  }}";
    }];
    readonly nailshop: readonly [{
        readonly operationName: "getBeautyList";
        readonly variables: {
            readonly useReverseGeocode: true;
            readonly input: {
                readonly query: "{#query}";
                readonly display: 50;
                readonly start: 1;
                readonly filterBooking: false;
                readonly filterCoupon: false;
                readonly filterNpay: false;
                readonly filterOpening: false;
                readonly filterBookingPromotion: false;
                readonly naverBenefit: false;
                readonly sortingOrder: "precision";
                readonly x: "{#x}";
                readonly y: "{#y}";
                readonly bounds: "{#bounds}";
                readonly deviceType: "pcmap";
                readonly bypassStyleClous: false;
                readonly ignoreQueryResult: false;
            };
            readonly reverseGeocodingInput: {
                readonly x: "{#x}";
                readonly y: "{#y}";
            };
        };
        readonly query: "query getBeautyList($input: BeautyListInput, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {  businesses: nailshopList(input: $input) {    total    items {      id      name      category      x      y      distance      roadAddress      address      visitorReviewCount      blogCafeReviewCount      bookingReviewCount      imageCount      __typename    }    queryString    siteSort    __typename  }  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {    rcode    region    __typename  }}";
    }];
    readonly accommodation: readonly [{
        readonly operationName: "getPlacesList";
        readonly variables: {
            readonly useReverseGeocode: true;
            readonly input: {
                readonly query: "{#query}";
                readonly start: 1;
                readonly display: 50;
                readonly adult: false;
                readonly spq: false;
                readonly queryRank: "";
                readonly x: "{#x}";
                readonly y: "{#y}";
                readonly deviceType: "pcmap";
            };
            readonly isNmap: true;
            readonly isBounds: true;
            readonly reverseGeocodingInput: {
                readonly x: "{#x}";
                readonly y: "{#y}";
            };
        };
        readonly query: "query getPlacesList($input: PlacesInput, $isNmap: Boolean!, $isBounds: Boolean!) {  businesses: places(input: $input) {    total    items {      id      name      category      dbType      distance      roadAddress      address      x      y      markerLabel @include(if: $isNmap) {        text        __typename      }      visitorReviewCount      blogCafeReviewCount      imageCount      __typename    }    optionsForMap @include(if: $isBounds) {      center      __typename    }    queryString    siteSort    __typename  }}";
    }];
};
