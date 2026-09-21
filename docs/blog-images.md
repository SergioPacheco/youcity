# Blog image provenance

## Current published covers

The seven published articles use the AI-generated PNG covers supplied in
`assets/blog/1.png` through `assets/blog/7.png`. The build uses local WebP
variants derived from those files:

- `1-*`: virtual city exploration (`explore-a-city-virtually-before-travelling`).
- `2-*`: local radio and city atmosphere (`discovering-a-citys-atmosphere-through-local-radio`).
- `3-*`: Paris itinerary (`paris-in-3-days`).
- `4-*`: Lisbon or Porto comparison (`lisbon-or-porto`).
- `5-*`: hotel location (`how-to-choose-hotel-location`).
- `6-*`: weekend city break (`plan-weekend-city-break`).
- `7-*`: self-guided city walk (`plan-self-guided-city-walk`).

Each source image is 1536×1024 (3:2). The generated WebP variants are
640×427, 960×640, and 1440×960. These are AI-generated editorial
illustrations supplied for YouCity, not documentary evidence of current
conditions, exact streets, landmarks, or accessibility.

These illustrations are labeled as non-documentary in article credits and alt
text; they do not represent exact streets, landmarks, or current conditions.
The ten articles released from draft status use the optimized
`hero-blog-cover-*` variants. This is a general YouCity project image and is
explicitly credited as not depicting those destinations. The seven source
cover sets and three generic variants were checked with ImageMagick `identify`.

Older generated covers remain in `assets/blog/` for repository history but are
not referenced by the current article metadata. New articles should use a
destination-specific or clearly labeled non-documentary cover before
publication.
