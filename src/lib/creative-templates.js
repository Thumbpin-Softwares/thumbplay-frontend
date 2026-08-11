// Central registry for the Creative Ad Generator's templates — mirrors
// src/lib/templates.js but for static assets instead of video reels.
//
// Every entry here maps 1:1 to the backend's CREATIVE_TEMPLATE_WEBHOOKS
// registry (backend/src/modules/creative-ads/creative-ads.service.ts) and to
// an n8n workflow whose "Build Creative Prompt" node hardcodes this same
// `image` URL as its generation reference — the gallery thumbnail IS the
// design the model replicates. Adding a template is: one new n8n workflow
// (duplicate an existing creative-ads-* workflow), one new backend registry
// entry, and one new entry below — the generic form/route render everything
// else from `form`.
export const CREATIVE_TEMPLATES = [
  {
    slug: "art-of-living",
    title: "Art of Living",
    category: "real-estate",
    image: "https://content.thumbpin.in/creatives/art_of_living.jpg",
    tag: "New",
    templateKey: "art-of-living",
    href: "/dashboard/creative/art-of-living",
    description: "A premium editorial-style static ad for your property.",
    form: {
      propertyNamePlaceholder: "Skyline Residences",
      headlinePlaceholder: "Where Luxury Meets Living",
      subheadingPlaceholder: "3 & 4 BHK Residences in the Heart of the City",
      ctaDefault: "Book a Visit",
      tonalityPlaceholder: "warm, aspirational, editorial",
      showLocation: false,
      showAdditionalDetails: false,
    },
  },
  {
    slug: "daylight-aesthetic",
    title: "Daylight Aesthetic",
    category: "real-estate",
    image: "https://content.thumbpin.in/creatives/daylight_aesthetic.jpg",
    tag: "New",
    templateKey: "daylight-aesthetic",
    href: "/dashboard/creative/daylight-aesthetic",
    description: "A warm daytime hero shot with a curved photo collage, for luxury listings.",
    form: {
      propertyNamePlaceholder: "Suncity's Monarch Residences",
      headlinePlaceholder: "Crafted for the Discerning",
      subheadingPlaceholder: "3 & 4 BHK Luxury Apartments",
      ctaDefault: "",
      tonalityPlaceholder: "warm, luxurious, daylight, aspirational",
      showLocation: true,
      locationPlaceholder: "Sector-78, Gurugram",
      showAdditionalDetails: true,
      additionalDetailsLabel: "Small Print (optional)",
      additionalDetailsPlaceholder: "RERA No: RC/REP/HARERA/GGM/1037/769/2026/09",
    },
  },
  {
    slug: "midnight-aesthetic",
    title: "Midnight Aesthetic",
    category: "real-estate",
    image: "https://content.thumbpin.in/creatives/midnight_aesthetic.jpg",
    tag: "New",
    templateKey: "midnight-aesthetic",
    href: "/dashboard/creative/midnight-aesthetic",
    description: "A dramatic night skyline shot with gold payment-plan badges.",
    form: {
      propertyNamePlaceholder: "The Courtyard Residences",
      headlinePlaceholder: "Live in the Heart of the City",
      subheadingPlaceholder: "",
      ctaDefault: "Contact Us Today",
      tonalityPlaceholder: "dramatic, upscale, nocturnal, cinematic",
      showLocation: false,
      showAdditionalDetails: true,
      additionalDetailsLabel: "Payment Plan / Callout Badges (optional)",
      additionalDetailsPlaceholder: "30% on Booking, 60% on Installment, 10% on Completion",
    },
  },
  {
    slug: "minimal-heights",
    title: "Minimal Heights",
    category: "real-estate",
    image: "https://content.thumbpin.in/creatives/minimal-heights.jpeg",
    tag: "New",
    templateKey: "minimal-heights",
    href: "/dashboard/creative/minimal-heights",
    description: "A clean 3D isometric skyline illustration on an unfolded map, for investment-style listings.",
    form: {
      propertyNamePlaceholder: "Aurelia Heights",
      headlinePlaceholder: "The Fastest Way to Your Dream Home",
      subheadingPlaceholder: "Live | Connect | Thrive",
      ctaDefault: "Limited Units Available",
      tonalityPlaceholder: "clean, minimalist, upscale, architectural",
      showLocation: true,
      locationPlaceholder: "Dubai Marina",
      showAdditionalDetails: true,
      additionalDetailsLabel: "Price, Feature Highlights & Contact Info (optional)",
      additionalDetailsPlaceholder: "Starting from AED 1.35M. Luxury 1, 2 & 3 Bedroom Apartments, World-Class Amenities, High ROI Investment Opportunity, Handover Q4 2027. +971 58 123 4567, www.example.com",
    },
  },
];

export function getAllCreativeTemplates() {
  return CREATIVE_TEMPLATES.filter((t) => !t.hidden);
}

export function getCreativeTemplateBySlug(slug) {
  return CREATIVE_TEMPLATES.find((t) => t.slug === slug);
}
