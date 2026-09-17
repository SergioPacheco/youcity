// Comment Assistant templates. Edit this file to change the deterministic
// comment library; no AI service is involved in selecting or composing text.
const COMMENT_TEMPLATES = Object.freeze({
  modes: {
    walk: [
      "Walking through {area} gives a real sense of this part of {city}.",
      "Videos like this make it easier to imagine the pace of {area} before visiting {city}.",
      "{area} feels much more tangible when you can follow its streets at this pace."
    ],
    drive: [
      "Seeing {city} from the road gives a different perspective on the city.",
      "Driving through {area} is a useful way to get a feel for the pace and layout of {city}.",
      "This road-level view makes {city} easier to imagine as part of a future trip."
    ],
    drone: [
      "The aerial view gives {city} a completely different sense of scale.",
      "It is interesting to see how {city} comes together from above in this perspective.",
      "This drone view makes the shape and setting of {city} easier to appreciate."
    ],
    bike: [
      "Exploring {city} by bike gives the streets a very different rhythm.",
      "A bike ride like this is a nice way to get a closer feel for {area}.",
      "This perspective makes {city} feel especially easy to explore at your own pace."
    ],
    beach_walk: [
      "A beach walk like this shows a calmer side of {city}.",
      "The pace of this walk makes it easy to settle into the atmosphere around {area}.",
      "This is a lovely way to get a feel for {city} before planning a visit."
    ]
  },
  translations: {
    es: [
      "Recorrer {area} permite sentir de verdad esta parte de {city}.",
      "Un vídeo así ayuda a imaginar el ritmo de {area} antes de visitar {city}.",
      "Esta perspectiva hace que {city} resulte mucho más fácil de imaginar."
    ],
    pt: [
      "Caminhar por {area} ajuda a sentir de verdade esta parte de {city}.",
      "Um vídeo assim facilita imaginar o ritmo de {area} antes de visitar {city}.",
      "Esta perspectiva torna {city} muito mais fácil de imaginar antes da viagem."
    ]
  },
  toneSuffixes: {
    curious: " It makes you wonder how different it feels in person.",
    traveller: " It is the kind of view that helps when planning a route.",
    informative: " It is a useful reference before a first visit."
  },
  cta: {
    planTrip: "If you're planning a trip to {city}, YouCity has more ways to explore it{url}.",
    cityLink: "You can explore {city} on YouCity before travelling: {url}",
    mention: "YouCity is a natural complement for exploring {city} before travelling.",
    cityUrl: "You can also explore {city} on YouCity: {url}",
    cityMention: "YouCity is a useful complement for exploring {city} before travelling."
  }
});

export { COMMENT_TEMPLATES };
