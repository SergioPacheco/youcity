// Public, static affiliate configuration. Never put private credentials here.
window.YOUCITY_AFFILIATE_CONFIG = {
  version: 1,
  enabled: true,
  debug: false,
  disclosure: {
    short: "Some travel links are affiliate links. YouCity may earn a commission if you make a booking, at no additional cost to you.",
    path: "/affiliate-disclosure"
  },
  countryCodes: {
    Argentina: "AR",
    Australia: "AU",
    Austria: "AT",
    Bolivia: "BO",
    Brazil: "BR",
    Bulgaria: "BG",
    Canada: "CA",
    China: "CN",
    Colombia: "CO",
    "Costa Rica": "CR",
    Cuba: "CU",
    Czechia: "CZ",
    "Dominican Republic": "DO",
    Egypt: "EG",
    Ecuador: "EC",
    England: "GB",
    France: "FR",
    Germany: "DE",
    Greece: "GR",
    Guatemala: "GT",
    Hungary: "HU",
    India: "IN",
    Indonesia: "ID",
    Iran: "IR",
    Ireland: "IE",
    Israel: "IL",
    Italy: "IT",
    Japan: "JP",
    Kenya: "KE",
    Korea: "KR",
    Malaysia: "MY",
    Mexico: "MX",
    Monaco: "MC",
    Morocco: "MA",
    Netherlands: "NL",
    "New Zealand": "NZ",
    "Northern Ireland": "GB",
    Norway: "NO",
    Pakistan: "PK",
    Philippines: "PH",
    Poland: "PL",
    Portugal: "PT",
    Peru: "PE",
    Qatar: "QA",
    Rwanda: "RW",
    Russia: "RU",
    Senegal: "SN",
    Singapore: "SG",
    Slovenia: "SI",
    "South Africa": "ZA",
    Spain: "ES",
    Sweden: "SE",
    Switzerland: "CH",
    Taiwan: "TW",
    Tanzania: "TZ",
    Turkey: "TR",
    UAE: "AE",
    UK: "GB",
    USA: "US",
    Ukraine: "UA",
    Uruguay: "UY",
    Uzbekistan: "UZ"
  },
  features: {
    providers: {
      expedia: true,
      booking: true,
      viator: true,
      discovercars: true,
      travelpayouts: true,
      airalo: true,
      heymondo: true,
      stay22: true
    },
    stay22: {
      hotels: true,
      activities: true,
      searchbar: true,
      map: true,
      cars: false,
      flights: true,
      script: true
    }
  },
  providers: {
    expedia: {
      name: "Expedia",
      enabled: true,
      configured: false,
      priority: 80,
      verticals: ["hotels", "flights", "activities"]
    },
    booking: {
      name: "Booking.com",
      enabled: true,
      configured: false,
      priority: 80,
      verticals: ["hotels"]
    },
    viator: {
      name: "Viator",
      enabled: true,
      configured: false,
      priority: 100,
      verticals: ["activities"]
    },
    discovercars: {
      name: "DiscoverCars",
      enabled: true,
      configured: true,
      priority: 100,
      verticals: ["cars"],
      affiliateId: "youcity"
    },
    travelpayouts: {
      name: "Travelpayouts",
      enabled: true,
      configured: false,
      priority: 80,
      verticals: ["flights", "hotels"]
    },
    airalo: {
      name: "Airalo",
      enabled: true,
      configured: false,
      priority: 100,
      verticals: ["esim"]
    },
    heymondo: {
      name: "Heymondo",
      enabled: true,
      configured: false,
      priority: 100,
      verticals: ["insurance"]
    },
    stay22: {
      name: "Stay22",
      enabled: true,
      configured: true,
      priority: 100,
      verticals: ["hotels", "vacation-rentals", "activities", "flights"],
      aid: "youcity",
      // Public integration switches. Cars remain off until their documented
      // Allez construction contract is confirmed for this UI. Flights use
      // Stay22's documented Kayak Allez flight category.
      features: {
        hotels: true,
        activities: true,
        searchbar: true,
        map: true,
        cars: false,
        flights: true,
        script: true
      },
      roam: {
        forceProvider: null,
        excludeProviders: []
      },
      stay22Automation: {
        scriptInstalled: true,
        nova: "managed-by-stay22",
        spark: "managed-by-stay22",
        linkSwap: "managed-by-stay22"
      },
      connectedTrips: true,
      retail: "account-controlled",
      status: {
        cars: "NEEDS_EXTERNAL_CONFIGURATION",
        flights: "READY_VIA_ALLEZ_KAYAK",
        script: "READY",
        nova: "READY_VIA_SCRIPT",
        spark: "READY_VIA_SCRIPT",
        linkSwap: "READY_VIA_SCRIPT",
        retail: "ACCOUNT_NOT_ENABLED"
      }
    }
  },
  ranking: {
    strategy: "default"
  },
  experiments: {
    enabled: false,
    byVertical: {},
    // Stay22 routing experiments are opt-in. The default remains 100% Roam.
    stay22: {
      enabled: false,
      activeVariant: "stay22_roam",
      variants: {
        stay22_roam: { forceProvider: null },
        stay22_booking: { forceProvider: "booking" },
        stay22_expedia: { forceProvider: "expedia" }
      }
    }
  }
};
