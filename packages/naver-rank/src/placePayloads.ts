// Read-only source: rankfree/app/Domain/Place/NaverPlacePayloads.php (query strings unchanged).
export const placePayloads = {
  "place": [
    {
      "operationName": "getPlacesList",
      "variables": {
        "useReverseGeocode": true,
        "input": {
          "query": "{#query}",
          "start": 1,
          "display": 50,
          "adult": false,
          "spq": false,
          "queryRank": "",
          "x": "{#x}",
          "y": "{#y}",
          "deviceType": "pcmap"
        },
        "isNmap": true,
        "isBounds": true,
        "reverseGeocodingInput": {
          "x": "{#x}",
          "y": "{#y}"
        }
      },
      "query": "query getPlacesList($input: PlacesInput, $isNmap: Boolean!, $isBounds: Boolean!) {  businesses: places(input: $input) {    total    items {      id      name      category      dbType      distance      roadAddress      address      x      y      markerLabel @include(if: $isNmap) {        text        __typename      }      visitorReviewCount      blogCafeReviewCount      imageCount      __typename    }    optionsForMap @include(if: $isBounds) {      center      __typename    }    queryString    siteSort    __typename  }}"
    }
  ],
  "hospital": [
    {
      "operationName": "getNxList",
      "variables": {
        "useReverseGeocode": true,
        "input": {
          "query": "{#query}",
          "display": 50,
          "start": 1,
          "filterBooking": false,
          "filterOpentime": false,
          "filterSpecialist": false,
          "sortingOrder": "precision",
          "x": "{#x}",
          "y": "{#y}",
          "day": null,
          "bounds": "{#bounds}",
          "deviceType": "pcmap"
        },
        "reverseGeocodingInput": {
          "x": "{#x}",
          "y": "{#y}"
        }
      },
      "query": "query getNxList($input: HospitalListInput, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {  businesses: hospitals(input: $input) {    total    items {      id      name      category      businessCategory      x      y      distance      roadAddress      address      visitorReviewCount      blogCafeReviewCount      imageCount      __typename    }    __typename  }  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {    rcode    region    __typename  }}"
    }
  ],
  "hairshop": [
    {
      "operationName": "getBeautyList",
      "variables": {
        "useReverseGeocode": true,
        "input": {
          "query": "{#query}",
          "display": 50,
          "start": 1,
          "filterBooking": false,
          "filterCoupon": false,
          "filterNpay": false,
          "filterOpening": false,
          "filterBookingPromotion": false,
          "naverBenefit": false,
          "sortingOrder": "precision",
          "x": "{#x}",
          "y": "{#y}",
          "bounds": "{#bounds}",
          "deviceType": "pcmap",
          "bypassStyleClous": false,
          "ignoreQueryResult": false
        },
        "reverseGeocodingInput": {
          "x": "{#x}",
          "y": "{#y}"
        }
      },
      "query": "query getBeautyList($input: BeautyListInput, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {  businesses: hairshopList(input: $input) {    total    items {      id      name      category      x      y      distance      roadAddress      address      visitorReviewCount      blogCafeReviewCount      bookingReviewCount      imageCount      __typename    }    queryString    siteSort    __typename  }  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {    rcode    region    __typename  }}"
    }
  ],
  "restaurant": [
    {
      "operationName": "getRestaurantsPcmap",
      "variables": {
        "input": {
          "query": "{#query}",
          "start": 1,
          "display": 50,
          "isCurrentLocationSearch": null,
          "deviceType": "pcmap",
          "isPcmap": true
        }
      },
      "query": "query getRestaurantsPcmap($input: PlaceListInput) {  restaurants: placeList(input: $input) {    businesses {      total      items {        id        name        category        businessCategory        x        y        visitorReviewCount        blogCafeReviewCount        bookingReviewCount        visitorReviewScore        tags        saveCount        imageCount        newOpening        talktalkUrl        posInfo {          isPOS          __typename        }        __typename      }      __typename    }    __typename  }}"
    }
  ],
  "nailshop": [
    {
      "operationName": "getBeautyList",
      "variables": {
        "useReverseGeocode": true,
        "input": {
          "query": "{#query}",
          "display": 50,
          "start": 1,
          "filterBooking": false,
          "filterCoupon": false,
          "filterNpay": false,
          "filterOpening": false,
          "filterBookingPromotion": false,
          "naverBenefit": false,
          "sortingOrder": "precision",
          "x": "{#x}",
          "y": "{#y}",
          "bounds": "{#bounds}",
          "deviceType": "pcmap",
          "bypassStyleClous": false,
          "ignoreQueryResult": false
        },
        "reverseGeocodingInput": {
          "x": "{#x}",
          "y": "{#y}"
        }
      },
      "query": "query getBeautyList($input: BeautyListInput, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {  businesses: nailshopList(input: $input) {    total    items {      id      name      category      x      y      distance      roadAddress      address      visitorReviewCount      blogCafeReviewCount      bookingReviewCount      imageCount      __typename    }    queryString    siteSort    __typename  }  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {    rcode    region    __typename  }}"
    }
  ],
  "accommodation": [
    {
      "operationName": "getPlacesList",
      "variables": {
        "useReverseGeocode": true,
        "input": {
          "query": "{#query}",
          "start": 1,
          "display": 50,
          "adult": false,
          "spq": false,
          "queryRank": "",
          "x": "{#x}",
          "y": "{#y}",
          "deviceType": "pcmap"
        },
        "isNmap": true,
        "isBounds": true,
        "reverseGeocodingInput": {
          "x": "{#x}",
          "y": "{#y}"
        }
      },
      "query": "query getPlacesList($input: PlacesInput, $isNmap: Boolean!, $isBounds: Boolean!) {  businesses: places(input: $input) {    total    items {      id      name      category      dbType      distance      roadAddress      address      x      y      markerLabel @include(if: $isNmap) {        text        __typename      }      visitorReviewCount      blogCafeReviewCount      imageCount      __typename    }    optionsForMap @include(if: $isBounds) {      center      __typename    }    queryString    siteSort    __typename  }}"
    }
  ]
} as const;
